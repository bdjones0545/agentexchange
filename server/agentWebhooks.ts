// Agent webhooks: deliver the events the database records (agent_events, see
// supabase/migrations/20261119090000_agent_webhooks.sql) to each agent key's
// HTTPS endpoint, signed per Standard Webhooks (https://www.standardwebhooks.com)
// so any Svix/Standard Webhooks verifier accepts them. Events carry identifiers
// and a status only; the agent reads the details back through the MCP tools.
import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";

export const WEBHOOK_EVENT_TYPES = [
  "application.created", "application.accepted", "application.rejected",
  "negotiation.created", "negotiation.countered", "negotiation.accepted", "negotiation.rejected",
  "hire_request.created", "hire_request.accepted", "hire_request.rejected",
  "contract.created", "contract.funded", "contract.hold_ended",
  "message.created",
  "deliverable.submitted", "deliverable.returned", "deliverable.approved",
  "payment.released", "payment.refunded",
  "dispute.opened", "dispute.resolved",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/** Minutes to wait after each failed attempt; after the last, the delivery is given up (about 22 hours). */
export const RETRY_MINUTES = [1, 5, 15, 60, 180, 360, 720] as const;

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("base64")}`;
}

/** Standard Webhooks signature: v1,base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)). */
export function signWebhook(secret: string, id: string, timestamp: number, body: string): string {
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
}

export class WebhookUrlError extends Error {}

function privateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

/** True for loopback, private, link-local, unique-local, CGNAT, multicast and reserved addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return privateIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped) return privateIPv4(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6) || v6.startsWith("64:ff9b:") || v6.startsWith("2001:db8:");
}

export type Resolver = (host: string) => Promise<string[]>;
const dnsResolver: Resolver = async (host) => (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

/**
 * Only a public HTTPS endpoint: no credentials in the URL, no localhost or
 * internal names, and every address the name resolves to must be public, so a
 * webhook cannot be pointed at the platform's own network.
 */
export async function assertDeliverableUrl(raw: string, resolve: Resolver = dnsResolver): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new WebhookUrlError("Webhook URL is not a valid URL"); }
  if (url.protocol !== "https:") throw new WebhookUrlError("Webhook URL must use https");
  if (url.username || url.password) throw new WebhookUrlError("Webhook URL must not contain credentials");
  if (raw.length > 2048) throw new WebhookUrlError("Webhook URL is too long");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || /\.(localhost|local|internal|home|lan)$/.test(host) || !host.includes(".") && !isIP(host)) {
    throw new WebhookUrlError("Webhook URL must be a public internet address");
  }
  let addresses: string[];
  try { addresses = isIP(host) ? [host] : await resolve(host); } catch { throw new WebhookUrlError("Webhook host does not resolve"); }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new WebhookUrlError("Webhook URL must be a public internet address");
  return url;
}

export type WebhookEnvelope = { id: string; type: string; createdAt: string; data: Record<string, unknown> };
export type SendResult = { ok: boolean; status: number | null };
export type WebhookTransport = (url: string, secret: string, envelope: WebhookEnvelope, nowSeconds: number) => Promise<SendResult>;

/** POST one signed event. No redirects, 5 seconds by default, response body discarded. */
export function httpTransport(resolve: Resolver = dnsResolver, timeoutMs = 5000): WebhookTransport {
  return async (url, secret, envelope, nowSeconds) => {
    try {
      await assertDeliverableUrl(url, resolve);
      const body = JSON.stringify(envelope);
      const response = await fetch(url, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "content-type": "application/json",
          "user-agent": "AgentExchange-Webhooks/1",
          "webhook-id": envelope.id,
          "webhook-timestamp": String(nowSeconds),
          "webhook-signature": signWebhook(secret, envelope.id, nowSeconds, body),
        },
        body,
      });
      await response.body?.cancel();
      return { ok: response.status >= 200 && response.status < 300, status: response.status };
    } catch {
      return { ok: false, status: null };
    }
  };
}

export type DueDelivery = {
  eventId: string;
  keyId: string;
  attempts: number;
  event: { type: string; data: Record<string, unknown>; createdAt: string };
  webhook: { url: string; secret: string } | null;
};

export type DeliveryStore = {
  /** Claim up to `limit` due deliveries for two minutes so overlapping runs never send one twice. */
  claimDue(limit: number, nowMs: number): Promise<DueDelivery[]>;
  delivered(d: DueDelivery, status: number, nowMs: number): Promise<void>;
  retry(d: DueDelivery, status: number | null, nextAttemptMs: number, nowMs: number): Promise<void>;
  /** Out of retries: the delivery is given up and the webhook switched off until it is set again. */
  giveUp(d: DueDelivery, status: number | null, nowMs: number): Promise<void>;
};

export type DeliveryReport = { delivered: number; retried: number; gaveUp: number };

export async function deliverDue(store: DeliveryStore, transport: WebhookTransport, now: () => number, deadline: number, limit = 25): Promise<DeliveryReport> {
  const report: DeliveryReport = { delivered: 0, retried: 0, gaveUp: 0 };
  while (now() < deadline) {
    const due = await store.claimDue(limit, now());
    if (due.length === 0) break;
    for (const d of due) {
      if (now() >= deadline) break;
      if (!d.webhook) { await store.giveUp(d, null, now()); report.gaveUp++; continue; }
      const envelope: WebhookEnvelope = { id: d.eventId, type: d.event.type, createdAt: d.event.createdAt, data: d.event.data };
      const result = await transport(d.webhook.url, d.webhook.secret, envelope, Math.floor(now() / 1000));
      if (result.ok) { await store.delivered(d, result.status ?? 200, now()); report.delivered++; continue; }
      const wait = RETRY_MINUTES[d.attempts];
      if (wait === undefined) { await store.giveUp(d, result.status, now()); report.gaveUp++; }
      else { await store.retry(d, result.status, now() + wait * 60_000, now()); report.retried++; }
    }
    if (due.length < limit) break;
  }
  return report;
}

type Row = Record<string, unknown>;
const iso = (ms: number) => new Date(ms).toISOString();

export function supabaseDeliveryStore(client: SupabaseClient): DeliveryStore {
  return {
    async claimDue(limit, nowMs) {
      const { data: rows, error } = await client.from("agent_event_deliveries").select("event_id,key_id,attempts,lease_until")
        .is("delivered_at", null).is("failed_at", null).lte("next_attempt_at", iso(nowMs)).order("next_attempt_at").limit(limit);
      if (error) throw new Error("Could not read due webhook deliveries");
      const claimed: Row[] = [];
      for (const row of (rows ?? []) as Row[]) {
        if (row.lease_until && Date.parse(String(row.lease_until)) > nowMs) continue;
        const { data, error: claimError } = await client.from("agent_event_deliveries").update({ lease_until: iso(nowMs + 120_000) })
          .eq("event_id", row.event_id).eq("key_id", row.key_id).is("delivered_at", null).is("failed_at", null)
          .or(`lease_until.is.null,lease_until.lt.${iso(nowMs)}`).select("event_id").maybeSingle();
        if (!claimError && data) claimed.push(row);
      }
      if (claimed.length === 0) return [];
      const [events, hooks] = await Promise.all([
        client.from("agent_events").select("id,type,data,created_at").in("id", [...new Set(claimed.map((r) => String(r.event_id)))]),
        client.from("agent_webhooks").select("key_id,url,secret,disabled_at").in("key_id", [...new Set(claimed.map((r) => String(r.key_id)))]),
      ]);
      if (events.error || hooks.error) throw new Error("Could not read webhook events");
      return claimed.flatMap((r) => {
        const event = ((events.data ?? []) as Row[]).find((e) => e.id === r.event_id);
        if (!event) return [];
        const hook = ((hooks.data ?? []) as Row[]).find((h) => h.key_id === r.key_id && !h.disabled_at);
        return [{
          eventId: String(r.event_id), keyId: String(r.key_id), attempts: Number(r.attempts ?? 0),
          event: { type: String(event.type), data: (event.data as Record<string, unknown>) ?? {}, createdAt: String(event.created_at) },
          webhook: hook ? { url: String(hook.url), secret: String(hook.secret) } : null,
        }];
      });
    },
    async delivered(d, status, nowMs) {
      await client.from("agent_event_deliveries").update({ delivered_at: iso(nowMs), attempts: d.attempts + 1, last_status: status, lease_until: null })
        .eq("event_id", d.eventId).eq("key_id", d.keyId);
      await client.from("agent_webhooks").update({ last_success_at: iso(nowMs), last_status: status }).eq("key_id", d.keyId);
    },
    async retry(d, status, nextAttemptMs, nowMs) {
      await client.from("agent_event_deliveries").update({ attempts: d.attempts + 1, last_status: status, next_attempt_at: iso(nextAttemptMs), lease_until: null })
        .eq("event_id", d.eventId).eq("key_id", d.keyId);
      await client.from("agent_webhooks").update({ last_failure_at: iso(nowMs), last_status: status }).eq("key_id", d.keyId);
    },
    async giveUp(d, status, nowMs) {
      await client.from("agent_event_deliveries").update({ attempts: d.attempts + 1, last_status: status, failed_at: iso(nowMs), lease_until: null })
        .eq("event_id", d.eventId).eq("key_id", d.keyId);
      if (d.webhook) {
        await client.from("agent_webhooks").update({ last_failure_at: iso(nowMs), last_status: status, disabled_at: iso(nowMs),
          disabled_reason: "Deliveries failed for about a day; set the webhook again to turn it back on" }).eq("key_id", d.keyId).is("disabled_at", null);
      }
    },
  };
}

/**
 * Right after a write: send what is already due for a moment, so the other
 * party usually hears within seconds; the per-minute job covers the rest.
 * Never throws and never delays the caller by more than about the budget.
 */
export async function deliverSoon(client: () => SupabaseClient, budgetMs = 1500): Promise<void> {
  try {
    const start = Date.now();
    await deliverDue(supabaseDeliveryStore(client()), httpTransport(dnsResolver, budgetMs), Date.now, start + budgetMs, 5);
  } catch {
    // The per-minute job retries.
  }
}

/** Delete delivered or given-up events older than 30 days. */
export async function pruneOldEvents(client: SupabaseClient, nowMs: number): Promise<void> {
  const cutoff = iso(nowMs - 30 * 24 * 3_600_000);
  const { data } = await client.from("agent_event_deliveries").select("event_id").lt("created_at", cutoff).is("delivered_at", null).is("failed_at", null).limit(1000);
  const pending = new Set(((data ?? []) as Row[]).map((r) => String(r.event_id)));
  const { data: old } = await client.from("agent_events").select("id").lt("created_at", cutoff).limit(1000);
  const ids = ((old ?? []) as Row[]).map((r) => String(r.id)).filter((id) => !pending.has(id));
  if (ids.length) await client.from("agent_events").delete().in("id", ids);
}

export type WebhookStatus = {
  keyId: string; url: string; events: string[]; createdAt: string; disabledAt: string | null; disabledReason: string | null;
  lastSuccessAt: string | null; lastFailureAt: string | null; lastStatus: number | null;
};

export function webhookStatus(row: Row): WebhookStatus {
  return {
    keyId: String(row.key_id), url: String(row.url), events: (row.events as string[] | null) ?? [], createdAt: String(row.created_at),
    disabledAt: (row.disabled_at as string | null) ?? null, disabledReason: (row.disabled_reason as string | null) ?? null,
    lastSuccessAt: (row.last_success_at as string | null) ?? null, lastFailureAt: (row.last_failure_at as string | null) ?? null,
    lastStatus: (row.last_status as number | null) ?? null,
  };
}
export const WEBHOOK_STATUS_COLUMNS = "key_id,url,events,created_at,disabled_at,disabled_reason,last_success_at,last_failure_at,last_status";

export function parseEventFilter(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.some((e) => typeof e !== "string" || !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(e))) {
    throw new WebhookUrlError(`events must be a list of: ${WEBHOOK_EVENT_TYPES.join(", ")}`);
  }
  return [...new Set(raw as string[])];
}

/**
 * Set (or replace) the webhook for one key the profile owns and return the new
 * signing secret, shown once. Setting it again rotates the secret and turns a
 * switched-off webhook back on.
 */
export async function setWebhook(client: SupabaseClient, profileId: string, keyId: string, rawUrl: string, rawEvents: unknown, resolve?: Resolver) {
  const url = await assertDeliverableUrl(rawUrl, resolve);
  const events = parseEventFilter(rawEvents);
  const { data: key, error: keyError } = await client.from("agent_api_keys").select("id,profile_id,revoked_at").eq("id", keyId).maybeSingle();
  if (keyError) throw new Error("Could not read agent key");
  if (!key || key.profile_id !== profileId || key.revoked_at) throw new WebhookUrlError("Agent key not found");
  const secret = generateWebhookSecret();
  const { data, error } = await client.from("agent_webhooks").upsert({
    key_id: keyId, profile_id: profileId, url: url.toString(), secret, events, updated_at: new Date().toISOString(),
    disabled_at: null, disabled_reason: null,
  }, { onConflict: "key_id" }).select(WEBHOOK_STATUS_COLUMNS).single();
  if (error) throw new Error("Could not save webhook");
  return { webhook: webhookStatus(data as Row), secret };
}

export async function removeWebhook(client: SupabaseClient, profileId: string, keyId: string) {
  const { error } = await client.from("agent_webhooks").delete().eq("key_id", keyId).eq("profile_id", profileId);
  if (error) throw new Error("Could not remove webhook");
}

/** Send a signed `webhook.test` event straight away, outside the queue. */
export async function sendTestEvent(client: SupabaseClient, profileId: string, keyId: string, transport: WebhookTransport = httpTransport()) {
  const { data } = await client.from("agent_webhooks").select("url,secret").eq("key_id", keyId).eq("profile_id", profileId).maybeSingle();
  if (!data) throw new WebhookUrlError("No webhook is set for this key");
  const now = Date.now();
  const envelope: WebhookEnvelope = { id: `test_${randomBytes(12).toString("hex")}`, type: "webhook.test", createdAt: iso(now), data: { keyId } };
  return transport(String(data.url), String(data.secret), envelope, Math.floor(now / 1000));
}

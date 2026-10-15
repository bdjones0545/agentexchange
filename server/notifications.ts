// Email the organization owner when an agent submits a deliverable.
//
// Server only: called from the MCP submit_deliverable tool and from
// /api/notifications after a browser submit. The email names the contract and
// the deliverable and links to the contract page; it never carries the work
// itself (the deliverable body is not even read). Everything is read back from
// the database with the service role, so a caller can only ever trigger the one
// email the stored state already calls for.
//
// Without RESEND_API_KEY this is a no-op that logs once per instance, so the
// product runs unchanged until the owner adds the key.
//
// Idempotent per submission: the key is the deliverable id plus how many
// decisions it already carries, so a retried request sends nothing new while a
// revision resubmitted after "Reject" is a new email. The key is claimed in
// email_notifications before sending and is also Resend's Idempotency-Key, which
// still dedupes for 24 hours when that table has not been migrated yet.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ServerEnv } from "./config.js";
import { serviceClient, serviceRoleConfigured } from "./service.js";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Sent as Resend's Idempotency-Key: a repeat with the same key is not delivered again. */
  idempotencyKey: string;
}

export class EmailSendError extends Error {
  /** HTTP status and Resend's error name, e.g. 409 "concurrent_idempotent_requests". */
  constructor(message: string, readonly status: number, readonly providerCode: string | null) {
    super(message);
  }
}

export type EmailSender = (message: EmailMessage) => Promise<{ id: string | null }>;

export const RESEND_ENDPOINT = "https://api.resend.com/emails";
export const DEFAULT_EMAIL_FROM = "AgentExchange <notifications@agentsexchange.ai>";

/** Resend over plain fetch; no SDK, so nothing new ships in the function bundle. */
export function resendSender(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailSender {
  return async (message) => {
    const res = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": message.idempotencyKey,
      },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      signal: AbortSignal.timeout(10_000),
    });
    type ResendBody = { id?: unknown; name?: unknown } | null;
    let body: ResendBody = null;
    try {
      body = (await res.json()) as ResendBody;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const name = typeof body?.name === "string" ? body.name : null;
      throw new EmailSendError(`resend answered ${res.status}${name ? ` (${name})` : ""}`, res.status, name);
    }
    return { id: typeof body?.id === "string" ? body.id : null };
  };
}

export type DeliverableNotice =
  | { status: "sent"; key: string }
  | {
      status: "skipped";
      reason: "no_api_key" | "no_service_role" | "not_found" | "not_submitted" | "no_recipient" | "already_sent" | "in_flight";
    }
  | { status: "failed"; reason: string };

/** Who asked; logged with the outcome so a missing email can be traced to its path. */
export type NoticeSource = "mcp" | "browser";

export interface NotifierDeps {
  /** RESEND_API_KEY; unset turns the notifier into a logged no-op. */
  apiKey?: string;
  from?: string;
  appUrl: string;
  /** The service-role client, or null when SUPABASE_SERVICE_ROLE_KEY is not set. */
  db: () => SupabaseClient | null;
  /** Overrides the Resend sender (tests). */
  send?: EmailSender;
  log?: (line: string) => void;
}

type Row = Record<string, unknown>;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** One line for a subject or a label: no line breaks, bounded length. */
const oneLine = (value: string, max = 120) => {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export function deliverableSubmittedEmail(input: {
  to: string;
  key: string;
  contractTitle: string;
  deliverableTitle: string;
  agentName: string | null;
  contractUrl: string;
}): EmailMessage {
  const contract = oneLine(input.contractTitle) || "your contract";
  const deliverable = oneLine(input.deliverableTitle) || "Untitled deliverable";
  const who = input.agentName ? oneLine(input.agentName, 80) : "Your agent";
  const text = [
    `${who} submitted a deliverable on your AgentExchange contract.`,
    "",
    `Contract: ${contract}`,
    `Deliverable: ${deliverable}`,
    "",
    "Review it on the contract page, then approve it or send it back with a note:",
    input.contractUrl,
    "",
    "You are receiving this because you own the organization on this contract.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px">
<p style="margin:0 0 16px;font-size:15px;line-height:22px">${escapeHtml(who)} submitted a deliverable on your AgentExchange contract.</p>
<table role="presentation" style="border-collapse:collapse;margin:0 0 20px;font-size:14px;line-height:20px">
<tr><td style="padding:2px 12px 2px 0;color:#6b7280">Contract</td><td style="padding:2px 0;font-weight:600">${escapeHtml(contract)}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#6b7280">Deliverable</td><td style="padding:2px 0;font-weight:600">${escapeHtml(deliverable)}</td></tr>
</table>
<p style="margin:0 0 20px"><a href="${escapeHtml(input.contractUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:8px">Review the deliverable</a></p>
<p style="margin:0;font-size:12px;line-height:18px;color:#6b7280">Approve it or send it back with a note on the contract page. You are receiving this because you own the organization on this contract.</p>
</div></body></html>`;
  return { to: input.to, subject: `New deliverable: ${deliverable} — ${contract}`, text, html, idempotencyKey: input.key };
}

/** The claim table is missing until its migration is applied; the provider key still dedupes. */
const isMissingTable = (error: { code?: string; message?: string }) =>
  error.code === "42P01" || error.code === "PGRST205" || (/email_notifications/.test(error.message ?? "") && /does not exist|schema cache/.test(error.message ?? ""));

async function ownerEmail(db: SupabaseClient, organizationId: string): Promise<string | null> {
  const { data: org } = await db.from("organizations").select("owner_id").eq("id", organizationId).maybeSingle();
  const ownerId = (org as Row | null)?.owner_id as string | undefined;
  if (!ownerId) return null;
  const { data: profile } = await db.from("profiles").select("email,user_id").eq("id", ownerId).maybeSingle();
  const email = (profile as Row | null)?.email;
  if (typeof email === "string" && email.includes("@")) return email;
  // profiles.email is copied at sign-up; the auth record is the fallback.
  const userId = (profile as Row | null)?.user_id;
  const admin = (db as { auth?: { admin?: { getUserById?: (id: string) => Promise<{ data: { user: { email?: string } | null } }> } } }).auth?.admin;
  if (typeof userId === "string" && admin?.getUserById) {
    const { data } = await admin.getUserById(userId);
    if (data.user?.email) return data.user.email;
  }
  return null;
}

export function deliverableNotifier(deps: NotifierDeps) {
  const log = deps.log ?? ((line: string) => console.log(line));
  const warned = new Set<string>();
  const warnOnce = (what: string, line: string) => {
    if (warned.has(what)) return;
    warned.add(what);
    log(line);
  };
  // Counts and coarse reasons only: no ids, titles or addresses in shared logs.
  const outcome = (source: NoticeSource, notice: DeliverableNotice): DeliverableNotice => {
    if (notice.status !== "skipped" || (notice.reason !== "no_api_key" && notice.reason !== "no_service_role")) {
      log(JSON.stringify({ event: "deliverable_email", source, status: notice.status, ...("reason" in notice ? { reason: notice.reason } : {}) }));
    }
    return notice;
  };

  return async function notifyDeliverableSubmitted(deliverableId: string, source: NoticeSource): Promise<DeliverableNotice> {
    if (!deps.apiKey && !deps.send) {
      warnOnce("no_api_key", "deliverable emails are off: RESEND_API_KEY is not set");
      return outcome(source, { status: "skipped", reason: "no_api_key" });
    }
    const db = deps.db();
    if (!db) {
      warnOnce("no_service_role", "deliverable emails are off: SUPABASE_SERVICE_ROLE_KEY is not set");
      return outcome(source, { status: "skipped", reason: "no_service_role" });
    }
    try {
      // Never select notes: the work product has no business in an email.
      const { data: d } = await db.from("contract_deliverables").select("id,contract_id,title,status,decisions").eq("id", deliverableId).maybeSingle();
      if (!d) return outcome(source, { status: "skipped", reason: "not_found" });
      if ((d as Row).status !== "submitted") return outcome(source, { status: "skipped", reason: "not_submitted" });
      const { data: c } = await db.from("contracts").select("id,title,organization_id,agent_name").eq("id", (d as Row).contract_id as string).maybeSingle();
      const organizationId = (c as Row | null)?.organization_id as string | undefined;
      const to = c && organizationId ? await ownerEmail(db, organizationId) : null;
      if (!c || !to) return outcome(source, { status: "skipped", reason: "no_recipient" });

      const decisions = Array.isArray((d as Row).decisions) ? ((d as Row).decisions as unknown[]).length : 0;
      const key = `deliverable-submitted/${deliverableId}/${decisions}`;

      const { error: claimError } = await db.from("email_notifications").insert({ key, kind: "deliverable_submitted", deliverable_id: deliverableId });
      if (claimError) {
        if (claimError.code === "23505") {
          const { data: prior } = await db.from("email_notifications").select("sent_at").eq("key", key).maybeSingle();
          if ((prior as Row | null)?.sent_at) return outcome(source, { status: "skipped", reason: "already_sent" });
          // Claimed but never confirmed sent: send again under the same provider key.
        } else if (isMissingTable(claimError)) {
          warnOnce("no_table", "email_notifications is missing; relying on Resend's 24h idempotency key until the migration is applied");
        } else {
          log(JSON.stringify({ event: "deliverable_email", source, status: "claim_error", code: claimError.code ?? null }));
        }
      }

      const message = deliverableSubmittedEmail({
        to,
        key,
        contractTitle: String((c as Row).title ?? ""),
        deliverableTitle: String((d as Row).title ?? ""),
        agentName: typeof (c as Row).agent_name === "string" ? ((c as Row).agent_name as string) : null,
        contractUrl: `${deps.appUrl.replace(/\/$/, "")}/contracts/${(c as Row).id as string}`,
      });
      const send = deps.send ?? resendSender(deps.apiKey!, deps.from ?? DEFAULT_EMAIL_FROM);
      let sent: { id: string | null };
      try {
        sent = await send(message);
      } catch (e) {
        if (e instanceof EmailSendError && e.providerCode === "concurrent_idempotent_requests") {
          return outcome(source, { status: "skipped", reason: "in_flight" });
        }
        return outcome(source, { status: "failed", reason: e instanceof EmailSendError ? `provider_${e.status}` : "unreachable" });
      }
      if (!claimError || claimError.code === "23505") {
        await db.from("email_notifications").update({ sent_at: new Date().toISOString(), provider_id: sent.id }).eq("key", key);
      }
      return outcome(source, { status: "sent", key });
    } catch {
      return outcome(source, { status: "failed", reason: "lookup" });
    }
  };
}

export function notifierFromEnv(env: Record<string, string | undefined> = process.env): NotifierDeps {
  return {
    apiKey: env.RESEND_API_KEY?.trim() || undefined,
    from: env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM,
    appUrl: (env.APP_URL ?? "https://www.agentsexchange.ai").replace(/\/$/, ""),
    db: () => (serviceRoleConfigured(env) ? serviceClient(env) : null),
  };
}

let shared: ReturnType<typeof deliverableNotifier> | null = null;

/** The process-wide notifier, so "logs once" holds across requests on a warm instance. Never throws. */
export function notifyDeliverableSubmitted(deliverableId: string, source: NoticeSource): Promise<DeliverableNotice> {
  shared ??= deliverableNotifier(notifierFromEnv());
  return shared(deliverableId, source);
}

/** Can the caller (a signed-in browser session) see this deliverable? RLS answers. */
export async function callerCanSeeDeliverable(env: ServerEnv, accessToken: string, deliverableId: string): Promise<boolean> {
  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await client.from("contract_deliverables").select("id").eq("id", deliverableId).maybeSingle();
  return !error && Boolean(data);
}

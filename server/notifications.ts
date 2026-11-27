// Owner emails: the server-side path that tells an organization's owner when
// something on a contract needs them.
//
//   * deliverable submitted: an agent submitted work to review. Called from the
//     MCP submit_deliverable tool and from /api/notifications after a browser
//     submit. Names the contract and the deliverable and links to the contract
//     page; it never carries the work itself (the deliverable body is not even
//     read).
//   * contract accepted: the seller accepted the buyer's hire request (a "Buy"
//     on a fixed-price listing is one) or the buyer's counter, so a contract now
//     waits for the buyer to fund it. Called from the MCP respond_to_hire_request
//     and respond_to_negotiation tools and from /api/notifications after a web
//     accept. When the buyer made the final move they already know, so nothing
//     is sent; that is decided from stored state, never from the caller.
//
// Everything is read back from the database with the service role, so a caller
// can only ever trigger an email the stored state already calls for.
//
// Without RESEND_API_KEY this is a no-op that logs once per instance, so the
// product runs unchanged until the owner adds the key.
//
// Each email has an idempotency key, claimed in email_notifications before
// sending and also sent as Resend's Idempotency-Key, which still dedupes for 24
// hours when that table has not been migrated yet. A deliverable's key is its id
// plus how many decisions it already carries, so a retried request sends nothing
// new while a revision resubmitted after "Reject" is a new email. A contract's
// key is its id: one acceptance email per contract.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { formatCents } from "../src/lib/money.js";
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

export type SkipReason =
  | "no_api_key"
  | "no_service_role"
  | "payments_off"
  | "not_found"
  | "not_submitted"
  | "buyer_accepted"
  | "not_awaiting_funding"
  | "stale"
  | "no_recipient"
  | "already_sent"
  | "in_flight";

export type Notice = { status: "sent"; key: string } | { status: "skipped"; reason: SkipReason } | { status: "failed"; reason: string };
export type DeliverableNotice = Notice;
export type ContractNotice = Notice;

/** Who asked; logged with the outcome so a missing email can be traced to its path. */
export type NoticeSource = "mcp" | "browser";

export interface NotifierDeps {
  /** RESEND_API_KEY; unset turns the notifier into a logged no-op. */
  apiKey?: string;
  from?: string;
  appUrl: string;
  /** Stripe is configured, so a buyer can fund a contract. The acceptance email asks them to. */
  paymentsEnabled?: boolean;
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

export function contractAcceptedEmail(input: {
  to: string;
  key: string;
  contractTitle: string;
  agentName: string | null;
  /** The agreed price, already formatted ("$250"). */
  price: string;
  contractUrl: string;
}): EmailMessage {
  const title = oneLine(input.contractTitle) || "your request";
  const who = input.agentName ? oneLine(input.agentName, 80) : "Your agent";
  const lead = `${who} accepted your request for ${title} at ${input.price}.`;
  // The same terms the contract page's funding panel states.
  const terms =
    "Funding places a hold on your card for that price plus the service fee. The hold is captured when you approve the work, or automatically at the review deadline if you don't respond. Until then nothing is charged. A card hold lasts about seven days.";
  const text = [
    lead,
    "",
    terms,
    "",
    "Fund the contract:",
    input.contractUrl,
    "",
    "You are receiving this because you own the organization on this contract.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px">
<p style="margin:0 0 16px;font-size:15px;line-height:22px">${escapeHtml(lead)}</p>
<p style="margin:0 0 20px;font-size:14px;line-height:20px;color:#374151">${escapeHtml(terms)}</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(input.contractUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:8px">Fund the contract</a></p>
<p style="margin:0;font-size:12px;line-height:18px;color:#6b7280">You are receiving this because you own the organization on this contract.</p>
</div></body></html>`;
  return { to: input.to, subject: `${who} accepted your request for ${title}`, text, html, idempotencyKey: input.key };
}

/** The claim table is missing until its migration is applied; the provider key still dedupes. */
const isMissingTable = (error: { code?: string; message?: string }) =>
  error.code === "42P01" || error.code === "PGRST205" || (/email_notifications/.test(error.message ?? "") && /does not exist|schema cache/.test(error.message ?? ""));

/** organization_owner_email() does not exist until the email_notifications migration is applied. */
const isMissingFunction = (error: { code?: string }) => error.code === "PGRST202" || error.code === "42883";

async function ownerEmail(db: SupabaseClient, organizationId: string): Promise<string | null> {
  const { data: resolved, error } = await db.rpc("organization_owner_email", { org_id: organizationId });
  if (!error) return typeof resolved === "string" && resolved.includes("@") ? resolved : null;
  if (!isMissingFunction(error)) return null;
  // Before the migration: production's older blanket grants still allow reading
  // the owner's profile directly. A fresh project has no such grant.
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

type EmailKind = "deliverable_submitted" | "contract_accepted";

const EMAIL_LABEL: Record<EmailKind, { event: string; off: string }> = {
  deliverable_submitted: { event: "deliverable_email", off: "deliverable emails" },
  contract_accepted: { event: "contract_accepted_email", off: "order-accepted emails" },
};

/**
 * What both emails share: the off switches, outcome logging, and the
 * claim-send-confirm sequence against email_notifications.
 */
function emailPipeline(deps: NotifierDeps, kind: EmailKind) {
  const log = deps.log ?? ((line: string) => console.log(line));
  const { event, off } = EMAIL_LABEL[kind];
  const warned = new Set<string>();
  const warnOnce = (what: string, line: string) => {
    if (warned.has(what)) return;
    warned.add(what);
    log(line);
  };
  const quiet: SkipReason[] = ["no_api_key", "no_service_role", "payments_off"];
  // Counts and coarse reasons only: no ids, titles or addresses in shared logs.
  const outcome = (source: NoticeSource, notice: Notice): Notice => {
    if (notice.status !== "skipped" || !quiet.includes(notice.reason)) {
      log(JSON.stringify({ event, source, status: notice.status, ...("reason" in notice ? { reason: notice.reason } : {}) }));
    }
    return notice;
  };

  /** The service-role client, or the skip that explains why there is none. */
  const open = (): SupabaseClient | Notice => {
    if (!deps.apiKey && !deps.send) {
      warnOnce("no_api_key", `${off} are off: RESEND_API_KEY is not set`);
      return { status: "skipped", reason: "no_api_key" };
    }
    const db = deps.db();
    if (!db) {
      warnOnce("no_service_role", `${off} are off: SUPABASE_SERVICE_ROLE_KEY is not set`);
      return { status: "skipped", reason: "no_service_role" };
    }
    return db;
  };

  /** Claim the key, send, then record the send. A claimed-but-unsent key is sent again under the same provider key. */
  const deliver = async (db: SupabaseClient, source: NoticeSource, refs: Row, message: EmailMessage): Promise<Notice> => {
    const key = message.idempotencyKey;
    const { error: claimError } = await db.from("email_notifications").insert({ key, kind, ...refs });
    if (claimError) {
      if (claimError.code === "23505") {
        const { data: prior } = await db.from("email_notifications").select("sent_at").eq("key", key).maybeSingle();
        if ((prior as Row | null)?.sent_at) return outcome(source, { status: "skipped", reason: "already_sent" });
      } else if (isMissingTable(claimError)) {
        warnOnce("no_table", "email_notifications is missing; relying on Resend's 24h idempotency key until the migration is applied");
      } else {
        log(JSON.stringify({ event, source, status: "claim_error", code: claimError.code ?? null }));
      }
    }
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
  };

  return { outcome, open, deliver, warnOnce };
}

const contractUrl = (deps: NotifierDeps, contractId: string) => `${deps.appUrl.replace(/\/$/, "")}/contracts/${contractId}`;

export function deliverableNotifier(deps: NotifierDeps) {
  const pipe = emailPipeline(deps, "deliverable_submitted");

  return async function notifyDeliverableSubmitted(deliverableId: string, source: NoticeSource): Promise<Notice> {
    const db = pipe.open();
    if ("status" in db) return pipe.outcome(source, db);
    try {
      // Never select notes: the work product has no business in an email.
      const { data: d } = await db.from("contract_deliverables").select("id,contract_id,title,status,decisions").eq("id", deliverableId).maybeSingle();
      if (!d) return pipe.outcome(source, { status: "skipped", reason: "not_found" });
      if ((d as Row).status !== "submitted") return pipe.outcome(source, { status: "skipped", reason: "not_submitted" });
      const { data: c } = await db.from("contracts").select("id,title,organization_id,agent_name").eq("id", (d as Row).contract_id as string).maybeSingle();
      const organizationId = (c as Row | null)?.organization_id as string | undefined;
      const to = c && organizationId ? await ownerEmail(db, organizationId) : null;
      if (!c || !to) return pipe.outcome(source, { status: "skipped", reason: "no_recipient" });

      const decisions = Array.isArray((d as Row).decisions) ? ((d as Row).decisions as unknown[]).length : 0;
      const message = deliverableSubmittedEmail({
        to,
        key: `deliverable-submitted/${deliverableId}/${decisions}`,
        contractTitle: String((c as Row).title ?? ""),
        deliverableTitle: String((d as Row).title ?? ""),
        agentName: typeof (c as Row).agent_name === "string" ? ((c as Row).agent_name as string) : null,
        contractUrl: contractUrl(deps, (c as Row).id as string),
      });
      return await pipe.deliver(db, source, { deliverable_id: deliverableId }, message);
    } catch {
      return pipe.outcome(source, { status: "failed", reason: "lookup" });
    }
  };
}

/** An acceptance email goes out while the acceptance is news, not for an old contract. */
export const CONTRACT_ACCEPTED_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Did the seller make the move that created this contract? A hire request is
 * the buyer's offer and only the agent can accept it; a negotiation records who
 * accepted in accepted_by, which the database sets and a caller cannot. An
 * application is accepted by the organization, a renewal is not an acceptance.
 */
async function sellerClosed(db: SupabaseClient, contract: Row): Promise<boolean> {
  if (contract.source_type === "hire-request") return true;
  if (contract.source_type !== "negotiation" || typeof contract.source_id !== "string") return false;
  const { data: negotiation } = await db.from("negotiations").select("accepted_by").eq("id", contract.source_id).maybeSingle();
  return (negotiation as Row | null)?.accepted_by === "agent";
}

export function contractAcceptedNotifier(deps: NotifierDeps, now: () => number = Date.now) {
  const pipe = emailPipeline(deps, "contract_accepted");

  return async function notifyContractAccepted(contractId: string, source: NoticeSource): Promise<Notice> {
    if (!deps.paymentsEnabled) {
      // Asking a buyer to fund a contract the product cannot take payment for helps no one.
      pipe.warnOnce("payments_off", "order-accepted emails are off: payments are not configured");
      return pipe.outcome(source, { status: "skipped", reason: "payments_off" });
    }
    const db = pipe.open();
    if ("status" in db) return pipe.outcome(source, db);
    try {
      const { data: c } = await db
        .from("contracts")
        .select("id,title,organization_id,agent_name,source_type,source_id,status,payment_status,amount_cents,currency,created_at")
        .eq("id", contractId)
        .maybeSingle();
      if (!c) return pipe.outcome(source, { status: "skipped", reason: "not_found" });
      const contract = c as Row;
      if (!(await sellerClosed(db, contract))) return pipe.outcome(source, { status: "skipped", reason: "buyer_accepted" });
      const amountCents = contract.amount_cents;
      if (contract.status !== "Active" || contract.payment_status !== "unfunded" || typeof amountCents !== "number" || amountCents <= 0) {
        return pipe.outcome(source, { status: "skipped", reason: "not_awaiting_funding" });
      }
      const created = Date.parse(String(contract.created_at ?? ""));
      if (!Number.isFinite(created) || now() - created > CONTRACT_ACCEPTED_WINDOW_MS) {
        return pipe.outcome(source, { status: "skipped", reason: "stale" });
      }
      const organizationId = contract.organization_id as string | undefined;
      const to = organizationId ? await ownerEmail(db, organizationId) : null;
      if (!to) return pipe.outcome(source, { status: "skipped", reason: "no_recipient" });

      const message = contractAcceptedEmail({
        to,
        key: `contract-accepted/${contractId}`,
        contractTitle: String(contract.title ?? ""),
        agentName: typeof contract.agent_name === "string" ? contract.agent_name : null,
        price: formatCents(amountCents, typeof contract.currency === "string" ? contract.currency : "USD"),
        contractUrl: contractUrl(deps, contractId),
      });
      return await pipe.deliver(db, source, { contract_id: contractId }, message);
    } catch {
      return pipe.outcome(source, { status: "failed", reason: "lookup" });
    }
  };
}

export function notifierFromEnv(env: Record<string, string | undefined> = process.env): NotifierDeps {
  return {
    apiKey: env.RESEND_API_KEY?.trim() || undefined,
    from: env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM,
    appUrl: (env.APP_URL ?? "https://www.agentsexchange.ai").replace(/\/$/, ""),
    // The same test as readServerEnv's paymentsEnabled.
    paymentsEnabled: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.SUPABASE_SERVICE_ROLE_KEY),
    db: () => (serviceRoleConfigured(env) ? serviceClient(env) : null),
  };
}

let shared: ReturnType<typeof deliverableNotifier> | null = null;
let sharedAccepted: ReturnType<typeof contractAcceptedNotifier> | null = null;

/** The process-wide notifier, so "logs once" holds across requests on a warm instance. Never throws. */
export function notifyDeliverableSubmitted(deliverableId: string, source: NoticeSource): Promise<Notice> {
  shared ??= deliverableNotifier(notifierFromEnv());
  return shared(deliverableId, source);
}

/** The process-wide acceptance notifier. Never throws. */
export function notifyContractAccepted(contractId: string, source: NoticeSource): Promise<Notice> {
  sharedAccepted ??= contractAcceptedNotifier(notifierFromEnv());
  return sharedAccepted(contractId, source);
}

function callerClient(env: ServerEnv, accessToken: string) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Can the caller (a signed-in browser session) see this deliverable? RLS answers. */
export async function callerCanSeeDeliverable(env: ServerEnv, accessToken: string, deliverableId: string): Promise<boolean> {
  const { data, error } = await callerClient(env, accessToken).from("contract_deliverables").select("id").eq("id", deliverableId).maybeSingle();
  return !error && Boolean(data);
}

/** Can the caller see this contract? RLS answers. */
export async function callerCanSeeContract(env: ServerEnv, accessToken: string, contractId: string): Promise<boolean> {
  const { data, error } = await callerClient(env, accessToken).from("contracts").select("id").eq("id", contractId).maybeSingle();
  return !error && Boolean(data);
}

// "Download my data": one JSON file with what AgentExchange holds for the
// signed-in account. Every table is read through the caller's own session, so
// Row Level Security decides exactly what is included, the same rows the app
// itself can show them. The one exception is agent webhooks, which are
// service-only tables; those are read by the caller's profile id, without the
// signing secret.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { WEBHOOK_STATUS_COLUMNS } from "./agentWebhooks.js";

export const EXPORT_FORMAT = "agentexchange-account-export";
export const EXPORT_VERSION = 1;
/** Vercel refuses a function response over 4.5 MB; stay under it. */
export const EXPORT_MAX_BYTES = 4_000_000;

const PAGE = 1000;
const MAX_PAGES = 10;
const ID_CHUNK = 100;

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string } | null };
type Scope = "user" | "profile" | "contracts";

interface Section {
  name: string;
  table: string;
  /** Explicit where a column is a secret or a credential; "*" otherwise. */
  columns: string;
  scope: Scope;
  column: string;
  order: string[];
}

// Rows the account owns directly.
const OWNED: Section[] = [
  { name: "organizations", table: "organizations", columns: "*", scope: "profile", column: "owner_id", order: ["created_at", "id"] },
  { name: "agents", table: "agents", columns: "*", scope: "profile", column: "owner_id", order: ["created_at", "id"] },
  { name: "opportunities", table: "opportunities", columns: "*", scope: "profile", column: "owner_id", order: ["created_at", "id"] },
  { name: "applications", table: "applications", columns: "*", scope: "profile", column: "owner_id", order: ["created_at", "id"] },
  { name: "negotiations", table: "negotiations", columns: "*", scope: "profile", column: "owner_id", order: ["created_at", "id"] },
  { name: "hire_requests", table: "hire_requests", columns: "*", scope: "profile", column: "owner_id", order: ["created_at", "id"] },
  { name: "saved_opportunities", table: "saved_opportunities", columns: "*", scope: "profile", column: "owner_id", order: ["created_at", "id"] },
  { name: "activity_events", table: "activity_events", columns: "*", scope: "profile", column: "owner_id", order: ["created_at", "id"] },
  // The key itself is never stored; the hash is left out as well.
  { name: "agent_api_keys", table: "agent_api_keys", columns: "id,name,key_prefix,created_at,last_used_at,revoked_at,can_spend,allowed_actions,organization_ids,paused_at", scope: "profile", column: "profile_id", order: ["created_at", "id"] },
  { name: "billing_accounts", table: "billing_accounts", columns: "*", scope: "profile", column: "profile_id", order: ["profile_id"] },
  // setup_token is a one-use credential for the card setup link.
  { name: "agent_payment_cards", table: "agent_payment_cards", columns: "key_id,mode,payment_method_id,card_brand,card_last4,updated_at", scope: "profile", column: "profile_id", order: ["updated_at", "key_id"] },
  { name: "seller_accounts", table: "seller_accounts", columns: "*", scope: "profile", column: "profile_id", order: ["profile_id"] },
  { name: "seller_bank_payouts", table: "seller_bank_payouts", columns: "*", scope: "profile", column: "profile_id", order: ["observed_at", "payout_id"] },
  { name: "policy_acceptances", table: "policy_acceptances", columns: "*", scope: "user", column: "user_id", order: ["accepted_at", "policy_version"] },
  { name: "account_deletion_requests", table: "account_deletion_requests", columns: "*", scope: "user", column: "user_id", order: ["requested_at", "id"] },
  { name: "content_reports", table: "content_reports", columns: "*", scope: "user", column: "user_id", order: ["created_at", "id"] },
  { name: "blocked_operators", table: "blocked_operators", columns: "*", scope: "user", column: "user_id", order: ["created_at", "target_user_id"] },
];

// Records of the contracts the account is a party to (as the organization or the agent).
const CONTRACT: Section[] = [
  { name: "contract_milestones", table: "contract_milestones", columns: "*", scope: "contracts", column: "contract_id", order: ["created_at", "id"] },
  { name: "contract_deliverables", table: "contract_deliverables", columns: "*", scope: "contracts", column: "contract_id", order: ["created_at", "id"] },
  { name: "contract_messages", table: "contract_messages", columns: "*", scope: "contracts", column: "contract_id", order: ["created_at", "id"] },
  { name: "deliverable_gate_events", table: "deliverable_gate_events", columns: "*", scope: "contracts", column: "contract_id", order: ["created_at", "id"] },
  { name: "reviews", table: "reviews", columns: "*", scope: "contracts", column: "contract_id", order: ["created_at", "id"] },
  { name: "disputes", table: "disputes", columns: "*", scope: "contracts", column: "contract_id", order: ["created_at", "id"] },
  { name: "payments", table: "payments", columns: "*", scope: "contracts", column: "contract_id", order: ["created_at", "id"] },
  { name: "payouts", table: "payouts", columns: "*", scope: "contracts", column: "contract_id", order: ["created_at", "id"] },
];

export const EXPORT_SECTIONS = [...OWNED.map((s) => s.name), "contracts", ...CONTRACT.map((s) => s.name), "agent_webhooks"];

export const NOT_INCLUDED = [
  "Full card numbers and bank account details. Stripe holds them; AgentExchange keeps only payment identifiers and card summaries.",
  "Agent API keys and webhook signing secrets. Keys are shown once when created and only a prefix is kept; webhook settings are included without the secret.",
  "Other people's records outside your contracts, such as their listings, briefs and applications.",
];

export interface AccountExport {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exported_at: string;
  account: Row;
  profile: Row | null;
  data: Record<string, Row[]>;
  /** Sections cut off at the row limit. */
  truncated: string[];
  /** Sections that could not be read, so the file never silently claims to be complete. */
  unavailable: { section: string; reason: string }[];
  not_included: string[];
}

/** The sign-in account itself, from Supabase Auth. */
export function accountSummary(user: User): Row {
  const providers = new Set<string>();
  for (const identity of user.identities ?? []) if (identity.provider) providers.add(identity.provider);
  const fromMetadata: unknown = user.app_metadata?.providers;
  if (Array.isArray(fromMetadata)) for (const p of fromMetadata) if (typeof p === "string") providers.add(p);
  return {
    id: user.id,
    email: user.email ?? null,
    pending_email: user.new_email ?? null,
    phone: user.phone || null,
    created_at: user.created_at ?? null,
    updated_at: user.updated_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    sign_in_methods: [...providers].sort(),
    user_metadata: user.user_metadata ?? {},
  };
}

type Query = PromiseLike<Result> & { range: (from: number, to: number) => PromiseLike<Result> };

/** Reads every page up to the row limit. */
async function readPaged(make: () => Query): Promise<{ rows: Row[]; truncated: boolean; error: string | null }> {
  const rows: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await make().range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) return { rows, truncated: false, error: error.message };
    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, truncated: false, error: null };
  }
  return { rows, truncated: true, error: null };
}

function query(client: SupabaseClient, section: Section, filter: (q: any) => any): () => Query {
  return () => {
    let q = filter(client.from(section.table).select(section.columns));
    for (const col of section.order) q = q.order(col, { ascending: true });
    return q as Query;
  };
}

function chunks<T>(items: T[], size = ID_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Rows whose `column` is one of `ids`, de-duplicated on `key` when given. */
async function readByIds(client: SupabaseClient, section: Section, ids: string[], key?: string) {
  const rows: Row[] = [];
  let truncated = false;
  for (const part of chunks(ids)) {
    const r = await readPaged(query(client, section, (q) => q.in(section.column, part)));
    if (r.error) return { rows, truncated, error: r.error };
    rows.push(...r.rows);
    truncated ||= r.truncated;
  }
  if (!key) return { rows, truncated, error: null };
  const seen = new Set<unknown>();
  return { rows: rows.filter((r) => (seen.has(r[key]) ? false : (seen.add(r[key]), true))), truncated, error: null };
}

const reason = (message: string) => (/permission denied|not allowed|42501/i.test(message) ? "not readable with your sign-in" : "could not be read");

export async function buildAccountExport(
  input: { client: SupabaseClient; service?: SupabaseClient | null; user: User; profileId: string },
  now: () => Date = () => new Date(),
): Promise<AccountExport> {
  const { client, user, profileId } = input;
  const out: AccountExport = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exported_at: now().toISOString(),
    account: accountSummary(user),
    profile: null,
    data: {},
    truncated: [],
    unavailable: [],
    not_included: NOT_INCLUDED,
  };
  const record = (name: string, r: { rows: Row[]; truncated: boolean; error: string | null }) => {
    out.data[name] = r.rows;
    if (r.truncated) out.truncated.push(name);
    if (r.error) out.unavailable.push({ section: name, reason: reason(r.error) });
  };

  const profile = await client.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (profile.error) out.unavailable.push({ section: "profile", reason: reason(profile.error.message) });
  out.profile = (profile.data as Row | null) ?? null;

  for (const section of OWNED) {
    const value = section.scope === "user" ? user.id : profileId;
    record(section.name, await readPaged(query(client, section, (q) => q.eq(section.column, value))));
  }

  // Contracts on the account's organizations and agents.
  const orgIds = (out.data.organizations ?? []).map((r) => r.id).filter((v): v is string => typeof v === "string");
  const agentIds = (out.data.agents ?? []).map((r) => r.id).filter((v): v is string => typeof v === "string");
  const contractSection: Section = { name: "contracts", table: "contracts", columns: "*", scope: "contracts", column: "organization_id", order: ["created_at", "id"] };
  const asOrg = await readByIds(client, contractSection, orgIds);
  const asAgent = await readByIds(client, { ...contractSection, column: "agent_id" }, agentIds);
  const seen = new Set<unknown>();
  const contracts = [...asOrg.rows, ...asAgent.rows].filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  record("contracts", { rows: contracts, truncated: asOrg.truncated || asAgent.truncated, error: asOrg.error ?? asAgent.error });
  const contractIds = contracts.map((r) => r.id).filter((v): v is string => typeof v === "string");
  for (const section of CONTRACT) record(section.name, await readByIds(client, section, contractIds));

  if (input.service) {
    const { data, error } = await input.service.from("agent_webhooks").select(WEBHOOK_STATUS_COLUMNS).eq("profile_id", profileId);
    record("agent_webhooks", { rows: (data ?? []) as unknown as Row[], truncated: false, error: error?.message ?? null });
  } else {
    out.data.agent_webhooks = [];
    out.unavailable.push({ section: "agent_webhooks", reason: "could not be read" });
  }
  return out;
}

export function exportFileName(exportedAt: string): string {
  return `agentexchange-data-${exportedAt.slice(0, 10)}.json`;
}

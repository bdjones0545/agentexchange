// The rest of the platform owner's review queue, next to listing review
// (/owner/moderation): open disputes and account deletion requests. Both are
// read with the service role behind the same owner gate as listings.
//
// Disputes: only the side that opened one can resolve it, so a dispute can
// stall. Bryan's rule (2026-11-26): when it has had no activity for 7 days,
// AgentExchange reviews the contract and decides. This lists every open
// dispute with how long it has been quiet and flags the ones due for review.
//
// Deletion requests: an account with marketplace or payment history can't be
// deleted at once (account_deletion_ready), so it waits here. The owner moves it
// to processing or completed and writes the response its owner sees on the
// account page.
import type { SupabaseClient } from "@supabase/supabase-js";

export const DISPUTE_REVIEW_DAYS = 7;
const DAY = 86_400_000;

export interface DisputeItem {
  id: string;
  contractId: string;
  contractTitle: string;
  organization: string;
  agent: string;
  amountCents: number | null;
  paymentStatus: string;
  status: string;
  reason: string;
  openedBy: "organization" | "agent" | "unknown";
  openedAt: string;
  lastActivityAt: string;
  quietDays: number;
  dueForReview: boolean;
}

export interface DeletionItem {
  id: string;
  email: string | null;
  name: string | null;
  status: "requested" | "processing" | "completed";
  requestedAt: string;
  updatedAt: string;
  response: string;
  /** True when nothing must be kept any more, so the account could be deleted outright. */
  deletableNow: boolean | null;
}

type DisputeRow = { id: string; contract_id: string; owner_id: string | null; reason: string; status: string; created_at: string; updated_at: string };
type ContractRow = { id: string; title: string; organization_name: string; agent_name: string; amount_cents: number | null; payment_status: string; organization_id: string | null; agent_id: string | null };

const latest = (...dates: Array<string | null | undefined>) =>
  dates.filter((d): d is string => Boolean(d)).sort().pop() ?? new Date(0).toISOString();

/** Open disputes, the ones due for review first, then the longest quiet. */
export async function loadDisputes(db: SupabaseClient, now = Date.now()): Promise<DisputeItem[]> {
  const { data, error } = await db.from("disputes").select("id,contract_id,owner_id,reason,status,created_at,updated_at").neq("status", "Resolved");
  if (error) throw new Error("Could not read disputes");
  const disputes = (data ?? []) as DisputeRow[];
  if (!disputes.length) return [];
  const contractIds = [...new Set(disputes.map((d) => d.contract_id))];
  const { data: contracts, error: contractError } = await db
    .from("contracts").select("id,title,organization_name,agent_name,amount_cents,payment_status,organization_id,agent_id").in("id", contractIds);
  if (contractError) throw new Error("Could not read disputed contracts");
  const byId = new Map(((contracts ?? []) as ContractRow[]).map((c) => [c.id, c]));
  const { data: messages, error: messageError } = await db.from("contract_messages").select("contract_id,created_at").in("contract_id", contractIds);
  if (messageError) throw new Error("Could not read contract messages");
  const lastMessage = new Map<string, string>();
  for (const m of (messages ?? []) as Array<{ contract_id: string; created_at: string }>) {
    lastMessage.set(m.contract_id, latest(lastMessage.get(m.contract_id), m.created_at));
  }
  const orgIds = [...new Set([...byId.values()].map((c) => c.organization_id).filter((id): id is string => Boolean(id)))];
  const orgOwners = new Map<string, string | null>();
  if (orgIds.length) {
    const { data: orgs, error: orgError } = await db.from("organizations").select("id,owner_id").in("id", orgIds);
    if (orgError) throw new Error("Could not read organizations");
    for (const o of (orgs ?? []) as Array<{ id: string; owner_id: string | null }>) orgOwners.set(o.id, o.owner_id);
  }
  const items = disputes.map((d): DisputeItem => {
    const c = byId.get(d.contract_id);
    const lastActivityAt = latest(d.created_at, d.updated_at, lastMessage.get(d.contract_id));
    const quietDays = Math.max(0, Math.floor((now - new Date(lastActivityAt).getTime()) / DAY));
    const orgOwner = c?.organization_id ? orgOwners.get(c.organization_id) : null;
    return {
      id: d.id,
      contractId: d.contract_id,
      contractTitle: c?.title ?? "Contract",
      organization: c?.organization_name ?? "Organization",
      agent: c?.agent_name ?? "Agent",
      amountCents: c?.amount_cents ?? null,
      paymentStatus: c?.payment_status ?? "unknown",
      status: d.status,
      reason: d.reason,
      openedBy: d.owner_id && orgOwner && d.owner_id === orgOwner ? "organization" : d.owner_id && c ? "agent" : "unknown",
      openedAt: d.created_at,
      lastActivityAt,
      quietDays,
      dueForReview: quietDays >= DISPUTE_REVIEW_DAYS,
    };
  });
  return items.sort((a, b) => Number(b.dueForReview) - Number(a.dueForReview) || b.quietDays - a.quietDays);
}

type DeletionRow = { id: string; user_id: string; status: DeletionItem["status"]; requested_at: string; updated_at: string; response: string };

/** Deletion requests not yet completed, oldest first, with whether each account could now go outright. */
export async function loadDeletionRequests(db: SupabaseClient): Promise<DeletionItem[]> {
  const { data, error } = await db
    .from("account_deletion_requests").select("id,user_id,status,requested_at,updated_at,response")
    .neq("status", "completed").order("requested_at", { ascending: true });
  if (error) throw new Error("Could not read deletion requests");
  const rows = (data ?? []) as DeletionRow[];
  if (!rows.length) return [];
  const { data: profiles, error: profileError } = await db.from("profiles").select("id,user_id,email,display_name").in("user_id", rows.map((r) => r.user_id));
  if (profileError) throw new Error("Could not read accounts");
  const byUser = new Map(((profiles ?? []) as Array<{ id: string; user_id: string; email: string | null; display_name: string | null }>).map((p) => [p.user_id, p]));
  const items: DeletionItem[] = [];
  for (const r of rows) {
    const p = byUser.get(r.user_id);
    let deletableNow: boolean | null = null;
    if (p) {
      const { data: ready, error: readyError } = await db.rpc("account_deletion_ready", { target: p.id });
      deletableNow = readyError ? null : ready === true;
    }
    items.push({ id: r.id, email: p?.email ?? null, name: p?.display_name ?? null, status: r.status, requestedAt: r.requested_at, updatedAt: r.updated_at, response: r.response, deletableNow });
  }
  return items;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DeletionUpdate = { deletionRequestId: string; status: "processing" | "completed"; response: string };

/** An owner's update to a deletion request, or null when the body is malformed. */
export function parseDeletionUpdate(body: unknown): DeletionUpdate | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.deletionRequestId !== "string" || !UUID.test(b.deletionRequestId)) return null;
  if (b.status !== "processing" && b.status !== "completed") return null;
  const response = typeof b.response === "string" ? b.response.trim() : "";
  if (response.length < 10 || response.length > 1000) return null;
  return { deletionRequestId: b.deletionRequestId, status: b.status, response };
}

/** Save the owner's update; the account's owner sees the status and response on their account page. */
export async function updateDeletionRequest(db: SupabaseClient, update: DeletionUpdate) {
  const { data, error } = await db
    .from("account_deletion_requests")
    .update({ status: update.status, response: update.response, updated_at: new Date().toISOString() })
    .eq("id", update.deletionRequestId)
    .neq("status", "completed")
    .select("id,status")
    .maybeSingle();
  if (error) throw new Error("Could not save the update");
  return (data as { id: string; status: string } | null) ?? null;
}

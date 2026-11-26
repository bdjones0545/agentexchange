// Browser side of listing review (/owner/moderation). The queue and the owner
// check live in /api/moderation; this fetches and posts with the signed-in session.
import { supabase } from "./supabase";

export type QueueItem = {
  id: string;
  name: string;
  specialty: string;
  description: string | null;
  startingRate: string | null;
  skills: string[];
  jobKinds: string[];
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string | null;
  owner: string;
};

export type DisputeItem = {
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
};

export type DeletionItem = {
  id: string;
  email: string | null;
  name: string | null;
  status: "requested" | "processing" | "completed";
  requestedAt: string;
  updatedAt: string;
  response: string;
  deletableNow: boolean | null;
};

export type ModerationQueue = { pending: QueueItem[]; rejected: QueueItem[]; disputes: DisputeItem[]; deletionRequests: DeletionItem[] };

export type QueueResult =
  | { state: "ok"; queue: ModerationQueue }
  | { state: "signed-out" }
  | { state: "not-owner" }
  | { state: "error"; message: string };

export function queueResult(status: number, body: unknown): QueueResult {
  const data = (body ?? {}) as { ok?: boolean; error?: unknown; pending?: QueueItem[]; rejected?: QueueItem[]; disputes?: DisputeItem[]; deletionRequests?: DeletionItem[] };
  if (status === 200 && data.ok) return { state: "ok", queue: { pending: data.pending ?? [], rejected: data.rejected ?? [], disputes: data.disputes ?? [], deletionRequests: data.deletionRequests ?? [] } };
  if (status === 401) return { state: "signed-out" };
  if (status === 404) return { state: "not-owner" };
  return { state: "error", message: typeof data.error === "string" ? data.error : `Request failed (${status})` };
}

async function token(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function fetchModerationQueue(): Promise<QueueResult> {
  if (!supabase) return { state: "error", message: "Supabase is not configured" };
  const t = await token();
  if (!t) return { state: "signed-out" };
  try {
    const res = await fetch("/api/moderation", { headers: { authorization: `Bearer ${t}`, accept: "application/json" } });
    return queueResult(res.status, await res.json().catch(() => ({})));
  } catch {
    return { state: "error", message: "Could not reach the server" };
  }
}

export async function decide(agentId: string, decision: "approve" | "reject"): Promise<{ ok: true } | { ok: false; message: string }> {
  const t = await token();
  if (!t) return { ok: false, message: "Sign in again" };
  try {
    const res = await fetch("/api/moderation", { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ agentId, decision }) });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return res.ok && body.ok ? { ok: true } : { ok: false, message: body.error ?? `Request failed (${res.status})` };
  } catch {
    return { ok: false, message: "Could not reach the server" };
  }
}

/** Move a deletion request to processing or completed, with the response its owner sees. */
export async function updateDeletion(id: string, status: "processing" | "completed", response: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const t = await token();
  if (!t) return { ok: false, message: "Sign in again" };
  try {
    const res = await fetch("/api/moderation", { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ deletionRequestId: id, status, response }) });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: unknown };
    return res.ok && data.ok ? { ok: true } : { ok: false, message: typeof data.error === "string" ? data.error : `Request failed (${res.status})` };
  } catch {
    return { ok: false, message: "Could not reach the server" };
  }
}

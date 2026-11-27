// Listing review: which agent listings are public.
//
// Production's database keeps a listing private until its moderation_status is
// "approved": anonymous visitors see approved listings only, signed-in users
// see approved listings plus their own. A seller's new listing starts
// "pending", and editing its name, description, price or skills sends it back
// to "pending". Only the server (service role) may change the status, so the
// platform owner reviews the queue through /api/moderation.
import type { SupabaseClient } from "@supabase/supabase-js";

export type ModerationDecision = "approve" | "reject";
export type ModerationStatus = "pending" | "approved" | "rejected";

export interface QueueItem {
  id: string;
  name: string;
  specialty: string;
  description: string | null;
  startingRate: string | null;
  sampleDeliverable: string | null;
  skills: string[];
  jobKinds: string[];
  status: ModerationStatus;
  createdAt: string;
  updatedAt: string | null;
  owner: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A POST body from the owner, or null when it is malformed. */
export function parseDecision(body: unknown): { agentId: string; decision: ModerationDecision } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.agentId !== "string" || !UUID.test(b.agentId)) return null;
  if (b.decision !== "approve" && b.decision !== "reject") return null;
  return { agentId: b.agentId, decision: b.decision };
}

type AgentRow = {
  id: string; name: string; specialty: string; description: string | null; starting_rate: string | null; sample_deliverable: string | null;
  skills: string[] | null; job_kinds: string[] | null; moderation_status: ModerationStatus;
  created_at: string; updated_at: string | null; owner_id: string | null;
};

/** Listings waiting for review (oldest first) and the ones turned down, with each seller's display name. */
export async function loadModerationQueue(db: SupabaseClient): Promise<{ pending: QueueItem[]; rejected: QueueItem[] }> {
  const { data, error } = await db
    .from("agents")
    .select("id,name,specialty,description,starting_rate,sample_deliverable,skills,job_kinds,moderation_status,created_at,updated_at,owner_id")
    .in("moderation_status", ["pending", "rejected"])
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not read listings");
  const rows = (data ?? []) as AgentRow[];
  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (ownerIds.length) {
    const { data: profiles, error: profileError } = await db.from("profiles").select("id,display_name").in("id", ownerIds);
    if (profileError) throw new Error("Could not read sellers");
    for (const p of (profiles ?? []) as Array<{ id: string; display_name: string | null }>) names.set(p.id, p.display_name ?? "Unnamed seller");
  }
  const item = (r: AgentRow): QueueItem => ({
    id: r.id,
    name: r.name,
    specialty: r.specialty,
    description: r.description,
    startingRate: r.starting_rate,
    sampleDeliverable: r.sample_deliverable ?? null,
    skills: r.skills ?? [],
    jobKinds: r.job_kinds ?? [],
    status: r.moderation_status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    owner: (r.owner_id && names.get(r.owner_id)) || "Unnamed seller",
  });
  return {
    pending: rows.filter((r) => r.moderation_status === "pending").map(item),
    rejected: rows.filter((r) => r.moderation_status === "rejected").map(item),
  };
}

/** Approve or reject one listing. Null when it does not exist. */
export async function decideListing(db: SupabaseClient, agentId: string, decision: ModerationDecision) {
  const status: ModerationStatus = decision === "approve" ? "approved" : "rejected";
  const { data, error } = await db.from("agents").update({ moderation_status: status }).eq("id", agentId).select("id,name,moderation_status").maybeSingle();
  if (error) throw new Error("Could not save the decision");
  return (data as { id: string; name: string; moderation_status: ModerationStatus } | null) ?? null;
}

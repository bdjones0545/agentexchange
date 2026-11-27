// Owner actions on their own listings and briefs, and a seller's payout history.
// Every write goes through the signed-in session; RLS and the database triggers
// decide (listing edits go back to review, only the owner can touch a brief).
import { supabase } from "../supabase";

function client() {
  if (!supabase) throw new Error("Not connected to the marketplace");
  return supabase;
}

export type ListingPatch = {
  name: string;
  specialty: string;
  description: string;
  skills: string[];
  startingRate: string;
  toolAccess: string[];
  availability: string;
  /** Plain text, at most 8,000 characters; empty removes the sample. Left out when unchanged. */
  sampleDeliverable?: string;
};

/** Returns the listing's review status after the edit ("pending" when its public text changed). */
export async function updateOwnListing(agentId: string, patch: ListingPatch): Promise<string | null> {
  const { data, error } = await client().from("agents").update({
    name: patch.name, specialty: patch.specialty, description: patch.description, skills: patch.skills,
    starting_rate: patch.startingRate, tool_access: patch.toolAccess, availability: patch.availability,
    ...(patch.sampleDeliverable === undefined ? {} : { sample_deliverable: patch.sampleDeliverable.trim() || null }),
  }).eq("id", agentId).select("moderation_status").single();
  if (error) throw new Error(error.message);
  return (data?.moderation_status as string | null) ?? null;
}

export async function setListingListed(agentId: string, listed: boolean): Promise<void> {
  const { error } = await client().from("agents").update({ listed }).eq("id", agentId).select("id").single();
  if (error) throw new Error(error.message);
}

export type BriefPatch = {
  title: string;
  description: string;
  successCriteria: string;
  budget: string;
  duration: string;
  category: string;
  requiredSkills: string[];
};

export async function updateOwnBrief(opportunityId: string, patch: BriefPatch): Promise<void> {
  const { data, error } = await client().from("opportunities").update({
    title: patch.title, description: patch.description, success_criteria: patch.successCriteria, budget_range: patch.budget,
    estimated_duration: patch.duration, category: patch.category, required_skills: patch.requiredSkills, updated_at: new Date().toISOString(),
  }).eq("id", opportunityId).eq("status", "open").select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only an open brief you posted can be edited.");
}

/** Close (declining pending applications and proposals, whose agents are told) or reopen a brief. */
export async function setBriefOpen(opportunityId: string, open: boolean): Promise<{ declined: number }> {
  const db = client();
  const { data, error } = await db.from("opportunities").update({ status: open ? "open" : "closed", updated_at: new Date().toISOString() })
    .eq("id", opportunityId).eq("status", open ? "closed" : "open").select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(open ? "This brief is not closed." : "This brief is not open.");
  if (open) return { declined: 0 };
  const [apps, negs] = await Promise.all([
    db.from("applications").update({ status: "rejected" }).eq("opportunity_id", opportunityId).eq("status", "pending").select("id"),
    db.from("negotiations").update({ status: "rejected" }).eq("opportunity_id", opportunityId).in("status", ["pending", "countered"]).select("id"),
  ]);
  return { declined: (apps.data ?? []).length + (negs.data ?? []).length };
}

export type PayoutRow = {
  id: string;
  contractId: string;
  contractTitle: string | null;
  organization: string | null;
  payoutCents: number;
  feeCents: number;
  priceCents: number;
  reversedCents: number;
  currency: string;
  status: string;
  transferredAt: string | null;
  createdAt: string;
};

export async function listMyPayouts(profileId: string): Promise<PayoutRow[]> {
  const db = client();
  const { data, error } = await db.from("payouts")
    .select("id,contract_id,gross_cents,fee_cents,net_cents,reversed_cents,currency,status,transferred_at,created_at")
    .eq("operator_profile_id", profileId).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const ids = [...new Set(rows.map((r) => String(r.contract_id)))];
  const { data: contracts } = ids.length ? await db.from("contracts").select("id,title,organization_name").in("id", ids) : { data: [] };
  const byId = new Map(((contracts ?? []) as Record<string, unknown>[]).map((c) => [String(c.id), c]));
  return rows.map((r) => ({
    id: String(r.id), contractId: String(r.contract_id),
    contractTitle: (byId.get(String(r.contract_id))?.title as string | undefined) ?? null,
    organization: (byId.get(String(r.contract_id))?.organization_name as string | undefined) ?? null,
    payoutCents: Number(r.net_cents ?? 0), feeCents: Number(r.fee_cents ?? 0), priceCents: Number(r.gross_cents ?? 0),
    reversedCents: Number(r.reversed_cents ?? 0), currency: String(r.currency ?? "USD"), status: String(r.status),
    transferredAt: (r.transferred_at as string | null) ?? null, createdAt: String(r.created_at),
  }));
}

/** Plain words for a payout's state. */
export function payoutStateText(p: Pick<PayoutRow, "status" | "transferredAt">): string {
  switch (p.status) {
    case "transferred": return `Sent to your Stripe account${p.transferredAt ? ` ${new Date(p.transferredAt).toLocaleDateString()}` : ""}`;
    case "reversed": return "Pulled back after a refund";
    case "pending": return "Waiting for release or your payout setup";
    case "failed": return "Failed; contact support";
    default: return p.status;
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTO_APPROVAL_NOTE, autoReleasePlan, type ReleaseDeliverable } from "../src/lib/autoRelease.js";
import type { StripeMode } from "./stripeMode.js";

// The reconcile job's auto-release step (rule: src/lib/autoRelease.ts). For each
// contract whose card hold is live, it either releases payment on the buyer's
// behalf when the review window has passed, or counts the contract as needing
// the owner's attention when delivered work is about to lose its hold and the
// platform may not release it (quality check not passed, dispute, late delivery).

export type ReleaseCandidate = {
  contractId: string;
  organizationId: string | null;
  paymentStatus: string;
  holdExpiresAt: number | null;
  openDisputes: number;
  deliverables: Array<ReleaseDeliverable & { id: string; decisions: unknown[] }>;
};

export type AutoReleaseStore = {
  candidates(): Promise<ReleaseCandidate[]>;
  /** Approve every still-submitted deliverable as the platform and mark the contract completed. */
  approve(candidate: ReleaseCandidate, nowIso: string): Promise<void>;
};

export type AutoReleaseDeps = {
  store: AutoReleaseStore;
  organizationOwner: (organizationId: string | null) => Promise<string | null>;
  /** Capture through the same fenced money operation the buyer's own release uses. */
  release: (contractId: string, buyerProfileId: string) => Promise<unknown>;
  notify?: (event: { event: "deliverable_decision"; contractId: string }) => Promise<unknown>;
};

export type AutoReleaseReport = { autoReleased: number; attention: number; failed: number };

const ATTENTION_WINDOW_MS = 24 * 3_600_000;

export async function runAutoRelease(deps: AutoReleaseDeps, now: () => number, deadline: number): Promise<AutoReleaseReport> {
  const report: AutoReleaseReport = { autoReleased: 0, attention: 0, failed: 0 };
  for (const candidate of await deps.store.candidates()) {
    if (now() >= deadline) break;
    const plan = autoReleasePlan(candidate, now());
    if (!plan.eligible) {
      const delivered = candidate.deliverables.some((d) => d.status === "submitted" || d.status === "approved");
      const lapsing = candidate.holdExpiresAt !== null && candidate.holdExpiresAt * 1000 - now() <= ATTENTION_WINDOW_MS;
      if (plan.reason !== "not_held" && delivered && lapsing) report.attention++;
      continue;
    }
    if (!plan.due) continue;
    try {
      const buyer = await deps.organizationOwner(candidate.organizationId);
      if (!buyer) throw new Error("Contract has no organization owner");
      if (candidate.deliverables.some((d) => d.status === "submitted")) await deps.store.approve(candidate, new Date(now()).toISOString());
      await deps.release(candidate.contractId, buyer);
      report.autoReleased++;
      try { await deps.notify?.({ event: "deliverable_decision", contractId: candidate.contractId }); } catch { /* the worker reads the truth back later */ }
    } catch {
      report.failed++;
    }
  }
  return report;
}

type Row = Record<string, unknown>;

export function supabaseAutoReleaseStore(client: SupabaseClient, mode: StripeMode): AutoReleaseStore {
  return {
    async candidates() {
      const { data: holds, error } = await client.from("payments").select("contract_id,metadata")
        .eq("kind", "charge").eq("status", "authorized").eq("provider_mode", mode).order("created_at").limit(50);
      if (error) throw new Error("Could not read held payments");
      const holdRows = (holds ?? []) as Row[];
      const ids = [...new Set(holdRows.map((h) => String(h.contract_id)))];
      if (ids.length === 0) return [];
      const [contracts, deliverables, disputes] = await Promise.all([
        client.from("contracts").select("id,organization_id,payment_status").in("id", ids),
        client.from("contract_deliverables").select("id,contract_id,status,submitted_at,gate,decisions").in("contract_id", ids),
        client.from("disputes").select("contract_id").in("contract_id", ids).neq("status", "Resolved"),
      ]);
      if (contracts.error || deliverables.error || disputes.error) throw new Error("Could not read held contracts");
      return ((contracts.data ?? []) as Row[]).map((c) => {
        const hold = holdRows.find((h) => h.contract_id === c.id);
        const captureBefore = (hold?.metadata as { captureBefore?: unknown } | null)?.captureBefore;
        return {
          contractId: String(c.id),
          organizationId: (c.organization_id as string | null) ?? null,
          paymentStatus: String(c.payment_status),
          holdExpiresAt: typeof captureBefore === "number" ? captureBefore : null,
          openDisputes: ((disputes.data ?? []) as Row[]).filter((d) => d.contract_id === c.id).length,
          deliverables: ((deliverables.data ?? []) as Row[]).filter((d) => d.contract_id === c.id).map((d) => ({
            id: String(d.id),
            status: String(d.status),
            submittedAt: (d.submitted_at as string | null) ?? null,
            gateVerdict: ((d.gate as { verdict?: unknown } | null)?.verdict as string | undefined) ?? null,
            decisions: Array.isArray(d.decisions) ? d.decisions : [],
          })),
        };
      });
    },
    async approve(candidate, nowIso) {
      for (const d of candidate.deliverables.filter((x) => x.status === "submitted")) {
        const decisions = [...d.decisions, { id: `decision-auto-${Date.parse(nowIso)}`, status: "approved", note: AUTO_APPROVAL_NOTE, decidedAt: nowIso, automatic: true }];
        // Only a still-submitted deliverable: a buyer decision or an overlapping run wins.
        const { error } = await client.from("contract_deliverables")
          .update({ status: "approved", approved_at: nowIso, decisions }).eq("id", d.id).eq("status", "submitted");
        if (error) throw new Error("Could not approve deliverable");
      }
      const { data: rows, error: readError } = await client.from("contract_deliverables").select("status").eq("contract_id", candidate.contractId);
      if (readError) throw new Error("Could not read deliverables");
      const all = (rows ?? []) as Array<{ status: string }>;
      if (all.length === 0 || all.some((r) => r.status !== "approved")) throw new Error("Deliverables changed during auto-release");
      const { error } = await client.from("contracts").update({ status: "Completed", progress: 100 }).eq("id", candidate.contractId);
      if (error) throw new Error("Could not complete contract");
    },
  };
}

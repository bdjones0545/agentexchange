// When AgentExchange approves delivered work and releases payment on its own.
//
// A card hold lasts about seven days and is never renewed. If the buyer goes
// quiet after the seller delivers, the hold would lapse and the seller would go
// unpaid, so the platform releases on the buyer's behalf at the earlier of:
//
//   * 3 days after the latest delivery, or
//   * 12 hours before the card hold expires,
//
// but never sooner than 24 hours after delivery, and only when every open
// deliverable passed the AI quality check, nothing was returned to the seller
// and no dispute is open. The buyer can approve, return the work or open a
// dispute at any time before then. Shared by the reconcile job (which acts on
// it), the contract page and the agent tools (which show the date).

export const AUTO_RELEASE = {
  afterDeliveryHours: 72,
  beforeHoldEndsHours: 12,
  minReviewHours: 24,
  /** Never attempt a capture this close to the hold's end; Stripe may already be dropping it. */
  captureMarginMinutes: 30,
} as const;

const HOUR_MS = 3_600_000;

export type ReleaseDeliverable = {
  status: string;
  submittedAt: string | null;
  gateVerdict: string | null;
};

export type AutoReleaseInput = {
  paymentStatus: string;
  /** Epoch seconds when the card hold expires (Stripe capture_before); null when unknown. */
  holdExpiresAt: number | null;
  deliverables: ReleaseDeliverable[];
  openDisputes: number;
};

export type AutoReleaseReason =
  | "not_held"
  | "hold_expiry_unknown"
  | "nothing_delivered"
  | "work_returned_or_unfinished"
  | "quality_check_not_passed"
  | "dispute_open"
  | "delivered_too_late";

export type AutoReleasePlan =
  | { eligible: true; releaseAt: number; deliveredAt: number; due: boolean }
  | { eligible: false; reason: AutoReleaseReason; deliveredAt: number | null };

/** Pure: whether and when the platform releases this contract's payment. Times in epoch ms. */
export function autoReleasePlan(input: AutoReleaseInput, nowMs: number): AutoReleasePlan {
  if (input.paymentStatus !== "authorized") return { eligible: false, reason: "not_held", deliveredAt: null };
  if (input.holdExpiresAt === null) return { eligible: false, reason: "hold_expiry_unknown", deliveredAt: null };
  if (input.deliverables.length === 0) return { eligible: false, reason: "nothing_delivered", deliveredAt: null };
  if (input.deliverables.some((d) => d.status !== "submitted" && d.status !== "approved")) {
    return { eligible: false, reason: "work_returned_or_unfinished", deliveredAt: null };
  }
  const times = input.deliverables.map((d) => (d.submittedAt ? Date.parse(d.submittedAt) : Number.NaN));
  if (times.some((t) => Number.isNaN(t))) return { eligible: false, reason: "nothing_delivered", deliveredAt: null };
  const deliveredAt = Math.max(...times);
  if (input.deliverables.some((d) => d.status === "submitted" && d.gateVerdict !== "passed")) {
    return { eligible: false, reason: "quality_check_not_passed", deliveredAt };
  }
  if (input.openDisputes > 0) return { eligible: false, reason: "dispute_open", deliveredAt };

  const holdEnds = input.holdExpiresAt * 1000;
  const releaseAt = Math.max(
    Math.min(deliveredAt + AUTO_RELEASE.afterDeliveryHours * HOUR_MS, holdEnds - AUTO_RELEASE.beforeHoldEndsHours * HOUR_MS),
    deliveredAt + AUTO_RELEASE.minReviewHours * HOUR_MS,
  );
  if (releaseAt > holdEnds - AUTO_RELEASE.captureMarginMinutes * 60_000) {
    return { eligible: false, reason: "delivered_too_late", deliveredAt };
  }
  return { eligible: true, releaseAt, deliveredAt, due: nowMs >= releaseAt };
}

/** Plain words for a reason the platform will not release on its own. */
export function autoReleaseReasonText(reason: AutoReleaseReason): string {
  switch (reason) {
    case "not_held": return "payment is not on hold";
    case "hold_expiry_unknown": return "the card hold's expiry is not known yet";
    case "nothing_delivered": return "no work has been delivered";
    case "work_returned_or_unfinished": return "some work was returned or is not submitted";
    case "quality_check_not_passed": return "some work did not pass the quality check, so the buyer must decide";
    case "dispute_open": return "a dispute is open";
    case "delivered_too_late": return "the work arrived too close to the end of the card hold";
  }
}

/** The note recorded on each deliverable the platform approves. */
export const AUTO_APPROVAL_NOTE =
  "Approved automatically by AgentExchange: the work passed the quality check and the buyer did not respond within the review window.";

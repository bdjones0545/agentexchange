// Buying a fixed-price listing in one step.
//
// A hire request must name one of the buyer's own briefs: the contract's
// organization is derived from it (materialize_hire_request_contract). So
// "Buy" writes that brief for the buyer, closed from the start so it never
// appears on the marketplace or takes applications, and then sends the hire
// request at the listing's price. These helpers are the pure part.

import { jobKind } from "./jobCatalog";
import { formatCents } from "./money";

/** The platform's minimum contract price. */
export const MIN_PRICE_CENTS = 5000;
export const PURCHASE_NOTE_MAX = 1500;

/**
 * The listing's fixed price: the first dollar amount in its starting rate
 * ("$550 per list of 60" → 55000; "$750 per audit · $800 per week" → 75000).
 * Null when there is none or it is under the minimum, so the listing keeps
 * the custom request only.
 */
export function listingPriceCents(startingRate: string | null | undefined): number | null {
  const match = startingRate?.match(/\$\s*(\d[\d,]*(?:\.\d{1,2})?)/);
  if (!match) return null;
  const cents = Math.round(Number(match[1].replace(/,/g, "")) * 100);
  return Number.isFinite(cents) && cents >= MIN_PRICE_CENTS ? cents : null;
}

export type PurchasableListing = {
  id: string;
  name: string;
  description?: string;
  startingRate?: string;
  customSkills?: string[];
  jobKinds?: string[];
};

/** "Turnaround: 6 business days after funding." → "6 business days". */
function turnaround(description: string | undefined): string | null {
  const match = description?.match(/Turnaround:\s*(\d+)\s+(business days|days|weeks?)/i);
  return match ? `${match[1]} ${match[2].toLowerCase()}` : null;
}

/** The columns of the buyer's purchase brief. */
export function purchaseBrief(listing: PurchasableListing, priceCents: number, note: string) {
  const kind = listing.jobKinds?.map((id) => jobKind(id)).find((k) => k && k.family === "deliverable") ?? null;
  const trimmedNote = note.trim().slice(0, PURCHASE_NOTE_MAX);
  const price = formatCents(priceCents);
  return {
    title: `Purchase: ${listing.name}`.slice(0, 160),
    category: kind?.category ?? "Operations",
    job_kind: kind?.id ?? null,
    budget_range: price,
    estimated_duration: turnaround(listing.description),
    required_skills: (listing.customSkills ?? []).slice(0, 12),
    description: [
      `Fixed-price purchase of the listing "${listing.name}" at ${price}${listing.startingRate ? ` (listed as ${listing.startingRate})` : ""}.`,
      "",
      "What the buyer wants you to know:",
      trimmedNote || "Nothing yet. Details follow in the contract thread.",
      "",
      "Scope, as listed:",
      listing.description?.trim() || "See the listing.",
    ].join("\n"),
    success_criteria: 'Delivered as the listing\'s "What you get" describes, with the evidence it lists, and approved by the buyer.',
  };
}

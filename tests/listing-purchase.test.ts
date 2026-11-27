import { describe, expect, it, vi } from "vitest";

const { tables } = vi.hoisted(() => ({ tables: { organizations: [], opportunities: [] } as Record<string, Record<string, unknown>[]> }));
vi.mock("../src/lib/supabase", async () => {
  const { fakeDb: makeDb } = await import("./fakeSupabase");
  return {
    supabase: makeDb({ tables }),
    isSupabaseConfigured: true,
    getSupabaseErrorMessage: (error: { message?: string }) => error?.message ?? "error",
  };
});

import { buyerTotals } from "../src/components/BuyListingModal";
import { PURCHASE_NOTE_MAX, listingPriceCents, purchaseBrief } from "../src/lib/listingPurchase";
import { createPurchaseBrief } from "../src/lib/repositories/purchaseRepository";

const LISTING = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Local Partner List: 60 verified organizations near you",
  description: "Know who to approach.\n\nTurnaround: 5 business days after funding. Rules: public contacts only.",
  startingRate: "$550 per list of 60",
  customSkills: ["lead research", "data verification"],
  jobKinds: ["lead_list"],
};

describe("listing price", () => {
  it("reads the first dollar amount, never a later number", () => {
    expect(listingPriceCents("$550 per list of 60")).toBe(55000);
    expect(listingPriceCents("$750 per audit · $800 per week ongoing")).toBe(75000);
    expect(listingPriceCents("$1,100 per evidence review")).toBe(110000);
    expect(listingPriceCents("$1,000 per 12 articles")).toBe(100000);
    expect(listingPriceCents("$99.50 per review")).toBe(9950);
  });

  it("has no fixed price below the $50 minimum or without a dollar amount", () => {
    expect(listingPriceCents("$40 per thing")).toBeNull();
    expect(listingPriceCents("Custom quote")).toBeNull();
    expect(listingPriceCents("600 per project")).toBeNull();
    expect(listingPriceCents("")).toBeNull();
    expect(listingPriceCents(undefined)).toBeNull();
  });
});

describe("purchase brief", () => {
  it("carries the listing's scope, price, turnaround and job kind", () => {
    const brief = purchaseBrief(LISTING, 55000, "  Bluffton, SC, 30-minute drive  ");
    expect(brief.title).toBe("Purchase: Local Partner List: 60 verified organizations near you");
    expect(brief.budget_range).toBe("$550");
    expect(brief.category).toBe("Sales");
    expect(brief.job_kind).toBe("lead_list");
    expect(brief.estimated_duration).toBe("5 business days");
    expect(brief.required_skills).toEqual(["lead research", "data verification"]);
    expect(brief.description).toContain('Fixed-price purchase of the listing "Local Partner List: 60 verified organizations near you" at $550 (listed as $550 per list of 60).');
    expect(brief.description).toContain("What the buyer wants you to know:\nBluffton, SC, 30-minute drive\n");
    expect(brief.description).toContain("Scope, as listed:\nKnow who to approach.");
  });

  it("says details follow when the buyer adds no note, and caps a long note", () => {
    expect(purchaseBrief(LISTING, 55000, "   ").description).toContain("Nothing yet. Details follow in the contract thread.");
    const long = purchaseBrief(LISTING, 55000, "x".repeat(PURCHASE_NOTE_MAX + 50)).description;
    expect(long).toContain("x".repeat(PURCHASE_NOTE_MAX));
    expect(long).not.toContain("x".repeat(PURCHASE_NOTE_MAX + 1));
  });

  it("falls back for a listing without a known job kind or turnaround", () => {
    const brief = purchaseBrief({ id: "x", name: "Plain", startingRate: "$300" }, 30000, "");
    expect(brief.category).toBe("Operations");
    expect(brief.job_kind).toBeNull();
    expect(brief.estimated_duration).toBeNull();
    expect(brief.description).toContain("See the listing.");
  });
});

describe("buyer totals", () => {
  it("adds the service fee to the price", () => {
    expect(buyerTotals(55000, 300)).toEqual({ priceCents: 55000, feeCents: 1650, totalCents: 56650 });
    expect(buyerTotals(110000, 300)).toEqual({ priceCents: 110000, feeCents: 3300, totalCents: 113300 });
  });
});

describe("createPurchaseBrief", () => {
  it("creates the buyer's organization and a closed brief, then reuses the organization", async () => {
    const first = await createPurchaseBrief({ organizationName: " Acme Fitness ", listing: LISTING, priceCents: 55000, note: "" });
    expect(tables.organizations).toHaveLength(1);
    expect(tables.organizations[0]).toMatchObject({ name: "Acme Fitness", industry: "Buyer" });
    expect(tables.opportunities[0]).toMatchObject({ status: "closed", work_type: "deliverable", organization_name: "Acme Fitness", budget_range: "$550", job_kind: "lead_list" });
    expect(first).toMatchObject({ status: "closed", title: "Purchase: Local Partner List: 60 verified organizations near you", organizationId: tables.organizations[0].id });

    await createPurchaseBrief({ organizationId: tables.organizations[0].id as string, organizationName: "Acme Fitness", listing: LISTING, priceCents: 55000, note: "Second order" });
    expect(tables.organizations).toHaveLength(1);
    expect(tables.opportunities).toHaveLength(2);
    expect(tables.opportunities[1]).toMatchObject({ status: "closed", organization_id: tables.organizations[0].id });
  });
});

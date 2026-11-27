// Writes the buyer's purchase brief for a fixed-price listing (see
// src/lib/listingPurchase.ts). RLS decides: the brief must be the signed-in
// buyer's own, under an organization they own.
import { getSupabaseErrorMessage, supabase } from "../supabase";
import { purchaseBrief, type PurchasableListing } from "../listingPurchase";
import type { CreatedOpportunity } from "../../state/marketplaceTypes";
import { mapOpportunityRow } from "./supabaseStateRepository";

export type PurchaseBriefInput = {
  /** One of the buyer's organizations to reuse; a new one is created when absent. */
  organizationId?: string;
  organizationName: string;
  listing: PurchasableListing;
  priceCents: number;
  note: string;
};

export async function createPurchaseBrief(input: PurchaseBriefInput): Promise<CreatedOpportunity> {
  if (!supabase) throw new Error("Not connected to the marketplace");
  const organizationName = input.organizationName.trim();
  let organizationId = input.organizationId;
  if (!organizationId) {
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name: organizationName, industry: "Buyer", overview: `${organizationName} hires agents on AgentExchange.` })
      .select("id")
      .single();
    if (error) throw new Error(`Unable to create your organization: ${getSupabaseErrorMessage(error)}`);
    organizationId = data.id as string;
  }
  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      organization_id: organizationId,
      organization_name: organizationName,
      // Closed from the start: a purchase is not a public call for proposals.
      status: "closed",
      work_type: "deliverable",
      ...purchaseBrief(input.listing, input.priceCents, input.note),
    })
    .select()
    .single();
  if (error) throw new Error(`Unable to record the purchase: ${getSupabaseErrorMessage(error)}`);
  return mapOpportunityRow(data as Record<string, unknown>);
}

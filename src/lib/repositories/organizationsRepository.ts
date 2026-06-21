import { supabase, isSupabaseConfigured, getSupabaseErrorMessage } from "../supabase";
import { getAllOrganizations } from "../../data/organizations";
import type { Organization } from "../../data/organizations";
import type { Opportunity } from "../../data/marketplace";

export async function listOrganizations(
  opportunities: Opportunity[] = [],
): Promise<Organization[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("organizations").select("*");

    if (error) {
      throw new Error(`Unable to list organizations: ${getSupabaseErrorMessage(error)}`);
    }

    if (data) {
      return data.map((organization) => ({
        baseRating: Number(organization.rating ?? 0),
        id: organization.id,
        industry: organization.industry ?? "Marketplace",
        name: organization.name,
        overview: organization.overview ?? "",
        verified: Boolean(organization.verified),
      }));
    }
  }

  return getAllOrganizations(opportunities);
}

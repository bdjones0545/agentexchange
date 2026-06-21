import {
  getSupabaseErrorMessage,
  isSupabaseConfigured,
  supabase,
} from "../supabase";
import type { SavedOpportunity } from "../../state/marketplaceTypes";
import { loadLocalState, saveLocalState } from "./localStateRepository";

export async function listSavedOpportunities(): Promise<SavedOpportunity[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("saved_opportunities")
      .select("opportunity_id, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(
        `Unable to list saved opportunities: ${getSupabaseErrorMessage(error)}`,
      );
    }

    return (data ?? []).map((saved) => ({
      opportunityId: saved.opportunity_id,
      savedAt: saved.created_at,
    }));
  }

  return (await loadLocalState()).savedOpportunities;
}

export async function saveOpportunity(opportunityId: string) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("saved_opportunities")
      .upsert(
        {
          opportunity_id: opportunityId,
        },
        {
          onConflict: "owner_id,opportunity_id",
        },
      );

    if (error) {
      throw new Error(`Unable to save opportunity: ${getSupabaseErrorMessage(error)}`);
    }

    return;
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    savedOpportunities: [
      {
        opportunityId,
        savedAt: new Date().toISOString(),
      },
      ...state.savedOpportunities.filter(
        (saved) => saved.opportunityId !== opportunityId,
      ),
    ],
  });
}

export async function unsaveOpportunity(opportunityId: string) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("saved_opportunities")
      .delete()
      .eq("opportunity_id", opportunityId);

    if (error) {
      throw new Error(
        `Unable to unsave opportunity: ${getSupabaseErrorMessage(error)}`,
      );
    }

    return;
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    savedOpportunities: state.savedOpportunities.filter(
      (saved) => saved.opportunityId !== opportunityId,
    ),
  });
}

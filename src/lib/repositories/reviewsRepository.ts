import {
  getSupabaseErrorMessage,
  isSupabaseConfigured,
  supabase,
} from "../supabase";
import type { AgentReview } from "../../state/marketplaceTypes";
import { loadLocalState, saveLocalState } from "./localStateRepository";

export async function listReviews(): Promise<AgentReview[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to list reviews: ${getSupabaseErrorMessage(error)}`);
    }

    return (data ?? []).map((review) => ({
      agentId: review.agent_id ?? undefined,
      agentName: review.agent_name,
      contractId: review.contract_id,
      contractTitle: review.contract_title ?? "Contract",
      createdAt: review.created_at,
      id: review.id,
      organization: review.organization_name,
      rating: review.rating,
      review: review.review,
    }));
  }

  return (await loadLocalState()).agentReviews;
}

export async function createReview(review: AgentReview): Promise<AgentReview> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        agent_id: review.agentId,
        agent_name: review.agentName,
        contract_id: review.contractId,
        contract_title: review.contractTitle,
        organization_name: review.organization,
        rating: review.rating,
        review: review.review,
      })
      .select("id, created_at")
      .single();

    if (error) {
      throw new Error(`Unable to create review: ${getSupabaseErrorMessage(error)}`);
    }

    return {
      ...review,
      createdAt: data.created_at,
      id: data.id,
    };
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    agentReviews: [review, ...state.agentReviews],
  });
  return review;
}

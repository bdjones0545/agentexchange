import { supabase, isSupabaseConfigured } from "../supabase";
import type { Negotiation } from "../../state/marketplaceTypes";
import { loadLocalState, saveLocalState } from "./localStateRepository";

export async function listNegotiations(): Promise<Negotiation[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("negotiations").select("*");

    if (!error && data) {
      return data.map((negotiation) => ({
        agentId: negotiation.agent_id ?? undefined,
        agentName: negotiation.agent_name ?? undefined,
        counterNote: negotiation.counter_note ?? undefined,
        counterRate: negotiation.counter_rate ?? undefined,
        counterTimeline: negotiation.counter_timeline ?? undefined,
        createdAt: negotiation.created_at,
        id: negotiation.id,
        milestoneNotes: negotiation.milestone_notes ?? "",
        opportunityId: negotiation.opportunity_id,
        opportunityTitle: "Opportunity",
        rate: negotiation.rate ?? "",
        status: negotiation.status,
        timeline: negotiation.timeline ?? "",
      }));
    }
  }

  return (await loadLocalState()).negotiations;
}

export async function createNegotiation(negotiation: Negotiation) {
  if (isSupabaseConfigured && supabase) {
    await supabase.from("negotiations").insert({
      agent_id: negotiation.agentId,
      agent_name: negotiation.agentName,
      counter_note: negotiation.counterNote,
      counter_rate: negotiation.counterRate,
      counter_timeline: negotiation.counterTimeline,
      milestone_notes: negotiation.milestoneNotes,
      opportunity_id: negotiation.opportunityId,
      rate: negotiation.rate,
      status: negotiation.status,
      timeline: negotiation.timeline,
    });
    return;
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    negotiations: [negotiation, ...state.negotiations],
  });
}

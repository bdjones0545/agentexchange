import { supabase, isSupabaseConfigured } from "../supabase";
import type { HireRequest } from "../../state/marketplaceTypes";
import { loadLocalState, saveLocalState } from "./localStateRepository";

export async function listHireRequests(): Promise<HireRequest[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("hire_requests").select("*");

    if (!error && data) {
      return data.map((request) => ({
        agentId: request.agent_id,
        agentName: request.agent_name ?? "Agent",
        createdAt: request.created_at,
        id: request.id,
        opportunityId: request.opportunity_id ?? undefined,
        opportunityTitle: request.opportunity_title ?? "Hire request",
        quickJobTitle: request.quick_job_title ?? undefined,
        status: request.status,
      }));
    }
  }

  return (await loadLocalState()).hireRequests;
}

export async function createHireRequest(hireRequest: HireRequest) {
  if (isSupabaseConfigured && supabase) {
    await supabase.from("hire_requests").insert({
      agent_id: hireRequest.agentId,
      agent_name: hireRequest.agentName,
      opportunity_id: hireRequest.opportunityId,
      opportunity_title: hireRequest.opportunityTitle,
      quick_job_title: hireRequest.quickJobTitle,
      status: hireRequest.status,
    });
    return;
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    hireRequests: [hireRequest, ...state.hireRequests],
  });
}

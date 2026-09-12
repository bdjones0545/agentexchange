import { supabase, isSupabaseConfigured, getSupabaseErrorMessage } from "../supabase";
import type { HireRequest, LocalContract } from "../../state/marketplaceTypes";
import { loadLocalState, saveLocalState } from "./localStateRepository";

export async function listHireRequests(): Promise<HireRequest[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("hire_requests").select("*");

    if (error) {
      throw new Error(`Unable to list hire requests: ${getSupabaseErrorMessage(error)}`);
    }

    if (data) {
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

export async function createHireRequest(hireRequest: HireRequest): Promise<HireRequest> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("hire_requests").insert({
      agent_id: hireRequest.agentId,
      agent_name: hireRequest.agentName,
      opportunity_id: hireRequest.opportunityId,
      opportunity_title: hireRequest.opportunityTitle,
      quick_job_title: hireRequest.quickJobTitle,
      status: hireRequest.status,
    }).select("id, created_at, status, owner_id").single();
    if (error) {
      throw new Error(`Unable to create hire request: ${getSupabaseErrorMessage(error)}`);
    }
    return {
      ...hireRequest,
      createdAt: data.created_at,
      id: data.id,
      ownerId: data.owner_id ?? undefined,
      status: data.status,
    };
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    hireRequests: [hireRequest, ...state.hireRequests],
  });
  return hireRequest;
}

export async function acceptHireRequest(hireRequestId: string) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("hire_requests")
      .update({ status: "accepted" })
      .eq("id", hireRequestId);
    if (error) {
      throw new Error(`Unable to accept hire request: ${getSupabaseErrorMessage(error)}`);
    }
  }
}

/**
 * Materializes the contract for an already-accepted hire request.
 *
 * The agent side is deliberately not authorized to insert contracts directly,
 * so every relationship field is derived in the database from the accepted
 * hire request. Only the hire request id crosses the boundary. Repeated calls
 * return the same contract.
 */
export async function materializeHireRequestContract(
  hireRequestId: string,
): Promise<LocalContract | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("materialize_hire_request_contract", {
    hire_request_uuid: hireRequestId,
  });

  if (error) {
    throw new Error(
      `Unable to materialize hire request contract: ${getSupabaseErrorMessage(error)}`,
    );
  }

  const contract = Array.isArray(data) ? data[0] : data;
  if (!contract) {
    return null;
  }

  return {
    accent: "emerald",
    agent: contract.agent_name,
    agentId: contract.agent_id ?? undefined,
    dueDate: contract.due_date ?? "",
    id: contract.id,
    organization: contract.organization_name,
    organizationId: contract.organization_id ?? "",
    progress: contract.progress ?? 0,
    sourceId: contract.source_id ?? "",
    sourceType: contract.source_type ?? "hire-request",
    startDate: contract.start_date ?? "",
    status: contract.status,
    title: contract.title,
    value: contract.value ?? "Custom scope",
  };
}

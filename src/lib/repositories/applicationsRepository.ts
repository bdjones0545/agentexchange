import { supabase, isSupabaseConfigured, getSupabaseErrorMessage } from "../supabase";
import type { Application } from "../../state/marketplaceTypes";
import { loadLocalState, saveLocalState } from "./localStateRepository";

export async function listApplications(): Promise<Application[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("applications").select("*");

    if (error) {
      throw new Error(`Unable to list applications: ${getSupabaseErrorMessage(error)}`);
    }

    if (data) {
      return data.map((application) => ({
        agentId: application.agent_id,
        agentName: application.agent_name ?? "Agent",
        createdAt: application.created_at,
        id: application.id,
        opportunityId: application.opportunity_id,
        opportunityTitle: "Opportunity",
        proposal: application.proposal,
        status: application.status,
      }));
    }
  }

  return (await loadLocalState()).applications;
}

export async function createApplication(application: Application): Promise<Application> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("applications").insert({
      agent_id: application.agentId,
      agent_name: application.agentName,
      opportunity_id: application.opportunityId,
      proposal: application.proposal,
      status: application.status,
    }).select("id, created_at, status, owner_id").single();
    if (error) {
      throw new Error(`Unable to create application: ${getSupabaseErrorMessage(error)}`);
    }
    return {
      ...application,
      createdAt: data.created_at,
      id: data.id,
      ownerId: data.owner_id ?? undefined,
      status: data.status,
    };
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    applications: [application, ...state.applications],
  });
  return application;
}

export async function acceptApplication(applicationId: string) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("applications")
      .update({ status: "accepted" })
      .eq("id", applicationId);
    if (error) {
      throw new Error(`Unable to accept application: ${getSupabaseErrorMessage(error)}`);
    }
  }
}

export async function updateApplicationStatus(
  applicationId: string,
  status: Application["status"],
) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("applications")
      .update({ status })
      .eq("id", applicationId);
    if (error) {
      throw new Error(`Unable to update application: ${getSupabaseErrorMessage(error)}`);
    }
  }
}

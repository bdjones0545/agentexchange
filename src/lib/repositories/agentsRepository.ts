import { supabase, isSupabaseConfigured, getSupabaseErrorMessage } from "../supabase";
import { initialsFor } from "../initials";
import { cleanJobKinds } from "../jobCatalog";
import { agents } from "../../data/agents";
import type { Agent } from "../../data/agents";
import type { CreateAgentInput, CreatedAgent } from "../../state/marketplaceTypes";
import { loadLocalState, saveLocalState } from "./localStateRepository";

export async function listAgents(): Promise<Agent[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("agents").select("*");

    if (error) {
      throw new Error(`Unable to list agents: ${getSupabaseErrorMessage(error)}`);
    }

    if (data) {
      return data.map((agent) => ({
        accent: "violet",
        availability: agent.availability,
        avatarInitials: initialsFor(agent.name, "AI"),
        contractHistoryIds: [],
        customSkills: agent.skills ?? [],
        description: agent.description ?? undefined,
        id: agent.id,
        name: agent.name,
        revenue: agent.revenue ?? "$0",
        skillIds: [],
        specialty: agent.specialty,
        startingRate: agent.starting_rate ?? undefined,
        successRate: agent.success_rate ?? "New",
        tier: agent.verification_status ?? "Unverified",
        toolAccess: agent.tool_access ?? [],
        jobKinds: agent.job_kinds ?? [],
        trustScore: Number(agent.trust_score ?? 0),
      }));
    }
  }

  const state = await loadLocalState();
  return [...state.createdAgents, ...agents];
}

export async function createAgent(
  input: CreateAgentInput,
): Promise<CreatedAgent> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("agents")
      .insert({
        availability: input.availability,
        description: input.description,
        name: input.name,
        skills: input.skills,
        specialty: input.specialty,
        starting_rate: input.startingRate,
        tool_access: input.toolAccess,
        job_kinds: input.jobKinds ?? [],
        // trust_score, verification_status, revenue and success_rate are
        // platform-managed; the database normalizes them on insert.
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Unable to create agent: ${getSupabaseErrorMessage(error)}`);
    }

    if (data) {
      return {
        accent: "violet",
        availability: data.availability,
        avatarInitials: initialsFor(data.name, "AI"),
        contractHistoryIds: [],
        createdAt: data.created_at,
        customSkills: data.skills ?? [],
        description: data.description ?? "",
        id: data.id,
        name: data.name,
        ownerId: data.owner_id ?? undefined,
        revenue: "$0",
        skillIds: [],
        specialty: data.specialty,
        startingRate: data.starting_rate ?? input.startingRate,
        successRate: data.success_rate ?? "New",
        tier: data.verification_status ?? "Unverified",
        toolAccess: data.tool_access ?? [],
        jobKinds: data.job_kinds ?? input.jobKinds ?? [],
        trustScore: Number(data.trust_score ?? 0),
      };
    }
  }

  const state = await loadLocalState();
  const createdAgent: CreatedAgent = {
    accent: "violet",
    availability: input.availability,
    avatarInitials: initialsFor(input.name, "AI"),
    contractHistoryIds: [],
    createdAt: new Date().toISOString(),
    customSkills: input.skills,
    description: input.description,
    id: `agent-${Date.now()}`,
    name: input.name,
    revenue: "$0",
    skillIds: [],
    specialty: input.specialty,
    startingRate: input.startingRate,
    successRate: "New",
    tier: "Local Agent",
    toolAccess: input.toolAccess,
    jobKinds: input.jobKinds ?? [],
    trustScore: 90,
  };

  await saveLocalState({
    ...state,
    createdAgents: [createdAgent, ...state.createdAgents],
  });

  return createdAgent;
}

/**
 * Replaces the job kinds an agent listing takes and resolves to what was
 * stored. Only the owner may: RLS narrows anyone else's update to no rows,
 * which is reported as a refusal instead of passing for a save.
 */
export async function updateAgentJobKinds(
  agentId: string,
  jobKinds: readonly string[],
): Promise<string[]> {
  const kinds = cleanJobKinds(jobKinds);

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("agents")
      .update({ job_kinds: kinds })
      .eq("id", agentId)
      .select("job_kinds")
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to update agent: ${getSupabaseErrorMessage(error)}`);
    }

    if (!data) {
      throw new Error("Only this agent's owner can change the jobs it takes.");
    }

    return data.job_kinds ?? kinds;
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    createdAgents: state.createdAgents.map((agent) =>
      agent.id === agentId ? { ...agent, jobKinds: kinds } : agent,
    ),
  });

  return kinds;
}

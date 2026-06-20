import { supabase, isSupabaseConfigured } from "../supabase";
import { agents } from "../../data/agents";
import type { Agent } from "../../data/agents";
import type { CreateAgentInput, CreatedAgent } from "../../state/marketplaceTypes";
import { loadLocalState, saveLocalState } from "./localStateRepository";

export async function listAgents(): Promise<Agent[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("agents").select("*");

    if (!error && data) {
      return data.map((agent) => ({
        accent: "violet",
        availability: agent.availability,
        avatarInitials: agent.name.slice(0, 2).toUpperCase(),
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
        tier: agent.verification_status ?? "Verified",
        toolAccess: agent.tool_access ?? [],
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
        trust_score: 90,
        verification_status: "Rising Agent",
      })
      .select()
      .single();

    if (!error && data) {
      return {
        accent: "violet",
        availability: data.availability,
        avatarInitials: data.name.slice(0, 2).toUpperCase(),
        contractHistoryIds: [],
        createdAt: data.created_at,
        customSkills: data.skills ?? [],
        description: data.description ?? "",
        id: data.id,
        name: data.name,
        revenue: "$0",
        skillIds: [],
        specialty: data.specialty,
        startingRate: data.starting_rate ?? input.startingRate,
        successRate: "New",
        tier: "Local Agent",
        toolAccess: data.tool_access ?? [],
        trustScore: 90,
      };
    }
  }

  const state = await loadLocalState();
  const createdAgent: CreatedAgent = {
    accent: "violet",
    availability: input.availability,
    avatarInitials:
      input.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "AI",
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
    trustScore: 90,
  };

  await saveLocalState({
    ...state,
    createdAgents: [createdAgent, ...state.createdAgents],
  });

  return createdAgent;
}

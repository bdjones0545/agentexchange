import { supabase, isSupabaseConfigured } from "../supabase";
import { opportunities } from "../../data/marketplace";
import type { Opportunity } from "../../data/marketplace";
import type {
  CreatedOpportunity,
  CreateOpportunityInput,
} from "../../state/marketplaceTypes";
import { loadLocalState, saveLocalState } from "./localStateRepository";

export async function listOpportunities(): Promise<Opportunity[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("opportunities").select("*");

    if (!error && data) {
      return data.map((opportunity) => ({
        accent: "violet",
        budget: opportunity.budget_range ?? "Custom budget",
        cadence: opportunity.estimated_duration ?? "project",
        category: opportunity.category,
        duration: opportunity.estimated_duration ?? undefined,
        id: opportunity.id,
        matchScore: 90,
        organization: opportunity.organization_name ?? undefined,
        requiredSkills: opportunity.required_skills ?? [],
        successCriteria: opportunity.success_criteria ?? undefined,
        summary: opportunity.description ?? "",
        tags: opportunity.required_skills ?? ["Custom"],
        title: opportunity.title,
        trustLevel: "Verified",
      }));
    }
  }

  const state = await loadLocalState();
  return [...state.createdOpportunities, ...opportunities];
}

export async function createOpportunity(
  input: CreateOpportunityInput,
): Promise<CreatedOpportunity> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("opportunities")
      .insert({
        budget_range: input.budget,
        category: input.category,
        description: input.description,
        estimated_duration: input.duration,
        organization_name: input.organization,
        required_skills: input.requiredSkills,
        status: "open",
        success_criteria: input.successCriteria,
        title: input.title,
      })
      .select()
      .single();

    if (!error && data) {
      return {
        accent: "violet",
        budget: data.budget_range ?? input.budget,
        cadence: data.estimated_duration ?? input.duration,
        category: data.category,
        createdAt: data.created_at,
        duration: data.estimated_duration ?? input.duration,
        id: data.id,
        matchScore: 91,
        organization: data.organization_name ?? input.organization,
        requiredSkills: data.required_skills ?? input.requiredSkills,
        successCriteria: data.success_criteria ?? input.successCriteria,
        summary: data.description ?? input.description,
        tags: data.required_skills ?? input.requiredSkills,
        title: data.title,
        trustLevel: "Local",
      };
    }
  }

  const state = await loadLocalState();
  const createdOpportunity: CreatedOpportunity = {
    accent: "violet",
    budget: input.budget,
    cadence: input.duration,
    category: input.category,
    createdAt: new Date().toISOString(),
    duration: input.duration,
    id: `opportunity-${Date.now()}`,
    matchScore: 91,
    organization: input.organization,
    requiredSkills: input.requiredSkills,
    successCriteria: input.successCriteria,
    summary: input.description,
    tags: input.requiredSkills.length > 0 ? input.requiredSkills : ["Custom"],
    title: input.title,
    trustLevel: "Local",
  };

  await saveLocalState({
    ...state,
    createdOpportunities: [
      createdOpportunity,
      ...state.createdOpportunities,
    ],
  });

  return createdOpportunity;
}

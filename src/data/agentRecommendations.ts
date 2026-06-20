import type { Agent } from "./agents";
import { getAgentSkills } from "./agents";
import { getAgentDashboardMetrics, getAgentStatus } from "./agentIntelligence";
import type { Opportunity } from "./marketplace";
import type { Contract } from "./operations";
import type {
  AgentActivityEvent,
  Application,
  ContractWorkspace,
  HireRequest,
  Negotiation,
  SavedOpportunity,
} from "../state/marketplaceTypes";

export type MatchReason = {
  label: string;
  detail: string;
};

export type AgentRecommendation = {
  agent: Agent;
  opportunity: Opportunity;
  matchPercentage: number;
  reasons: MatchReason[];
  missingSkills: string[];
};

export type SuggestedAgentAction = {
  id: string;
  agentId: string;
  agentName: string;
  type:
    | "apply_to_opportunity"
    | "complete_milestone"
    | "send_follow_up"
    | "start_negotiation"
    | "submit_deliverable";
  title: string;
  description: string;
  opportunityId?: string;
  opportunityTitle?: string;
  contractId?: string;
  contractTitle?: string;
  milestoneId?: string;
};

type RecommendationInput = {
  activities: AgentActivityEvent[];
  agents: Agent[];
  applications: Application[];
  contracts: Contract[];
  hireRequests: HireRequest[];
  negotiations: Negotiation[];
  opportunities: Opportunity[];
  savedOpportunities?: SavedOpportunity[];
  workspaces: ContractWorkspace[];
};

function normalize(value: string) {
  return value.toLowerCase();
}

function parseBudgetMax(budget: string) {
  const values = budget.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const max = Math.max(...values, 0);

  return budget.toLowerCase().includes("k") ? max * 1000 : max;
}

function getSkillOverlap(agent: Agent, opportunity: Opportunity) {
  const agentSkills = getAgentSkills(agent);
  const opportunitySkills = [
    ...opportunity.tags,
    ...(opportunity.requiredSkills ?? []),
  ];
  const matchedSkills = agentSkills.filter((skill) =>
    opportunitySkills.some((requiredSkill) =>
      normalize(requiredSkill).includes(normalize(skill.label)) ||
      normalize(skill.label).includes(normalize(requiredSkill)),
    ),
  );
  const missingSkills = opportunitySkills.filter(
    (requiredSkill) =>
      !agentSkills.some(
        (skill) =>
          normalize(requiredSkill).includes(normalize(skill.label)) ||
          normalize(skill.label).includes(normalize(requiredSkill)),
      ),
  );

  return {
    matchedSkills,
    missingSkills,
    opportunitySkills,
  };
}

export function getAgentOpportunityRecommendation(
  agent: Agent,
  opportunity: Opportunity,
): AgentRecommendation {
  const { matchedSkills, missingSkills, opportunitySkills } = getSkillOverlap(
    agent,
    opportunity,
  );
  const specialtyTerms = `${agent.specialty} ${agent.description ?? ""}`.toLowerCase();
  const opportunityTerms =
    `${opportunity.category} ${opportunity.title} ${opportunity.summary}`.toLowerCase();
  const specialtyMatch = opportunityTerms
    .split(/\s+/)
    .some((term) => term.length > 4 && specialtyTerms.includes(term));
  const availabilityScore =
    agent.availability === "Available"
      ? 14
      : agent.availability === "Active"
        ? 8
        : 4;
  const trustScore = Math.min(18, Math.round(agent.trustScore / 6));
  const skillsScore =
    opportunitySkills.length > 0
      ? Math.round((matchedSkills.length / opportunitySkills.length) * 38)
      : 18;
  const categoryScore = specialtyMatch ? 18 : 8;
  const budgetScore = parseBudgetMax(opportunity.budget) >= 8000 ? 12 : 7;
  const matchPercentage = Math.min(
    99,
    Math.max(42, skillsScore + categoryScore + availabilityScore + trustScore + budgetScore),
  );
  const reasons: MatchReason[] = [
    {
      label: "Skill overlap",
      detail:
        matchedSkills.length > 0
          ? `${matchedSkills.map((skill) => skill.label).join(", ")} aligned`
          : "Generalist fit with no exact skill overlap",
    },
    {
      label: "Availability",
      detail: `${agent.name} is ${agent.availability.toLowerCase()}`,
    },
    {
      label: "Trust score",
      detail: `${Math.round(agent.trustScore)} trust baseline`,
    },
  ];

  if (specialtyMatch) {
    reasons.push({
      label: "Specialty match",
      detail: `${agent.specialty} aligns with this brief`,
    });
  }

  return {
    agent,
    missingSkills: Array.from(new Set(missingSkills)).slice(0, 4),
    matchPercentage,
    opportunity,
    reasons,
  };
}

export function getOpportunityRecommendations(
  opportunity: Opportunity,
  agents: Agent[],
) {
  return agents
    .map((agent) => getAgentOpportunityRecommendation(agent, opportunity))
    .sort((left, right) => right.matchPercentage - left.matchPercentage);
}

export function getAgentRecommendations(
  agent: Agent,
  opportunities: Opportunity[],
) {
  return opportunities
    .map((opportunity) => getAgentOpportunityRecommendation(agent, opportunity))
    .sort((left, right) => right.matchPercentage - left.matchPercentage);
}

export function getSuggestedAgentActions(
  agent: Agent,
  input: RecommendationInput,
): SuggestedAgentAction[] {
  const actions: SuggestedAgentAction[] = [];
  const existingApplicationOpportunityIds = new Set(
    input.applications
      .filter((application) => application.agentId === agent.id)
      .map((application) => application.opportunityId),
  );
  const existingNegotiationOpportunityIds = new Set(
    input.negotiations
      .filter(
        (negotiation) =>
          negotiation.agentId === agent.id || negotiation.agentName === agent.name,
      )
      .map((negotiation) => negotiation.opportunityId),
  );
  const topRecommendation = getAgentRecommendations(
    agent,
    input.opportunities.filter(
      (opportunity) => !existingApplicationOpportunityIds.has(opportunity.id),
    ),
  )[0];

  if (topRecommendation) {
    actions.push({
      id: `apply-${agent.id}-${topRecommendation.opportunity.id}`,
      agentId: agent.id,
      agentName: agent.name,
      description: `${topRecommendation.matchPercentage}% match because ${topRecommendation.reasons[0]?.detail.toLowerCase() ?? "it aligns with this agent"}.`,
      opportunityId: topRecommendation.opportunity.id,
      opportunityTitle: topRecommendation.opportunity.title,
      title: `Apply to "${topRecommendation.opportunity.title}"`,
      type: "apply_to_opportunity",
    });
  }

  const negotiationTarget = getAgentRecommendations(
    agent,
    input.opportunities.filter(
      (opportunity) => !existingNegotiationOpportunityIds.has(opportunity.id),
    ),
  ).find((recommendation) => recommendation.matchPercentage >= 72);

  if (negotiationTarget) {
    actions.push({
      id: `negotiate-${agent.id}-${negotiationTarget.opportunity.id}`,
      agentId: agent.id,
      agentName: agent.name,
      description: "High match with room to propose a stronger project rate.",
      opportunityId: negotiationTarget.opportunity.id,
      opportunityTitle: negotiationTarget.opportunity.title,
      title: `Negotiate higher rate on "${negotiationTarget.opportunity.title}"`,
      type: "start_negotiation",
    });
  }

  const activeContract = input.contracts.find(
    (contract) =>
      contract.agent === agent.name &&
      (contract.status === "Active" || contract.status === "In Review"),
  );
  const activeWorkspace = activeContract
    ? input.workspaces.find((workspace) => workspace.contractId === activeContract.id)
    : undefined;
  const submittedDeliverable = activeWorkspace?.deliverables.find(
    (deliverable) => deliverable.status === "submitted",
  );
  const openMilestone = activeWorkspace?.milestones.find(
    (milestone) => !milestone.completed,
  );

  if (activeContract && submittedDeliverable) {
    actions.push({
      id: `follow-up-${agent.id}-${activeContract.id}`,
      agentId: agent.id,
      agentName: agent.name,
      contractId: activeContract.id,
      contractTitle: activeContract.title,
      description: "A submitted deliverable is waiting for review.",
      title: `Follow up on pending approval for "${submittedDeliverable.title}"`,
      type: "send_follow_up",
    });
  }

  if (activeContract && !submittedDeliverable) {
    actions.push({
      id: `deliverable-${agent.id}-${activeContract.id}`,
      agentId: agent.id,
      agentName: agent.name,
      contractId: activeContract.id,
      contractTitle: activeContract.title,
      description: "Submit a placeholder progress deliverable to move work forward.",
      title: `Submit deliverable for "${activeContract.title}"`,
      type: "submit_deliverable",
    });
  }

  if (activeContract && openMilestone) {
    actions.push({
      id: `milestone-${agent.id}-${activeContract.id}-${openMilestone.id}`,
      agentId: agent.id,
      agentName: agent.name,
      contractId: activeContract.id,
      contractTitle: activeContract.title,
      milestoneId: openMilestone.id,
      description: `Complete milestone "${openMilestone.title}".`,
      title: "Complete milestone due soon",
      type: "complete_milestone",
    });
  }

  if (actions.length === 0 && getAgentStatus(agent, input) === "Available") {
    const reviewTarget = getAgentRecommendations(agent, input.opportunities)[0];

    if (reviewTarget) {
      actions.push({
        id: `review-${agent.id}-${reviewTarget.opportunity.id}`,
        agentId: agent.id,
        agentName: agent.name,
        description: "Review a strong-fit brief and decide whether to apply.",
        opportunityId: reviewTarget.opportunity.id,
        opportunityTitle: reviewTarget.opportunity.title,
        title: `Review "${reviewTarget.opportunity.title}"`,
        type: "apply_to_opportunity",
      });
    }
  }

  return actions.slice(0, 4);
}

export function getHubSuggestedActions(input: RecommendationInput) {
  return input.agents.flatMap((agent) => getSuggestedAgentActions(agent, input)).slice(0, 8);
}

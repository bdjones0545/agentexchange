import type { Agent } from "./agents";
import { getAgentSkills } from "./agents";
import { applyWorkspaceToContract } from "./contractWorkspace";
import type { Opportunity } from "./marketplace";
import type { Contract } from "./operations";
import type {
  AgentActivityEvent,
  AgentSimulatedStatus,
  Application,
  ContractWorkspace,
  HireRequest,
  Negotiation,
  SavedOpportunity,
} from "../state/marketplaceTypes";

type IntelligenceInput = {
  activities: AgentActivityEvent[];
  agents: Agent[];
  applications: Application[];
  contracts: Contract[];
  hireRequests: HireRequest[];
  negotiations: Negotiation[];
  savedOpportunities?: SavedOpportunity[];
  workspaces: ContractWorkspace[];
};

export type AgentReputation = {
  approvalRate: number;
  contractsCompleted: number;
  deliverableAcceptanceRate: number;
  responseRate: number;
  trustScore: number;
  trustScoreTrend: string;
};

export type AgentDashboardMetrics = {
  activeContracts: number;
  completedContracts: number;
  currentWorkload: number;
  pendingReviews: number;
};

export function applyWorkspacesToContracts(
  contracts: Contract[],
  workspaces: ContractWorkspace[],
) {
  return contracts.map((contract) => {
    const workspace = workspaces.find(
      (candidate) => candidate.contractId === contract.id,
    );

    return workspace ? applyWorkspaceToContract(contract, workspace) : contract;
  });
}

function getAgentContracts(agent: Agent, input: IntelligenceInput) {
  return applyWorkspacesToContracts(input.contracts, input.workspaces).filter(
    (contract) => contract.agent === agent.name,
  );
}

function getAgentWorkspaces(agent: Agent, input: IntelligenceInput) {
  const contractIds = getAgentContracts(agent, input).map((contract) => contract.id);

  return input.workspaces.filter((workspace) =>
    contractIds.includes(workspace.contractId),
  );
}

export function getAgentStatus(
  agent: Agent,
  input: IntelligenceInput,
): AgentSimulatedStatus {
  const agentContracts = getAgentContracts(agent, input);
  const agentWorkspaces = getAgentWorkspaces(agent, input);
  const hasSubmittedDeliverable = agentWorkspaces.some((workspace) =>
    workspace.deliverables.some((deliverable) => deliverable.status === "submitted"),
  );

  if (hasSubmittedDeliverable) {
    return "Awaiting Approval";
  }

  if (
    agentContracts.some(
      (contract) =>
        contract.status === "Active" || contract.status === "In Review",
    )
  ) {
    return "Active Contract";
  }

  if (
    input.negotiations.some(
      (negotiation) =>
        negotiation.agentId === agent.id || negotiation.agentName === agent.name,
    )
  ) {
    return "Negotiating";
  }

  if (
    input.applications.some(
      (application) =>
        application.agentId === agent.id && application.status === "pending",
    )
  ) {
    return "Applied";
  }

  if (agentContracts.some((contract) => contract.status === "Completed")) {
    return "Completed Work";
  }

  if ((input.savedOpportunities ?? []).length > 0) {
    return "Reviewing Opportunity";
  }

  return "Available";
}

export function getAgentReputation(
  agent: Agent,
  input: IntelligenceInput,
): AgentReputation {
  const agentContracts = getAgentContracts(agent, input);
  const agentWorkspaces = getAgentWorkspaces(agent, input);
  const decisions = agentWorkspaces.flatMap((workspace) =>
    workspace.deliverables.flatMap((deliverable) => deliverable.decisions ?? []),
  );
  const approvedDecisions = decisions.filter(
    (decision) => decision.status === "approved",
  ).length;
  const agentApplications = input.applications.filter(
    (application) => application.agentId === agent.id,
  );
  const acceptedApplications = agentApplications.filter(
    (application) => application.status === "accepted",
  ).length;
  const actionCount = input.activities.filter(
    (activity) => activity.agentId === agent.id || activity.agentName === agent.name,
  ).length;
  const approvalRate =
    agentApplications.length > 0
      ? Math.round((acceptedApplications / agentApplications.length) * 100)
      : 100;
  const deliverableAcceptanceRate =
    decisions.length > 0 ? Math.round((approvedDecisions / decisions.length) * 100) : 100;
  const responseRate = Math.min(100, 88 + actionCount * 2);
  const contractsCompleted = agentContracts.filter(
    (contract) => contract.status === "Completed",
  ).length;
  const trustScore = Math.min(
    100,
    Math.round(
      agent.trustScore * 0.7 +
        approvalRate * 0.1 +
        deliverableAcceptanceRate * 0.1 +
        responseRate * 0.1,
    ),
  );

  return {
    approvalRate,
    contractsCompleted,
    deliverableAcceptanceRate,
    responseRate,
    trustScore,
    trustScoreTrend: actionCount > 0 ? `+${Math.min(9, actionCount)} pts` : "Stable",
  };
}

export function getAgentDashboardMetrics(
  agent: Agent,
  input: IntelligenceInput,
): AgentDashboardMetrics {
  const agentContracts = getAgentContracts(agent, input);
  const pendingReviews = getAgentWorkspaces(agent, input).reduce(
    (total, workspace) =>
      total +
      workspace.deliverables.filter(
        (deliverable) => deliverable.status === "submitted",
      ).length,
    0,
  );
  const activeContracts = agentContracts.filter(
    (contract) => contract.status === "Active" || contract.status === "In Review",
  ).length;
  const completedContracts = agentContracts.filter(
    (contract) => contract.status === "Completed",
  ).length;

  return {
    activeContracts,
    completedContracts,
    currentWorkload: activeContracts + pendingReviews,
    pendingReviews,
  };
}

export function getTopMatchingAgent(opportunity: Opportunity, agents: Agent[]) {
  const opportunityTerms = [
    ...opportunity.tags,
    ...(opportunity.requiredSkills ?? []),
    opportunity.category,
    opportunity.summary,
  ]
    .join(" ")
    .toLowerCase();

  return [...agents].sort((left, right) => {
    const leftScore = getAgentSkills(left).filter((skill) =>
      opportunityTerms.includes(skill.label.toLowerCase()),
    ).length;
    const rightScore = getAgentSkills(right).filter((skill) =>
      opportunityTerms.includes(skill.label.toLowerCase()),
    ).length;

    return rightScore - leftScore || right.trustScore - left.trustScore;
  })[0];
}

export function getOpportunityIntelligence(
  opportunity: Opportunity,
  agents: Agent[],
  input: Pick<IntelligenceInput, "applications" | "negotiations">,
) {
  const applicants = input.applications.filter(
    (application) => application.opportunityId === opportunity.id,
  );
  const negotiations = input.negotiations.filter(
    (negotiation) => negotiation.opportunityId === opportunity.id,
  );
  const latestApplication = applicants[0];
  const latestNegotiation = negotiations[0];

  return {
    applicants: applicants.length,
    latestActivity:
      latestApplication?.agentName
        ? `${latestApplication.agentName} applied`
        : latestNegotiation?.agentName
          ? `${latestNegotiation.agentName} entered negotiation`
          : "No agent activity yet",
    topMatchingAgent: getTopMatchingAgent(opportunity, agents),
  };
}

export function getHubAgentInsights(input: IntelligenceInput) {
  const recentAgentIds = new Set<string>();
  const recentlyActiveAgents = input.activities
    .map((activity) =>
      input.agents.find(
        (agent) => agent.id === activity.agentId || agent.name === activity.agentName,
      ),
    )
    .filter((agent): agent is Agent => Boolean(agent))
    .filter((agent) => {
      if (recentAgentIds.has(agent.id)) {
        return false;
      }

      recentAgentIds.add(agent.id);
      return true;
    })
    .slice(0, 4);
  const topPerformingAgents = [...input.agents]
    .sort(
      (left, right) =>
        getAgentReputation(right, input).trustScore -
        getAgentReputation(left, input).trustScore,
    )
    .slice(0, 4);
  const agentsAwaitingApproval = input.agents
    .filter((agent) => getAgentStatus(agent, input) === "Awaiting Approval")
    .slice(0, 4);
  const contractsNearCompletion = applyWorkspacesToContracts(
    input.contracts,
    input.workspaces,
  )
    .filter(
      (contract) =>
        contract.progress >= 80 &&
        contract.progress < 100 &&
        contract.status !== "Completed",
    )
    .slice(0, 4);

  return {
    agentsAwaitingApproval,
    contractsNearCompletion,
    recentlyActiveAgents,
    topPerformingAgents,
  };
}

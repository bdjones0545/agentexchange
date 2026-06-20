import type { Agent } from "./agents";
import type { Contract } from "./operations";
import type {
  AgentReview,
  ContractDispute,
  TrustBreakdown,
  VerificationStatus,
} from "../state/marketplaceTypes";

type AgentTrustInput = {
  agent: Agent;
  contracts: Contract[];
  disputes: ContractDispute[];
  reviews: AgentReview[];
};

export function getAgentReviews(agent: Agent, reviews: AgentReview[]) {
  return reviews.filter(
    (review) => review.agentId === agent.id || review.agentName === agent.name,
  );
}

export function getAgentCompletedContracts(agent: Agent, contracts: Contract[]) {
  return contracts.filter(
    (contract) =>
      contract.agent === agent.name && contract.status === "Completed",
  );
}

export function getAgentAverageRating(agent: Agent, reviews: AgentReview[]) {
  const agentReviews = getAgentReviews(agent, reviews);

  if (agentReviews.length === 0) {
    return 5;
  }

  return Number(
    (
      agentReviews.reduce((total, review) => total + review.rating, 0) /
      agentReviews.length
    ).toFixed(1),
  );
}

export function getAgentDisputes(
  agent: Agent,
  contracts: Contract[],
  disputes: ContractDispute[],
) {
  const agentContractIds = contracts
    .filter((contract) => contract.agent === agent.name)
    .map((contract) => contract.id);

  return disputes.filter((dispute) =>
    agentContractIds.includes(dispute.contractId),
  );
}

export function getTrustBreakdown({
  agent,
  contracts,
  disputes,
  reviews,
}: AgentTrustInput): TrustBreakdown {
  const agentContracts = contracts.filter((contract) => contract.agent === agent.name);
  const completedContracts = getAgentCompletedContracts(agent, contracts);
  const agentDisputes = getAgentDisputes(agent, contracts, disputes);
  const averageRating = getAgentAverageRating(agent, reviews);
  const repeatOrganizations = new Set(
    agentContracts
      .map((contract) => contract.organization)
      .filter(
        (organization, _, organizations) =>
          organizations.filter((candidate) => candidate === organization).length > 1,
      ),
  ).size;
  const approvalRate =
    agentContracts.length > 0
      ? Math.round((completedContracts.length / agentContracts.length) * 100)
      : 100;
  const disputeRate =
    agentContracts.length > 0
      ? Math.max(
          0,
          100 - Math.round((agentDisputes.length / agentContracts.length) * 100),
        )
      : 100;

  return {
    approvalRate,
    clientSatisfaction: Math.round((averageRating / 5) * 100),
    deliveryReliability: Math.min(100, Math.round(agent.trustScore)),
    disputeRate,
    repeatContractRate:
      agentContracts.length > 0
        ? Math.round((repeatOrganizations / agentContracts.length) * 100)
        : 80,
    responseSpeed: Math.min(100, 88 + completedContracts.length * 3),
  };
}

export function getVerificationStatus(input: AgentTrustInput): VerificationStatus {
  const completedContracts = getAgentCompletedContracts(
    input.agent,
    input.contracts,
  ).length;
  const averageRating = getAgentAverageRating(input.agent, input.reviews);
  const disputes = getAgentDisputes(
    input.agent,
    input.contracts,
    input.disputes,
  );
  const hasOpenDispute = disputes.some((dispute) => dispute.status !== "Resolved");

  if (hasOpenDispute) {
    return "Unverified";
  }

  if (averageRating >= 4.8 && completedContracts >= 2) {
    return "Top Rated";
  }

  if (input.agent.tier.toLowerCase().includes("enterprise")) {
    return "Enterprise Verified";
  }

  if (completedContracts > 0 || input.agent.trustScore >= 96) {
    return "Verified";
  }

  if (input.agent.tier === "Local Agent") {
    return "Rising Agent";
  }

  return "Unverified";
}

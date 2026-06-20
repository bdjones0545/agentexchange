import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { ContractHistoryCard } from "../components/ContractHistoryCard";
import { GlassCard } from "../components/GlassCard";
import { HireAgentModal } from "../components/HireAgentModal";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProfileStats } from "../components/ProfileStats";
import { SecondaryButton } from "../components/SecondaryButton";
import { SkillChip } from "../components/SkillChip";
import { StatusChip } from "../components/StatusChip";
import {
  getAgentDashboardMetrics,
  getAgentReputation,
  getAgentStatus,
} from "../data/agentIntelligence";
import {
  getAgentRecommendations,
  getSuggestedAgentActions,
} from "../data/agentRecommendations";
import {
  getAgentAverageRating,
  getAgentReviews,
  getTrustBreakdown,
  getVerificationStatus,
} from "../data/agentTrust";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { getAgentContractHistory, getAgentSkills } from "../data/agents";
import { getAllAgents, getAllOpportunities } from "../data/localSelectors";
import { contracts } from "../data/operations";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { VerificationBadge } from "../components/VerificationBadge";

export function AgentProfilePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    agentActivities,
    agentReviews,
    applications,
    approveSuggestedAgentAction,
    contractWorkspaces,
    contractDisputes,
    createdAgents,
    createdOpportunities,
    hireRequests,
    localContracts,
    negotiations,
    savedOpportunities,
  } = useAgentExchange();
  const [isHireModalOpen, setIsHireModalOpen] = useState(false);
  const allAgents = getAllAgents(createdAgents);
  const allOpportunities = getAllOpportunities(createdOpportunities);
  const allContracts = [...localContracts, ...contracts].map((contract) => {
    const workspace = contractWorkspaces.find(
      (candidate) => candidate.contractId === contract.id,
    );

    return workspace ? applyWorkspaceToContract(contract, workspace) : contract;
  });
  const agent = allAgents.find((candidate) => candidate.id === id);

  if (!agent) {
    return <Navigate replace to="/agents" />;
  }

  const agentSkills = getAgentSkills(agent);
  const agentContracts = getAgentContractHistory(agent);
  const intelligenceInput = {
    activities: agentActivities,
    agents: allAgents,
    applications,
    contracts: allContracts,
    hireRequests,
    negotiations,
    opportunities: allOpportunities,
    savedOpportunities,
    workspaces: contractWorkspaces,
  };
  const status = getAgentStatus(agent, intelligenceInput);
  const reputation = getAgentReputation(agent, intelligenceInput);
  const verificationStatus = getVerificationStatus({
    agent,
    contracts: allContracts,
    disputes: contractDisputes,
    reviews: agentReviews,
  });
  const trustBreakdown = getTrustBreakdown({
    agent,
    contracts: allContracts,
    disputes: contractDisputes,
    reviews: agentReviews,
  });
  const reviews = getAgentReviews(agent, agentReviews);
  const averageRating = getAgentAverageRating(agent, agentReviews);
  const dashboardMetrics = getAgentDashboardMetrics(agent, intelligenceInput);
  const recentActivity = agentActivities
    .filter(
      (activity) => activity.agentId === agent.id || activity.agentName === agent.name,
    )
    .slice(0, 4);
  const recommendations = getAgentRecommendations(agent, allOpportunities).slice(
    0,
    3,
  );
  const suggestedActions = getSuggestedAgentActions(agent, intelligenceInput);

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <button
        className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted transition hover:text-ae-primary"
        onClick={() => navigate("/agents")}
        type="button"
      >
        Back to agents
      </button>

      <GlassCard className="space-y-8 text-center">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="grid size-32 place-items-center rounded-full border border-ae-primary/30 bg-ae-primary/10 font-ae-label text-3xl font-semibold text-ae-primary shadow-ae-glow">
              {agent.avatarInitials}
            </div>
            <span className="absolute bottom-3 right-2 size-4 rounded-full border-2 border-ae-background bg-ae-emerald" />
          </div>

          <h1 className="mt-6 font-ae-display text-4xl font-bold leading-tight tracking-[-0.03em] text-ae-text sm:text-5xl">
            {agent.name}
          </h1>
          <p className="mt-2 text-lg text-ae-text-muted">{agent.specialty}</p>
          {agent.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ae-text-muted">
              {agent.description}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-primary">
              {agent.tier}
            </span>
            <VerificationBadge status={verificationStatus} />
            <StatusChip status={status} />
          </div>
        </div>

        <ProfileStats
          revenue={agent.revenue}
          successRate={`${reputation.approvalRate}%`}
          trustScore={reputation.trustScore}
        />
      </GlassCard>

      <GlassCard className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
              Trust Breakdown
            </p>
            <h2 className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
              {averageRating.toFixed(1)} average rating
            </h2>
          </div>
          <VerificationBadge status={verificationStatus} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Delivery reliability", trustBreakdown.deliveryReliability],
            ["Approval rate", trustBreakdown.approvalRate],
            ["Response speed", trustBreakdown.responseSpeed],
            ["Client satisfaction", trustBreakdown.clientSatisfaction],
            ["Dispute health", trustBreakdown.disputeRate],
            ["Repeat contract rate", trustBreakdown.repeatContractRate],
          ].map(([label, value]) => (
            <div
              className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4"
              key={label}
            >
              <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                {label}
              </p>
              <p className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
                {value}%
              </p>
            </div>
          ))}
        </div>
      </GlassCard>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Current Workload", dashboardMetrics.currentWorkload],
          ["Active Contracts", dashboardMetrics.activeContracts],
          ["Pending Reviews", dashboardMetrics.pendingReviews],
          ["Completed Contracts", dashboardMetrics.completedContracts],
          ["Trust Trend", reputation.trustScoreTrend],
        ].map(([label, value]) => (
          <GlassCard className="space-y-2 text-center" key={label}>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              {label}
            </p>
            <p className="font-ae-display text-2xl font-semibold text-ae-text">
              {value}
            </p>
          </GlassCard>
        ))}
      </section>

      <GlassCard className="grid gap-4 sm:grid-cols-3">
        {[
          ["Contracts Completed", reputation.contractsCompleted],
          ["Deliverable Acceptance", `${reputation.deliverableAcceptanceRate}%`],
          ["Response Rate", `${reputation.responseRate}%`],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              {label}
            </p>
            <p className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
              {value}
            </p>
          </div>
        ))}
      </GlassCard>

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Autonomous Suggestions
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="space-y-4">
            <h3 className="font-ae-display text-xl font-semibold text-ae-text">
              Recommended Opportunities
            </h3>
            {recommendations.map((recommendation) => (
              <div
                className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4"
                key={recommendation.opportunity.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ae-text">
                      {recommendation.opportunity.title}
                    </p>
                    <p className="mt-1 text-sm text-ae-text-muted">
                      {recommendation.reasons[0]?.detail}
                    </p>
                  </div>
                  <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-3 py-1 font-ae-label text-xs font-semibold text-ae-primary">
                    {recommendation.matchPercentage}%
                  </span>
                </div>
                {recommendation.missingSkills.length > 0 ? (
                  <p className="mt-2 text-xs text-ae-text-muted">
                    Missing: {recommendation.missingSkills.join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </GlassCard>
          <GlassCard className="space-y-4">
            <h3 className="font-ae-display text-xl font-semibold text-ae-text">
              Suggested Actions
            </h3>
            {suggestedActions.length > 0 ? (
              suggestedActions.map((action) => (
                <div
                  className="space-y-3 rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4"
                  key={action.id}
                >
                  <div>
                    <p className="font-semibold text-ae-text">{action.title}</p>
                    <p className="mt-1 text-sm text-ae-text-muted">
                      {action.description}
                    </p>
                  </div>
                  <PrimaryButton
                    className="w-full sm:w-auto"
                    onClick={() => approveSuggestedAgentAction(action)}
                  >
                    Approve Action
                  </PrimaryButton>
                </div>
              ))
            ) : (
              <p className="text-sm text-ae-text-muted">
                No suggested actions available yet.
              </p>
            )}
          </GlassCard>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Skills
        </h2>
        <div className="flex flex-wrap gap-3">
          {agentSkills.map((skill) => (
            <SkillChip key={skill.id} skill={skill} />
          ))}
        </div>
      </section>

      {agent.startingRate || agent.toolAccess?.length ? (
        <GlassCard className="grid gap-4 sm:grid-cols-2">
          {agent.startingRate ? (
            <div>
              <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                Starting rate
              </p>
              <p className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
                {agent.startingRate}
              </p>
            </div>
          ) : null}
          {agent.toolAccess?.length ? (
            <div>
              <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                Tool access
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {agent.toolAccess.map((tool) => (
                  <span
                    className="rounded-full border border-white/[0.06] bg-white/[0.05] px-3 py-1 font-ae-label text-xs font-semibold text-ae-text-muted"
                    key={tool}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </GlassCard>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Contract History
        </h2>
        <div className="grid gap-4">
          {agentContracts.length > 0 ? (
            agentContracts.map((contract) => (
              <ContractHistoryCard contract={contract} key={contract.id} />
            ))
          ) : (
            <GlassCard className="text-ae-text-muted">
              No contract history yet for this local agent.
            </GlassCard>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Reviews
        </h2>
        <div className="grid gap-3">
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <GlassCard className="space-y-3" key={review.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-ae-display text-xl font-semibold text-ae-text">
                      {review.rating}/5 from {review.organization}
                    </p>
                    <p className="text-sm text-ae-text-muted">
                      {review.contractTitle}
                    </p>
                  </div>
                  <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-primary">
                    {new Date(review.createdAt).toLocaleDateString("en-US", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-sm leading-6 text-ae-text-muted">
                  {review.review}
                </p>
              </GlassCard>
            ))
          ) : (
            <GlassCard className="text-ae-text-muted">
              No organization reviews yet. Completed contracts can receive local
              reviews from the contract workspace.
            </GlassCard>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Agent Activity Feed
        </h2>
        <div className="grid gap-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity) => (
              <GlassCard className="text-sm text-ae-text-muted" key={activity.id}>
                <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-primary">
                  {new Date(activity.createdAt).toLocaleString("en-US", {
                    day: "2-digit",
                    hour: "numeric",
                    minute: "2-digit",
                    month: "short",
                  })}
                </p>
                <p className="mt-2">{activity.message}</p>
              </GlassCard>
            ))
          ) : (
            <GlassCard className="text-ae-text-muted">
              No simulated activity yet for this agent.
            </GlassCard>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <PrimaryButton onClick={() => setIsHireModalOpen(true)}>
          Hire Agent
        </PrimaryButton>
        <SecondaryButton>View Network Connections</SecondaryButton>
      </div>
      <HireAgentModal
        agent={agent}
        isOpen={isHireModalOpen}
        onClose={() => setIsHireModalOpen(false)}
      />
    </section>
  );
}

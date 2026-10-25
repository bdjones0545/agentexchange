import { NotFoundPage } from "./NotFoundPage";
import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ContractHistoryCard } from "../components/ContractHistoryCard";
import { GlassCard } from "../components/GlassCard";
import { HireAgentModal } from "../components/HireAgentModal";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProfileStats } from "../components/ProfileStats";
import { SkillChip } from "../components/SkillChip";
import { StatusChip } from "../components/StatusChip";
import {
  getAgentDashboardMetrics,
  getAgentStatus,
} from "../data/agentIntelligence";
import {
  getAgentRecommendations,
  getSuggestedAgentActions,
} from "../data/agentRecommendations";
import {
  getAgentRatingLabel,
  getAgentDisputes,
  getAgentReviews,
  getTrustBreakdown,
  getVerificationStatus,
} from "../data/agentTrust";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { getAgentSkills, type ContractHistory } from "../data/agents";
import { getAllAgents, getAllOpportunities } from "../data/localSelectors";
import { contractPriceLabel } from "../lib/money";
import { jobKind } from "../lib/jobCatalog";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { VerificationBadge } from "../components/VerificationBadge";
import { WorkerBadge } from "../components/WorkerBadge";

// Ratings and badges come from stored columns and real reviews in every mode;
// the demo heuristics invented a 5.0 rating and inferred verification.
const STORED_TRUST = { sharedMode: true } as const;

const eyebrow = "font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary";
const sectionHeading = "font-ae-display text-xl font-semibold tracking-tight text-ae-text sm:text-2xl";
const tileLabel = "font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted";

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-5 py-6 text-sm leading-6 text-ae-text-muted">
      {children}
    </p>
  );
}

export function AgentProfilePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    agentActivities,
    agentReviews,
    applications,
    approveSuggestedAgentAction,
    ownsAgent,
    contractWorkspaces,
    contractDisputes,
    createdAgents,
    createdOpportunities,
    hireRequests,
    localContracts,
    negotiations,
    isSharedMode,
    isWorkerAgent,
    loading,
  } = useAgentExchange();
  const [isHireModalOpen, setIsHireModalOpen] = useState(false);
  const allAgents = getAllAgents(createdAgents);
  const allOpportunities = getAllOpportunities(createdOpportunities);
  const allContracts = localContracts.map((contract) => {
    const workspace = contractWorkspaces.find(
      (candidate) => candidate.contractId === contract.id,
    );

    return workspace ? applyWorkspaceToContract(contract, workspace) : contract;
  });
  const agent = allAgents.find((candidate) => candidate.id === id);

  // A cold load of a deep link lands here before the shared state has been
  // read; redirecting then would bounce every shared link back to the list.
  if (!agent && loading) {
    return (
      <p className="mx-auto max-w-5xl rounded-2xl border border-white/[0.08] bg-ae-surface/60 px-5 py-4 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text-muted motion-safe:animate-pulse">
        Loading
      </p>
    );
  }

  if (!agent) {
    return <NotFoundPage />;
  }

  const agentSkills = getAgentSkills(agent);
  // The viewer's own saved briefs say nothing about this agent, so they are
  // not part of its status.
  const intelligenceInput = {
    activities: agentActivities,
    agents: allAgents,
    applications,
    contracts: allContracts,
    hireRequests,
    negotiations,
    opportunities: allOpportunities,
    workspaces: contractWorkspaces,
  };
  const status = getAgentStatus(agent, intelligenceInput);
  const verificationStatus = getVerificationStatus(
    {
      agent,
      contracts: allContracts,
      disputes: contractDisputes,
      reviews: agentReviews,
    },
    STORED_TRUST,
  );
  const trustBreakdown = getTrustBreakdown({
    agent,
    contracts: allContracts,
    disputes: contractDisputes,
    reviews: agentReviews,
  });
  const reviews = getAgentReviews(agent, agentReviews);
  // Only signals that come from real records are shown. A tile with no data
  // behind it is left out rather than shown at a flattering default.
  const agentContracts = allContracts.filter((contract) => contract.agent === agent.name);
  const agentWorkspaceDecisions = contractWorkspaces
    .filter((workspace) => agentContracts.some((contract) => contract.id === workspace.contractId))
    .flatMap((workspace) => workspace.deliverables.flatMap((deliverable) => deliverable.decisions ?? []));
  const decidedDeliverables = agentWorkspaceDecisions.length;
  const approvedDeliverables = agentWorkspaceDecisions.filter((decision) => decision.status === "approved").length;
  const openDisputes = getAgentDisputes(agent, allContracts, contractDisputes).filter((dispute) => dispute.status !== "Resolved").length;
  const trustTiles: Array<[string, number]> = [
    ...(decidedDeliverables > 0
      ? [["Deliverable acceptance", Math.round((approvedDeliverables / decidedDeliverables) * 100)] as [string, number]]
      : []),
    ...(agentContracts.length > 0 ? [["Dispute health", trustBreakdown.disputeRate] as [string, number]] : []),
    ...(reviews.length > 0 ? [["Client satisfaction", trustBreakdown.clientSatisfaction] as [string, number]] : []),
  ];
  const dashboardMetrics = getAgentDashboardMetrics(agent, intelligenceInput);
  const workTiles: Array<[string, string | number]> = [
    ["Current workload", dashboardMetrics.currentWorkload],
    ["Active contracts", dashboardMetrics.activeContracts],
    ["Pending reviews", dashboardMetrics.pendingReviews],
    ["Completed contracts", dashboardMetrics.completedContracts],
    ["Deliverables approved", `${approvedDeliverables} of ${decidedDeliverables}`],
    ["Open disputes", openDisputes],
  ];
  // Contract history is the real contracts this viewer can see for the agent.
  const contractHistory: ContractHistory[] = agentContracts.map((contract) => ({
    accent: contract.accent,
    date: [contract.startDate && `Started ${contract.startDate}`, contract.dueDate && `due ${contract.dueDate}`]
      .filter(Boolean)
      .join(" · "),
    id: contract.id,
    rating: reviews.find((review) => review.contractId === contract.id)?.rating ?? 0,
    summary: `${contract.organization} · ${contract.status}`,
    title: contract.title,
    value: contractPriceLabel(contract),
  }));
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
    <section className="mx-auto max-w-6xl space-y-8">
      <button
        className="group inline-flex items-center gap-2 font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted transition hover:text-ae-primary"
        onClick={() => navigate("/agents")}
        type="button"
      >
        <span aria-hidden className="transition group-hover:-translate-x-0.5">←</span>
        Back to agents
      </button>

      <header className="relative isolate rounded-3xl border border-white/10 bg-gradient-to-b from-ae-surface to-ae-background-deep shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05),0_30px_80px_-40px_rgb(0_0_0_/_0.9)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
          <div className="ax-grid-bg absolute inset-0 opacity-60" />
          <div className="ax-aurora absolute -right-24 -top-32 size-[26rem] rounded-full bg-ae-primary/[0.12] blur-[100px]" />
          <div className="ax-aurora absolute -bottom-40 -left-20 size-[22rem] rounded-full bg-ae-cyan/[0.08] blur-[100px]" style={{ animationDelay: "-8s" }} />
        </div>

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-8">
          <div
            aria-hidden
            className="ax-pop grid size-20 place-items-center rounded-3xl border border-ae-primary/30 bg-gradient-to-br from-ae-primary/25 via-ae-primary/10 to-ae-cyan/10 font-ae-label text-2xl font-semibold text-ae-primary shadow-[0_0_48px_-8px_rgb(120_240_188_/_0.45)] sm:size-24 sm:text-3xl"
          >
            {agent.avatarInitials}
          </div>

          <div className="min-w-0">
            <p className="truncate font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
              {agent.specialty}
            </p>
            <h1 className="mt-2 break-words font-ae-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-ae-text sm:text-5xl">
              {agent.name}
            </h1>
            {agent.description ? (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ae-text-muted sm:text-base sm:leading-7">
                {agent.description}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {isSharedMode ? null : (
                <span className="inline-flex items-center rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-ae-text-muted">
                  {agent.tier}
                </span>
              )}
              <VerificationBadge status={verificationStatus} />
              {isWorkerAgent(agent) ? <WorkerBadge detailed /> : null}
              <StatusChip status={status} />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <PrimaryButton onClick={() => setIsHireModalOpen(true)}>
              Hire Agent
            </PrimaryButton>
          </div>
        </div>

        <div className="border-t border-white/[0.07] p-6 sm:px-8">
          <ProfileStats
            revenue={agent.revenue}
            successRate={agent.successRate}
            trustScore={agent.trustScore}
          />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-8">
          <GlassCard className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className={eyebrow}>Trust Breakdown</p>
                <h2 className={`mt-2 ${sectionHeading}`}>
                  {getAgentRatingLabel(agent, agentReviews, STORED_TRUST)}
                </h2>
              </div>
              <VerificationBadge status={verificationStatus} />
            </div>
            {trustTiles.length === 0 ? (
              <EmptyNote>
                No completed contracts, reviews or disputes yet. Trust signals appear here as organizations work with this agent.
              </EmptyNote>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {trustTiles.map(([label, value]) => (
                  <div
                    className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4"
                    key={label}
                  >
                    <p className={tileLabel}>{label}</p>
                    <p className="mt-2 font-ae-display text-2xl font-semibold tabular-nums text-ae-text">
                      {value}%
                    </p>
                    <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-ae-primary to-ae-cyan" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <section aria-labelledby="work-title" className="space-y-4">
            <h2 id="work-title" className={sectionHeading}>Work on AgentExchange</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {workTiles.map(([label, value]) => (
                <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-ae-surface/70 p-4 sm:p-5" key={label}>
                  <dt className={tileLabel}>{label}</dt>
                  <dd className="mt-2 truncate font-ae-display text-2xl font-semibold tabular-nums text-ae-text">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="history-title" className="space-y-4">
            <h2 id="history-title" className={sectionHeading}>Contract History</h2>
            {contractHistory.length > 0 ? (
              <div className="grid gap-4">
                {contractHistory.map((contract) => (
                  <ContractHistoryCard contract={contract} key={contract.id} />
                ))}
              </div>
            ) : (
              <EmptyNote>No contracts to show yet.</EmptyNote>
            )}
          </section>

          <section aria-labelledby="reviews-title" className="space-y-4">
            <h2 id="reviews-title" className={sectionHeading}>Reviews</h2>
            {reviews.length > 0 ? (
              <div className="grid gap-3">
                {reviews.map((review) => (
                  <GlassCard className="space-y-3" key={review.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-ae-display text-lg font-semibold text-ae-text">
                          <span aria-hidden className="mr-2 text-ae-amber">★</span>
                          {review.rating}/5 from {review.organization}
                        </p>
                        <p className="text-sm text-ae-text-muted">
                          {review.contractTitle}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-ae-text-muted">
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
                ))}
              </div>
            ) : (
              <EmptyNote>
                {isSharedMode
                  ? "No organization reviews yet. The organization on a contract can leave one review for it."
                  : "No organization reviews yet. Completed contracts can receive local reviews from the contract workspace."}
              </EmptyNote>
            )}
          </section>

          <section aria-labelledby="activity-title" className="space-y-4">
            <h2 id="activity-title" className={sectionHeading}>Agent Activity Feed</h2>
            {recentActivity.length > 0 ? (
              <ol className="relative space-y-3 border-l border-white/[0.08] pl-5">
                {recentActivity.map((activity) => (
                  <li className="relative" key={activity.id}>
                    <span aria-hidden className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full border-2 border-ae-background bg-ae-primary" />
                    <p className="text-xs text-ae-primary">
                      {new Date(activity.createdAt).toLocaleString("en-US", {
                        day: "2-digit",
                        hour: "numeric",
                        minute: "2-digit",
                        month: "short",
                      })}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-ae-text-muted">{activity.message}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyNote>No activity yet for this agent.</EmptyNote>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          {agent.jobKinds?.length ? (
            <GlassCard className="space-y-4 p-6">
              <h2 className={sectionHeading}>Jobs it takes</h2>
              <ul className="flex flex-wrap gap-2">
                {agent.jobKinds.map((id) => jobKind(id)).filter((k) => k !== null).map((k) => (
                  <li
                    key={k.id}
                    className="rounded-full border border-ae-primary/20 bg-ae-primary/[0.08] px-3 py-1 text-xs text-ae-primary"
                    title={k.summary}
                  >
                    {k.label}
                    {k.family === "managed_service" ? <span className="text-ae-text-muted"> · weekly</span> : null}
                  </li>
                ))}
              </ul>
            </GlassCard>
          ) : null}
          {agent.startingRate || agent.toolAccess?.length ? (
            <GlassCard className="space-y-5 p-6">
              {agent.startingRate ? (
                <div>
                  <p className={tileLabel}>Starting rate</p>
                  <p className="mt-1.5 font-ae-display text-2xl font-semibold tracking-tight text-ae-text">
                    {agent.startingRate}
                  </p>
                </div>
              ) : null}
              {agent.toolAccess?.length ? (
                <div className={agent.startingRate ? "border-t border-white/[0.06] pt-5" : ""}>
                  <p className={tileLabel}>Tool access</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {agent.toolAccess.map((tool) => (
                      <span
                        className="inline-block max-w-full truncate rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 font-mono text-xs text-ae-text-muted"
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

          <GlassCard className="space-y-4 p-6">
            <h2 className={sectionHeading}>Skills</h2>
            {agentSkills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {agentSkills.map((skill) => (
                  <SkillChip key={skill.id} skill={skill} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ae-text-muted">No skills listed yet.</p>
            )}
          </GlassCard>

          <section aria-labelledby="suggestions-title" className="space-y-4">
            <h2 id="suggestions-title" className={sectionHeading}>Autonomous Suggestions</h2>
            <GlassCard className="space-y-3 p-5">
              <h3 className="font-semibold text-ae-text">Recommended Opportunities</h3>
              {recommendations.length > 0 ? (
                recommendations.map((recommendation) => (
                  <div
                    className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4"
                    key={recommendation.opportunity.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-ae-text">
                          {recommendation.opportunity.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-ae-text-muted">
                          {recommendation.reasons[0]?.detail}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-ae-primary/20 bg-ae-primary/10 px-2.5 py-1 text-xs font-medium tabular-nums text-ae-primary">
                        {recommendation.matchPercentage}%
                      </span>
                    </div>
                    {recommendation.missingSkills.length > 0 ? (
                      <p className="mt-2 text-xs text-ae-text-muted">
                        Missing: {recommendation.missingSkills.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-ae-text-muted">No open briefs to recommend yet.</p>
              )}
            </GlassCard>
            {ownsAgent(agent.id) ? <GlassCard className="space-y-3 p-5">
              <h3 className="font-semibold text-ae-text">Suggested Actions</h3>
              {suggestedActions.length > 0 ? (
                suggestedActions.map((action) => (
                  <div
                    className="space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4"
                    key={action.id}
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-ae-text">{action.title}</p>
                      <p className="mt-1 text-xs leading-5 text-ae-text-muted">
                        {action.description}
                      </p>
                    </div>
                    <PrimaryButton
                      className="w-full px-4 py-2.5"
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
            </GlassCard> : null}
          </section>
        </aside>
      </div>

      <HireAgentModal
        agent={agent}
        isOpen={isHireModalOpen}
        onClose={() => setIsHireModalOpen(false)}
      />
    </section>
  );
}

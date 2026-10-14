import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { ActivityTimeline } from "../components/ActivityTimeline";
import { AgentNetworkGraph } from "../components/AgentNetworkGraph";
import { GlassCard } from "../components/GlassCard";
import { LiveActivityCard } from "../components/LiveActivityCard";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { getHubSuggestedActions } from "../data/agentRecommendations";
import {
  getAgentReputation,
  getAgentStatus,
  getHubAgentInsights,
} from "../data/agentIntelligence";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { getAllAgents, getAllOpportunities } from "../data/localSelectors";
import type { NetworkNode } from "../data/operations";
import { getLiveHubMetrics, getLiveTimeline } from "../data/liveMetrics";
import { useAgentExchange } from "../state/AgentExchangeContext";

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-ae-display text-2xl font-semibold tracking-tight text-ae-text sm:text-3xl">
        {title}
      </h2>
    </div>
  );
}

function InsightTile({ children, count, dot, title }: { children: ReactNode; count?: number; dot: string; title: string }) {
  return (
    <GlassCard className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 font-ae-display text-base font-semibold text-ae-text">
          <span aria-hidden className={`size-2 shrink-0 rounded-full ${dot}`} />
          <span className="truncate">{title}</span>
        </h3>
        {count !== undefined ? (
          <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-ae-label text-[11px] font-semibold tabular-nums text-ae-text-muted">
            {count}
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-2.5">{children}</div>
    </GlassCard>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/[0.1] px-3 py-4 text-center text-sm text-ae-text-muted">{children}</p>;
}

export function HubPage() {
  const navigate = useNavigate();
  const {
    agentActivities,
    applications,
    approveSuggestedAgentAction,
    contractWorkspaces,
    createdAgents,
    createdOpportunities,
    hireRequests,
    isSharedMode,
    localContracts,
    negotiations,
    savedOpportunities,
  } = useAgentExchange();
  const allAgents = getAllAgents(createdAgents);
  const allOpportunities = getAllOpportunities(createdOpportunities);
  const allContracts = localContracts.map((contract) => {
    const workspace = contractWorkspaces.find(
      (candidate) => candidate.contractId === contract.id,
    );

    return workspace ? applyWorkspaceToContract(contract, workspace) : contract;
  });
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
  const hubInsights = getHubAgentInsights(intelligenceInput);
  // Every tile and timeline entry comes from the user's own rows.
  const metrics = getLiveHubMetrics({
    agents: createdAgents,
    contracts: allContracts,
    hireRequests,
    opportunities: createdOpportunities,
  });
  const timeline = getLiveTimeline(agentActivities);
  const suggestedActions = getHubSuggestedActions(intelligenceInput);
  // The agents on the viewer's own contracts, busiest first.
  const agentLoad = (name: string) => {
    const own = allContracts.filter((contract) => contract.agent === name);
    const inProgress = own.filter((contract) => contract.status !== "Completed").length;
    return { completed: own.length - inProgress, inProgress };
  };
  const agentNodes: NetworkNode[] = Array.from(new Set(allContracts.map((contract) => contract.agent)))
    .map((name) => ({ name, ...agentLoad(name) }))
    .sort((left, right) => right.inProgress - left.inProgress || right.completed - left.completed)
    .slice(0, 6)
    .map(({ completed, inProgress, name }): NetworkNode => ({
      accent: inProgress > 0 ? "emerald" : "violet",
      id: name,
      name,
      specialty: [
        inProgress > 0 ? `${inProgress} in progress` : "",
        completed > 0 ? `${completed} completed` : "",
      ].filter(Boolean).join(" · "),
    }));

  return (
    <section className="space-y-12">
      <PageHeader
        actions={
          <PrimaryButton className="w-full sm:w-auto" onClick={() => navigate("/contracts")}>
            View Contracts
          </PrimaryButton>
        }
        description="Your contracts, hire requests and agent activity, as recorded."
        eyebrow="Agent Hub"
        title="Operational center for autonomous execution."
      />

      <section aria-label="Workspace metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {metrics.map((metric) => (
          <LiveActivityCard key={metric.id} metric={metric} />
        ))}
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ActivityTimeline events={timeline} />
        <AgentNetworkGraph nodes={agentNodes} />
      </section>

      <section className="space-y-6">
        <SectionHeading eyebrow="Agent Intelligence" title="Autonomous marketplace signals" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InsightTile count={hubInsights.recentlyActiveAgents.length} dot="bg-ae-cyan" title="Recently Active Agents">
            {hubInsights.recentlyActiveAgents.length > 0 ? (
              hubInsights.recentlyActiveAgents.map((agent) => (
                <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5" key={agent.id}>
                  <p className="truncate font-semibold text-ae-text">{agent.name}</p>
                  <p className="truncate text-sm text-ae-text-muted">
                    {getAgentStatus(agent, intelligenceInput)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyLine>No agent activity recorded yet.</EmptyLine>
            )}
          </InsightTile>
          <InsightTile count={hubInsights.topPerformingAgents.length} dot="bg-ae-primary" title="Highest Trust">
            {hubInsights.topPerformingAgents.length > 0 ? (
              hubInsights.topPerformingAgents.map((agent) => (
                <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5" key={agent.id}>
                  <p className="truncate font-semibold text-ae-text">{agent.name}</p>
                  <span className="shrink-0 font-ae-label text-xs font-semibold tabular-nums text-ae-primary">
                    Trust {isSharedMode ? agent.trustScore : getAgentReputation(agent, intelligenceInput).trustScore}
                  </span>
                </div>
              ))
            ) : (
              <EmptyLine>No agents listed yet.</EmptyLine>
            )}
          </InsightTile>
          <InsightTile count={hubInsights.agentsAwaitingApproval.length} dot="bg-ae-amber" title="Awaiting Approval">
            {hubInsights.agentsAwaitingApproval.length > 0 ? (
              hubInsights.agentsAwaitingApproval.map((agent) => (
                <p className="truncate rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 font-semibold text-ae-text" key={agent.id}>
                  {agent.name}
                </p>
              ))
            ) : (
              <EmptyLine>No agents awaiting approval.</EmptyLine>
            )}
          </InsightTile>
          <InsightTile count={hubInsights.contractsNearCompletion.length} dot="bg-ae-emerald" title="Near Completion">
            {hubInsights.contractsNearCompletion.length > 0 ? (
              hubInsights.contractsNearCompletion.map((contract) => (
                <button
                  className="block w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left text-sm text-ae-text-muted transition hover:border-ae-primary/30 hover:text-ae-primary"
                  key={contract.id}
                  onClick={() => navigate(`/contracts/${contract.id}`)}
                  type="button"
                >
                  <span className="block truncate font-semibold text-ae-text">
                    {contract.title}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                      <span className="block h-full rounded-full bg-ae-primary" style={{ width: `${Math.min(100, Math.max(0, contract.progress))}%` }} />
                    </span>
                    <span className="shrink-0 tabular-nums">{contract.progress}% complete</span>
                  </span>
                </button>
              ))
            ) : (
              <EmptyLine>No contracts near completion.</EmptyLine>
            )}
          </InsightTile>
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading eyebrow="Autonomous Suggestions" title="Recommended next moves" />
        <div className="grid gap-4 lg:grid-cols-2">
          {suggestedActions.length > 0 ? (
            suggestedActions.map((action) => (
              <GlassCard className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between" interactive key={action.id}>
                <div className="min-w-0">
                  <p className="truncate font-ae-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
                    {action.agentName}
                  </p>
                  <h3 className="mt-1.5 break-words font-ae-display text-lg font-semibold leading-snug tracking-tight text-ae-text">
                    {action.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-ae-text-muted">
                    {action.description}
                  </p>
                </div>
                <PrimaryButton className="w-full shrink-0 sm:w-auto" onClick={() => approveSuggestedAgentAction(action)}>
                  Approve
                </PrimaryButton>
              </GlassCard>
            ))
          ) : (
            <GlassCard className="text-sm text-ae-text-muted lg:col-span-2">
              No autonomous suggestions available yet.
            </GlassCard>
          )}
        </div>
      </section>
    </section>
  );
}

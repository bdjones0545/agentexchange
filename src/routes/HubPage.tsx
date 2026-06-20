import { useNavigate } from "react-router-dom";

import { ActivityTimeline } from "../components/ActivityTimeline";
import { AgentNetworkGraph } from "../components/AgentNetworkGraph";
import { CollaborationCard } from "../components/CollaborationCard";
import { LiveActivityCard } from "../components/LiveActivityCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { getHubSuggestedActions } from "../data/agentRecommendations";
import {
  getAgentReputation,
  getAgentStatus,
  getHubAgentInsights,
} from "../data/agentIntelligence";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { getAllAgents, getAllOpportunities } from "../data/localSelectors";
import {
  activityFeed,
  collaborations,
  contracts,
  hubMetrics,
  networkNodes,
} from "../data/operations";
import { useAgentExchange } from "../state/AgentExchangeContext";

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
    localContracts,
    negotiations,
    savedOpportunities,
  } = useAgentExchange();
  const allAgents = getAllAgents(createdAgents);
  const allOpportunities = getAllOpportunities(createdOpportunities);
  const allContracts = [...localContracts, ...contracts].map((contract) => {
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
  const suggestedActions = getHubSuggestedActions(intelligenceInput);

  return (
    <section className="space-y-10">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Agent Hub
          </p>
          <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl lg:max-w-3xl">
            Operational center for autonomous execution.
          </h1>
          <p className="mt-3 max-w-2xl text-ae-text-muted">
            Monitor revenue, contract activity, pending actions, trust, and
            simulated autonomous agent performance.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PrimaryButton onClick={() => navigate("/contracts")}>
            View Contracts
          </PrimaryButton>
          <SecondaryButton>Sync Network</SecondaryButton>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {hubMetrics.map((metric) => (
          <LiveActivityCard key={metric.id} metric={metric} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <ActivityTimeline events={activityFeed} />
        <AgentNetworkGraph nodes={networkNodes} />
      </section>

      <section className="space-y-4">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Agent Intelligence
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text">
            Autonomous marketplace signals
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-ae-lg border border-white/[0.07] bg-ae-surface-glass p-5 shadow-ae-glow backdrop-blur-2xl">
            <h3 className="font-ae-display text-xl font-semibold text-ae-text">
              Recently Active Agents
            </h3>
            <div className="mt-4 space-y-3">
              {(hubInsights.recentlyActiveAgents.length > 0
                ? hubInsights.recentlyActiveAgents
                : allAgents.slice(0, 3)
              ).map((agent) => (
                <div key={agent.id}>
                  <p className="font-semibold text-ae-text">{agent.name}</p>
                  <p className="text-sm text-ae-text-muted">
                    {getAgentStatus(agent, intelligenceInput)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-ae-lg border border-white/[0.07] bg-ae-surface-glass p-5 shadow-ae-glow backdrop-blur-2xl">
            <h3 className="font-ae-display text-xl font-semibold text-ae-text">
              Top Performing Agents
            </h3>
            <div className="mt-4 space-y-3">
              {hubInsights.topPerformingAgents.map((agent) => (
                <div key={agent.id}>
                  <p className="font-semibold text-ae-text">{agent.name}</p>
                  <p className="text-sm text-ae-text-muted">
                    Trust {getAgentReputation(agent, intelligenceInput).trustScore}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-ae-lg border border-white/[0.07] bg-ae-surface-glass p-5 shadow-ae-glow backdrop-blur-2xl">
            <h3 className="font-ae-display text-xl font-semibold text-ae-text">
              Awaiting Approval
            </h3>
            <div className="mt-4 space-y-3">
              {hubInsights.agentsAwaitingApproval.length > 0 ? (
                hubInsights.agentsAwaitingApproval.map((agent) => (
                  <p className="font-semibold text-ae-text" key={agent.id}>
                    {agent.name}
                  </p>
                ))
              ) : (
                <p className="text-sm text-ae-text-muted">
                  No agents awaiting approval.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-ae-lg border border-white/[0.07] bg-ae-surface-glass p-5 shadow-ae-glow backdrop-blur-2xl">
            <h3 className="font-ae-display text-xl font-semibold text-ae-text">
              Near Completion
            </h3>
            <div className="mt-4 space-y-3">
              {hubInsights.contractsNearCompletion.length > 0 ? (
                hubInsights.contractsNearCompletion.map((contract) => (
                  <button
                    className="block text-left text-sm text-ae-text-muted transition hover:text-ae-primary"
                    key={contract.id}
                    onClick={() => navigate(`/contracts/${contract.id}`)}
                    type="button"
                  >
                    <span className="block font-semibold text-ae-text">
                      {contract.title}
                    </span>
                    {contract.progress}% complete
                  </button>
                ))
              ) : (
                <p className="text-sm text-ae-text-muted">
                  No contracts near completion.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Autonomous Suggestions
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text">
            Recommended next moves
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {suggestedActions.length > 0 ? (
            suggestedActions.map((action) => (
              <div
                className="rounded-ae-lg border border-white/[0.07] bg-ae-surface-glass p-5 shadow-ae-glow backdrop-blur-2xl"
                key={action.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                      {action.agentName}
                    </p>
                    <h3 className="mt-2 font-ae-display text-xl font-semibold text-ae-text">
                      {action.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-ae-text-muted">
                      {action.description}
                    </p>
                  </div>
                  <PrimaryButton onClick={() => approveSuggestedAgentAction(action)}>
                    Approve
                  </PrimaryButton>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-ae-lg border border-white/[0.07] bg-ae-surface-glass p-5 text-ae-text-muted shadow-ae-glow backdrop-blur-2xl">
              No autonomous suggestions available yet.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Collaboration Feed
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text">
            Active, completed, and shared work
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {collaborations.map((collaboration) => (
            <CollaborationCard
              collaboration={collaboration}
              key={collaboration.id}
            />
          ))}
        </div>
      </section>
    </section>
  );
}

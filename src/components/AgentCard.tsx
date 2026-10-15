import { useNavigate } from "react-router-dom";

import type { Agent } from "../data/agents";
import { getAgentSkills } from "../data/agents";
import { getAgentStatus } from "../data/agentIntelligence";
import {
  getAgentRatingLabel,
  getAgentCompletedContracts,
  getVerificationStatus,
} from "../data/agentTrust";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { getAllAgents } from "../data/localSelectors";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { ProfileStats } from "./ProfileStats";
import { SkillChip } from "./SkillChip";
import { StatusChip } from "./StatusChip";
import { VerificationBadge } from "./VerificationBadge";
import { WorkerBadge } from "./WorkerBadge";

type AgentCardProps = {
  agent: Agent;
};

// Ratings and badges come from stored columns and real reviews in every mode;
// the demo heuristics invented a 5.0 rating and inferred verification.
const STORED_TRUST = { sharedMode: true } as const;

export function AgentCard({ agent }: AgentCardProps) {
  const navigate = useNavigate();
  const {
    agentActivities,
    agentReviews,
    applications,
    contractWorkspaces,
    contractDisputes,
    createdAgents,
    hireRequests,
    localContracts,
    negotiations,
    isWorkerAgent,
  } = useAgentExchange();
  const accent = accentStyles[agent.accent];
  const agentSkills = getAgentSkills(agent);
  const previewSkills = agentSkills.slice(0, 3);
  const allContracts = localContracts.map((contract) => {
    const workspace = contractWorkspaces.find(
      (candidate) => candidate.contractId === contract.id,
    );

    return workspace ? applyWorkspaceToContract(contract, workspace) : contract;
  });
  // The viewer's own saved briefs say nothing about this agent, so they are
  // left out; otherwise every card read "Reviewing Opportunity".
  const status = getAgentStatus(agent, {
    activities: agentActivities,
    agents: getAllAgents(createdAgents),
    applications,
    contracts: allContracts,
    hireRequests,
    negotiations,
    workspaces: contractWorkspaces,
  });
  const verificationStatus = getVerificationStatus(
    {
      agent,
      contracts: allContracts,
      disputes: contractDisputes,
      reviews: agentReviews,
    },
    STORED_TRUST,
  );
  const completedContracts = getAgentCompletedContracts(agent, allContracts).length;

  return (
    <GlassCard interactive className="flex h-full flex-col gap-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className={`grid size-14 shrink-0 place-items-center rounded-2xl border bg-gradient-to-br from-white/[0.08] to-white/[0.02] font-ae-label text-lg font-semibold ${accent.border} ${accent.text} ${accent.glow}`}
        >
          {agent.avatarInitials}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
            {agent.specialty}
          </p>
          <h2 className="mt-1 break-words font-ae-display text-xl font-semibold tracking-tight text-ae-text sm:text-2xl">
            {agent.name}
          </h2>
        </div>
      </div>

      {agent.description ? (
        <p className="line-clamp-2 text-sm leading-6 text-ae-text-muted">
          {agent.description}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={status} />
        <VerificationBadge status={verificationStatus} />
        {isWorkerAgent(agent) ? <WorkerBadge /> : null}
      </div>

      <ProfileStats
        compact
        revenue={agent.revenue}
        successRate={agent.successRate}
        trustScore={agent.trustScore}
      />

      {previewSkills.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {previewSkills.map((skill) => (
            <SkillChip key={skill.id} skill={skill} />
          ))}
          {agentSkills.length > previewSkills.length ? (
            <span className="inline-flex items-center px-1 text-xs text-ae-text-muted">
              +{agentSkills.length - previewSkills.length} more
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ae-text-muted">
          <span>{getAgentRatingLabel(agent, agentReviews, STORED_TRUST)}</span>
          <span aria-hidden className="text-white/20">•</span>
          <span>{completedContracts} completed</span>
        </p>
        <PrimaryButton className="px-4 py-2.5" onClick={() => navigate(`/agent/${agent.id}`)}>
          View profile
        </PrimaryButton>
      </div>
    </GlassCard>
  );
}

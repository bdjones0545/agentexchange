import { useNavigate } from "react-router-dom";

import type { Agent } from "../data/agents";
import { getAgentSkills } from "../data/agents";
import { getAgentStatus } from "../data/agentIntelligence";
import {
  getAgentAverageRating,
  getAgentCompletedContracts,
  getVerificationStatus,
} from "../data/agentTrust";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { getAllAgents } from "../data/localSelectors";
import { contracts } from "../data/operations";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { ProfileStats } from "./ProfileStats";
import { SkillChip } from "./SkillChip";
import { StatusChip } from "./StatusChip";
import { VerificationBadge } from "./VerificationBadge";

type AgentCardProps = {
  agent: Agent;
};

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
    savedOpportunities,
  } = useAgentExchange();
  const accent = accentStyles[agent.accent];
  const previewSkills = getAgentSkills(agent).slice(0, 3);
  const allContracts = [...localContracts, ...contracts].map((contract) => {
    const workspace = contractWorkspaces.find(
      (candidate) => candidate.contractId === contract.id,
    );

    return workspace ? applyWorkspaceToContract(contract, workspace) : contract;
  });
  const status = getAgentStatus(agent, {
    activities: agentActivities,
    agents: getAllAgents(createdAgents),
    applications,
    contracts: allContracts,
    hireRequests,
    negotiations,
    savedOpportunities,
    workspaces: contractWorkspaces,
  });
  const verificationStatus = getVerificationStatus({
    agent,
    contracts: allContracts,
    disputes: contractDisputes,
    reviews: agentReviews,
  });
  const averageRating = getAgentAverageRating(agent, agentReviews);
  const completedContracts = getAgentCompletedContracts(agent, allContracts).length;

  return (
    <GlassCard
      className={`grid gap-5 transition duration-200 hover:-translate-y-1 hover:border-ae-primary/30 lg:grid-cols-[auto_1fr_auto] lg:items-center ${accent.border}`}
    >
      <div
        className={`grid size-20 place-items-center rounded-full border bg-white/[0.04] font-ae-label text-lg font-semibold ${accent.border} ${accent.text} ${accent.glow}`}
      >
        {agent.avatarInitials}
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
              {agent.specialty}
            </p>
            <h2 className="mt-2 font-ae-display text-2xl font-semibold tracking-[-0.02em] text-ae-text">
              {agent.name}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <VerificationBadge status={verificationStatus} />
              <span className="rounded-full border border-white/[0.06] bg-white/[0.05] px-3 py-1 font-ae-label text-xs font-semibold text-ae-text-muted">
                {averageRating.toFixed(1)} rating
              </span>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.05] px-3 py-1 font-ae-label text-xs font-semibold text-ae-text-muted">
                {completedContracts} completed
              </span>
            </div>
          </div>
          <StatusChip status={status} />
        </div>

        <ProfileStats
          compact
          revenue={agent.revenue}
          successRate={agent.successRate}
          trustScore={agent.trustScore}
        />

        <div className="flex flex-wrap gap-2">
          {previewSkills.map((skill) => (
            <SkillChip key={skill.id} skill={skill} />
          ))}
        </div>
      </div>

      <PrimaryButton onClick={() => navigate(`/agent/${agent.id}`)}>
        View profile
      </PrimaryButton>
    </GlassCard>
  );
}

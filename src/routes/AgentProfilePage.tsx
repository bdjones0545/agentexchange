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
import { agents, getAgentContractHistory, getAgentSkills } from "../data/agents";

export function AgentProfilePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isHireModalOpen, setIsHireModalOpen] = useState(false);
  const agent = agents.find((candidate) => candidate.id === id);

  if (!agent) {
    return <Navigate replace to="/agents" />;
  }

  const agentSkills = getAgentSkills(agent);
  const agentContracts = getAgentContractHistory(agent);

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

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-primary">
              {agent.tier}
            </span>
            <StatusChip status={agent.availability} />
          </div>
        </div>

        <ProfileStats
          revenue={agent.revenue}
          successRate={agent.successRate}
          trustScore={agent.trustScore}
        />
      </GlassCard>

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

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Contract History
        </h2>
        <div className="grid gap-4">
          {agentContracts.map((contract) => (
            <ContractHistoryCard contract={contract} key={contract.id} />
          ))}
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

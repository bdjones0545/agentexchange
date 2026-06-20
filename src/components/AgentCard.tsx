import { useNavigate } from "react-router-dom";

import type { Agent } from "../data/agents";
import { getAgentSkills } from "../data/agents";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { ProfileStats } from "./ProfileStats";
import { SkillChip } from "./SkillChip";
import { StatusChip } from "./StatusChip";

type AgentCardProps = {
  agent: Agent;
};

export function AgentCard({ agent }: AgentCardProps) {
  const navigate = useNavigate();
  const accent = accentStyles[agent.accent];
  const previewSkills = getAgentSkills(agent).slice(0, 3);

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
          </div>
          <StatusChip status={agent.availability} />
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

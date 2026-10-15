import type { Skill } from "../data/agents";
import { accentStyles } from "./accentStyles";

type SkillChipProps = {
  skill: Skill;
};

export function SkillChip({ skill }: SkillChipProps) {
  const accent = accentStyles[skill.accent];

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-ae-text-muted">
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${accent.dot}`} />
      <span className="truncate">{skill.label}</span>
    </span>
  );
}

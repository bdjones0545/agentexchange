import type { Skill } from "../data/agents";
import { accentStyles } from "./accentStyles";

type SkillChipProps = {
  skill: Skill;
};

export function SkillChip({ skill }: SkillChipProps) {
  const accent = accentStyles[skill.accent];

  return (
    <span
      className={`inline-flex rounded-ae-md border px-3 py-2 font-ae-label text-xs font-semibold ${accent.badge}`}
    >
      {skill.label}
    </span>
  );
}

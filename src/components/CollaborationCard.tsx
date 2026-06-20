import type { Collaboration } from "../data/operations";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";

type CollaborationCardProps = {
  collaboration: Collaboration;
};

const statusLabel: Record<Collaboration["status"], string> = {
  Active: "Active collaboration",
  Completed: "Recently completed",
  Shared: "Shared project",
};

export function CollaborationCard({ collaboration }: CollaborationCardProps) {
  const accent = accentStyles[collaboration.accent];

  return (
    <GlassCard className={`space-y-4 ${accent.border}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
            {statusLabel[collaboration.status]}
          </p>
          <h3 className="mt-2 font-ae-display text-xl font-semibold text-ae-text">
            {collaboration.title}
          </h3>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1 font-ae-label text-xs font-semibold ${accent.badge}`}
        >
          {collaboration.value}
        </span>
      </div>

      <p className="text-sm leading-6 text-ae-text-muted">
        {collaboration.detail}
      </p>

      <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
        {collaboration.participants.map((participant) => (
          <span
            className="rounded-full border border-white/[0.06] bg-white/[0.05] px-3 py-1 font-ae-label text-xs font-semibold text-ae-text-muted"
            key={participant}
          >
            {participant}
          </span>
        ))}
      </div>
    </GlassCard>
  );
}

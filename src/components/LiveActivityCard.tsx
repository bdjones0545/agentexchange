import type { HubMetric } from "../data/operations";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";

type LiveActivityCardProps = {
  metric: HubMetric;
};

export function LiveActivityCard({ metric }: LiveActivityCardProps) {
  const accent = accentStyles[metric.accent] ?? accentStyles.violet;

  return (
    <GlassCard className="relative flex min-w-0 flex-col overflow-hidden">
      <div aria-hidden className={`pointer-events-none absolute -right-10 -top-10 size-28 rounded-full opacity-25 blur-2xl ${accent.dot}`} />
      <div className="relative flex items-start justify-between gap-3">
        <p className="min-w-0 break-words font-ae-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ae-text-muted sm:text-xs">
          {metric.label}
        </p>
        <span aria-hidden className={`mt-1 size-2 shrink-0 rounded-full ${accent.dot}`} />
      </div>
      <p className="relative mt-4 font-ae-display text-3xl font-semibold tabular-nums tracking-[-0.04em] text-ae-text sm:text-4xl">
        {metric.value}
      </p>
      <p className="relative mt-1.5 text-xs leading-5 text-ae-text-muted sm:text-sm sm:leading-6">{metric.detail}</p>
    </GlassCard>
  );
}

import type { RevenueMetric } from "../data/earnings";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";

type RevenueCardProps = {
  metric: RevenueMetric;
};

export function RevenueCard({ metric }: RevenueCardProps) {
  const accent = accentStyles[metric.accent];

  return (
    <GlassCard className={`space-y-3 ${accent.border} ${accent.glow}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
          {metric.label}
        </p>
        <span className={`size-2 rounded-full ${accent.dot}`} />
      </div>
      <p className="font-ae-display text-3xl font-semibold tracking-[-0.03em] text-ae-text">
        {metric.value}
      </p>
      <p className="text-sm leading-6 text-ae-text-muted">{metric.detail}</p>
    </GlassCard>
  );
}

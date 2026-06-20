import type { EarningsPoint } from "../data/earnings";
import { GlassCard } from "./GlassCard";

type EarningsChartProps = {
  points: EarningsPoint[];
};

export function EarningsChart({ points }: EarningsChartProps) {
  const maxValue = Math.max(...points.map((point) => point.value));

  return (
    <GlassCard className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Earnings History
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
            Monthly revenue trend
          </h2>
        </div>
        <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-3 py-1 font-ae-label text-xs font-semibold text-ae-primary">
          Mock history
        </span>
      </div>

      <div className="grid min-h-72 grid-cols-6 items-end gap-3 rounded-ae-lg border border-white/[0.06] bg-ae-background-deep/60 p-4">
        {points.map((point) => {
          const height = Math.max(18, (point.value / maxValue) * 100);

          return (
            <div className="flex h-full flex-col justify-end gap-3" key={point.id}>
              <div className="flex min-h-48 items-end">
                <div
                  className="w-full rounded-t-ae-md bg-gradient-to-t from-ae-primary-action to-ae-primary shadow-ae-glow"
                  style={{ height: `${height}%` }}
                />
              </div>
              <div className="text-center">
                <p className="font-ae-label text-xs font-semibold text-ae-text">
                  {point.displayValue}
                </p>
                <p className="mt-1 font-ae-label text-[11px] font-semibold uppercase tracking-[0.08em] text-ae-text-muted">
                  {point.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

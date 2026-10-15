import { GlassCard } from "./GlassCard";

type OrganizationStatsProps = {
  stats: {
    activeAgents: number;
    completedSpend: string;
    openOpportunities: number;
    pendingSpend: string;
    /** Average rating this organization has given; null until it leaves a review. */
    rating: number | null;
    totalSpend: string;
  };
};

/**
 * Activity tiles for an organization. Contract value is broken down by the
 * SpendSummaryCard that sits beside these tiles on every page that uses them.
 */
export function OrganizationStats({ stats }: OrganizationStatsProps) {
  const items: Array<{ label: string; value: string; detail: string; dot: string }> = [
    {
      label: "Posted opportunities",
      value: String(stats.openOpportunities),
      detail: "Briefs this organization has posted",
      dot: "bg-ae-cyan",
    },
    {
      label: "Agents hired",
      value: String(stats.activeAgents),
      detail: "Across the contracts you can see",
      dot: "bg-ae-primary",
    },
    {
      label: "Avg. rating given",
      value: stats.rating === null ? "—" : stats.rating.toFixed(1),
      detail: stats.rating === null ? "No reviews left yet" : "From reviews this organization left",
      dot: "bg-ae-amber",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <GlassCard className="min-w-0" key={item.label}>
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              {item.label}
            </p>
            <span aria-hidden className={`mt-1 size-2 shrink-0 rounded-full ${item.dot}`} />
          </div>
          <p className="mt-3 font-ae-display text-3xl font-semibold tabular-nums tracking-[-0.03em] text-ae-text">
            {item.value}
          </p>
          <p className="mt-1 text-sm leading-6 text-ae-text-muted">{item.detail}</p>
        </GlassCard>
      ))}
    </div>
  );
}

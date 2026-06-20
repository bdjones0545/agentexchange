import { GlassCard } from "./GlassCard";

type OrganizationStatsProps = {
  stats: {
    activeAgents: number;
    completedSpend: string;
    openOpportunities: number;
    pendingSpend: string;
    rating: number;
    totalSpend: string;
  };
};

export function OrganizationStats({ stats }: OrganizationStatsProps) {
  const items = [
    ["Total Spend", stats.totalSpend],
    ["Open Opportunities", stats.openOpportunities],
    ["Active Agents", stats.activeAgents],
    ["Rating", stats.rating.toFixed(1)],
    ["Pending Spend", stats.pendingSpend],
    ["Completed Spend", stats.completedSpend],
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <GlassCard className="space-y-2 text-center" key={label}>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            {label}
          </p>
          <p className="font-ae-display text-2xl font-semibold text-ae-text">
            {value}
          </p>
        </GlassCard>
      ))}
    </div>
  );
}

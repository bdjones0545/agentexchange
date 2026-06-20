type ProfileStatsProps = {
  trustScore: number;
  revenue: string;
  successRate: string;
  compact?: boolean;
};

export function ProfileStats({
  trustScore,
  revenue,
  successRate,
  compact = false,
}: ProfileStatsProps) {
  const stats = [
    {
      label: "Trust Score",
      value: trustScore.toFixed(1),
    },
    {
      label: "Revenue",
      value: revenue,
    },
    {
      label: "Success",
      value: successRate,
    },
  ];

  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-3" : "sm:grid-cols-3"}`}>
      {stats.map((stat) => (
        <div
          className="rounded-ae-md border border-white/[0.07] bg-white/[0.04] p-4 text-center"
          key={stat.label}
        >
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            {stat.label}
          </p>
          <p className="mt-2 font-ae-display text-xl font-semibold text-ae-text">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

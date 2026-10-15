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
      // A score of 0 is the platform default for a listing nobody has scored
      // yet, so it reads as "New" rather than as a failing grade.
      value: trustScore > 0 ? trustScore.toFixed(1) : "New",
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
    <dl className={`grid grid-cols-3 ${compact ? "gap-2" : "gap-3"}`}>
      {stats.map((stat) => (
        <div
          className={`min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.03] ${compact ? "px-3 py-2.5" : "p-3 sm:p-4"}`}
          key={stat.label}
        >
          <dt className="font-ae-label text-[11px] font-semibold uppercase leading-4 tracking-[0.12em] text-ae-text-muted">
            {stat.label}
          </dt>
          <dd className={`mt-1 truncate font-ae-display font-semibold tabular-nums tracking-tight text-ae-text ${compact ? "text-base sm:text-lg" : "text-xl sm:text-2xl"}`}>
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

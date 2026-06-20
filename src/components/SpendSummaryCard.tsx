import type { OrganizationSummary } from "../data/organizations";
import { GlassCard } from "./GlassCard";

type SpendSummaryCardProps = {
  organization: OrganizationSummary;
};

export function SpendSummaryCard({ organization }: SpendSummaryCardProps) {
  return (
    <GlassCard className="space-y-4">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Spend Summary
        </p>
        <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
          {organization.totalSpend}
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Pending", organization.pendingSpend],
          ["Completed", organization.completedSpend],
          ["Avg Contract", organization.averageContractValue],
        ].map(([label, value]) => (
          <div
            className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3"
            key={label}
          >
            <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
              {label}
            </p>
            <p className="mt-1 font-semibold text-ae-text">{value}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

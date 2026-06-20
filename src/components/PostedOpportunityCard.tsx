import type { Opportunity } from "../data/marketplace";
import { GlassCard } from "./GlassCard";

type PostedOpportunityCardProps = {
  opportunity: Opportunity;
};

export function PostedOpportunityCard({ opportunity }: PostedOpportunityCardProps) {
  return (
    <GlassCard className="space-y-3">
      <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
        {opportunity.category}
      </p>
      <h3 className="font-ae-display text-xl font-semibold text-ae-text">
        {opportunity.title}
      </h3>
      <p className="text-sm leading-6 text-ae-text-muted">{opportunity.summary}</p>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-3 py-1 font-ae-label text-xs font-semibold text-ae-primary">
          {opportunity.budget}
        </span>
        <span className="rounded-full border border-white/[0.06] bg-white/[0.05] px-3 py-1 font-ae-label text-xs font-semibold text-ae-text-muted">
          {opportunity.cadence}
        </span>
      </div>
    </GlassCard>
  );
}

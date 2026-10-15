import type { Opportunity } from "../data/marketplace";
import { GlassCard } from "./GlassCard";

type PostedOpportunityCardProps = {
  opportunity: Opportunity;
};

export function PostedOpportunityCard({ opportunity }: PostedOpportunityCardProps) {
  return (
    <GlassCard className="flex min-w-0 flex-col gap-3">
      <p className="truncate font-ae-label text-[11px] font-semibold uppercase tracking-[0.16em] text-ae-cyan">
        {opportunity.category}
      </p>
      <h3 className="break-words font-ae-display text-lg font-semibold leading-snug tracking-tight text-ae-text">
        {opportunity.title}
      </h3>
      <p className="line-clamp-3 text-sm leading-6 text-ae-text-muted">{opportunity.summary}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {opportunity.budget ? (
          <span className="inline-block max-w-full truncate rounded-full border border-ae-primary/25 bg-ae-primary/10 px-2.5 py-1 font-ae-label text-xs font-semibold text-ae-primary">
            {opportunity.budget}
          </span>
        ) : null}
        {opportunity.cadence ? (
          <span className="inline-block max-w-full truncate rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 font-ae-label text-xs font-semibold text-ae-text-muted">
            {opportunity.cadence}
          </span>
        ) : null}
      </div>
    </GlassCard>
  );
}

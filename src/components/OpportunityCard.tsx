import type { Opportunity } from "../data/marketplace";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

type OpportunityCardProps = {
  opportunity: Opportunity;
};

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const accent = accentStyles[opportunity.accent];

  return (
    <GlassCard
      className={`space-y-5 transition duration-200 hover:-translate-y-1 hover:border-ae-primary/30 ${accent.border}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-text-muted">
            {opportunity.category}
          </p>
          <h2 className="font-ae-display text-2xl font-semibold tracking-[-0.02em] text-ae-text">
            {opportunity.title}
          </h2>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1 font-ae-label text-xs font-semibold ${accent.badge}`}
        >
          {opportunity.matchScore}% Match
        </span>
      </div>

      <p className="max-w-3xl text-sm leading-6 text-ae-text-muted">
        {opportunity.summary}
      </p>

      <div className="flex flex-wrap gap-2">
        {opportunity.tags.map((tag) => (
          <span
            className="rounded-full border border-white/[0.06] bg-white/[0.06] px-3 py-1 font-ae-label text-xs font-semibold text-ae-text-muted"
            key={tag}
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Budget
            </p>
            <p className="mt-1 text-lg font-semibold text-ae-text">
              {opportunity.budget}
              <span className="text-sm font-normal text-ae-text-muted">
                {" "}
                / {opportunity.cadence}
              </span>
            </p>
          </div>
          <div>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Trust
            </p>
            <p className="mt-1 text-lg font-semibold text-ae-text">
              {opportunity.trustLevel}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PrimaryButton>Apply</PrimaryButton>
          <SecondaryButton>Negotiate</SecondaryButton>
        </div>
      </div>
    </GlassCard>
  );
}

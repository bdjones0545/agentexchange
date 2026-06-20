import { getOpportunityIntelligence } from "../data/agentIntelligence";
import { getAllAgents } from "../data/localSelectors";
import type { Opportunity } from "../data/marketplace";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { accentStyles } from "./accentStyles";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { SavedOpportunityButton } from "./SavedOpportunityButton";
import { SecondaryButton } from "./SecondaryButton";

type OpportunityCardProps = {
  opportunity: Opportunity;
  onApply?: (opportunity: Opportunity) => void;
  onNegotiate?: (opportunity: Opportunity) => void;
};

export function OpportunityCard({
  onApply,
  onNegotiate,
  opportunity,
}: OpportunityCardProps) {
  const accent = accentStyles[opportunity.accent];
  const {
    applications,
    createdAgents,
    getApplicationForOpportunity,
    getNegotiationForOpportunity,
    negotiations,
  } = useAgentExchange();
  const application = getApplicationForOpportunity(opportunity.id);
  const negotiation = getNegotiationForOpportunity(opportunity.id);
  const intelligence = getOpportunityIntelligence(
    opportunity,
    getAllAgents(createdAgents),
    {
      applications,
      negotiations,
    },
  );

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
        <div className="flex flex-wrap items-center gap-2">
          {application ? (
            <ApplicationStatusBadge status={application.status} />
          ) : null}
          {!application && negotiation ? (
            <ApplicationStatusBadge status="negotiating" />
          ) : null}
          <span
            className={`w-fit rounded-full border px-3 py-1 font-ae-label text-xs font-semibold ${accent.badge}`}
          >
            {opportunity.matchScore}% Match
          </span>
          <SavedOpportunityButton opportunityId={opportunity.id} />
        </div>
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

      <div className="grid gap-3 rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4 sm:grid-cols-3">
        <div>
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Applicants
          </p>
          <p className="mt-1 font-ae-display text-xl font-semibold text-ae-text">
            {intelligence.applicants}
          </p>
        </div>
        <div>
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Top Match
          </p>
          <p className="mt-1 truncate font-semibold text-ae-text">
            {intelligence.topMatchingAgent?.name ?? "Matching"}
          </p>
        </div>
        <div>
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Activity
          </p>
          <p className="mt-1 truncate text-sm text-ae-text-muted">
            {intelligence.latestActivity}
          </p>
        </div>
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
          <PrimaryButton
            disabled={Boolean(application)}
            onClick={() => onApply?.(opportunity)}
          >
            {application ? "Applied" : "Apply"}
          </PrimaryButton>
          <SecondaryButton onClick={() => onNegotiate?.(opportunity)}>
            {negotiation ? "Update Terms" : "Negotiate"}
          </SecondaryButton>
        </div>
      </div>
    </GlassCard>
  );
}

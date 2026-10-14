import { budgetLabel } from "../lib/budgetLabel";
import { useAuth } from "../state/AuthContext";
import { Link } from "react-router-dom";
import { useState } from "react";

import { getOpportunityIntelligence } from "../data/agentIntelligence";
import { getOpportunityRecommendations } from "../data/agentRecommendations";
import {
  getAgentRatingLabel,
  getAgentCompletedContracts,
  getVerificationStatus,
} from "../data/agentTrust";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { getListedAgents } from "../data/localSelectors";
import type { Opportunity } from "../data/marketplace";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { accentStyles } from "./accentStyles";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { SavedOpportunityButton } from "./SavedOpportunityButton";
import { SecondaryButton } from "./SecondaryButton";
import { VerificationBadge } from "./VerificationBadge";

type OpportunityCardProps = {
  opportunity: Opportunity;
  onApply?: (opportunity: Opportunity) => void;
  onNegotiate?: (opportunity: Opportunity) => void;
  /**
   * Start with the applicant/match analysis open. Lists leave it folded so a
   * brief is one screen on a phone (title, summary, budget, actions); the
   * featured slot on Home opens it.
   */
  defaultExpanded?: boolean;
};

// Ratings and badges come from stored columns and real reviews in every mode;
// the demo heuristics invented a 5.0 rating and inferred verification.
const STORED_TRUST = { sharedMode: true } as const;

const tileLabel = "font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted";

export function OpportunityCard({
  defaultExpanded = false,
  onApply,
  onNegotiate,
  opportunity,
}: OpportunityCardProps) {
  const { isAuthenticated } = useAuth();
  const accent = accentStyles[opportunity.accent];
  const [expanded, setExpanded] = useState(defaultExpanded);
  const {
    applications,
    agentReviews,
    contractDisputes,
    contractWorkspaces,
    createdAgents,
    getApplicationForOpportunity,
    getNegotiationForOpportunity,
    negotiations,
    localContracts,
  } = useAgentExchange();
  const application = getApplicationForOpportunity(opportunity.id);
  const negotiation = getNegotiationForOpportunity(opportunity.id);
  const hasLockedApplication =
    application?.status === "accepted" || application?.status === "pending";
  const allAgents = getListedAgents(createdAgents);
  const recommendations = getOpportunityRecommendations(opportunity, allAgents);
  const topRecommendation = recommendations[0];
  const allContracts = localContracts.map((contract) => {
    const workspace = contractWorkspaces.find(
      (candidate) => candidate.contractId === contract.id,
    );

    return workspace ? applyWorkspaceToContract(contract, workspace) : contract;
  });
  const topAgentVerification = topRecommendation
    ? getVerificationStatus(
        {
          agent: topRecommendation.agent,
          contracts: allContracts,
          disputes: contractDisputes,
          reviews: agentReviews,
        },
        STORED_TRUST,
      )
    : undefined;
  const intelligence = getOpportunityIntelligence(
    opportunity,
    allAgents,
    {
      applications,
      negotiations,
    },
  );

  return (
    <GlassCard interactive className="flex h-full flex-col gap-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className={`font-ae-label font-semibold uppercase tracking-[0.16em] ${accent.text}`}>
              {opportunity.category}
            </span>
            {opportunity.organization ? (
              <>
                <span aria-hidden className="text-white/20">•</span>
                <span className="min-w-0 truncate text-ae-text-muted">{opportunity.organization}</span>
              </>
            ) : null}
          </p>
          <h2 className="break-words font-ae-display text-xl font-semibold leading-snug tracking-tight text-ae-text sm:text-2xl">
            <Link to={`/marketplace/${opportunity.id}`} className="transition hover:text-ae-primary">{opportunity.title}</Link>
          </h2>
        </div>
        <SavedOpportunityButton opportunityId={opportunity.id} />
      </div>

      <p className={`max-w-3xl text-sm leading-6 text-ae-text-muted ${expanded ? "" : "line-clamp-3"}`}>
        {opportunity.summary}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {application ? (
          <ApplicationStatusBadge status={application.status} />
        ) : null}
        {!application && negotiation ? (
          <ApplicationStatusBadge status="negotiating" />
        ) : null}
        <span
          className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${accent.badge}`}
        >
          {isAuthenticated ? (topRecommendation ? `${topRecommendation.matchPercentage}% Match` : "No agent match yet") : <Link to="/sign-in" className="underline underline-offset-2">Sign in to see your match.</Link>}
        </span>
        {(expanded ? opportunity.tags : opportunity.tags.slice(0, 4)).map((tag) => (
          <span
            className="inline-block max-w-full truncate rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-ae-text-muted"
            key={tag}
          >
            {tag}
          </span>
        ))}
      </div>

      {expanded ? (
        <div className="ax-pop space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <p className={tileLabel}>
                Applicants
              </p>
              <p className="mt-1 font-ae-display text-2xl font-semibold tabular-nums text-ae-text">
                {intelligence.applicants}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <p className={tileLabel}>
                Top Match
              </p>
              <p className="mt-1 truncate font-semibold text-ae-text">
                {topRecommendation?.agent.name ?? intelligence.topMatchingAgent?.name ?? "Matching"}
              </p>
              {topRecommendation && topAgentVerification ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <VerificationBadge status={topAgentVerification} />
                  <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-ae-text-muted">
                    {getAgentRatingLabel(topRecommendation.agent, agentReviews, STORED_TRUST)}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-ae-text-muted">
                    {getAgentCompletedContracts(topRecommendation.agent, allContracts).length} done
                  </span>
                </div>
              ) : null}
            </div>
            <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <p className={tileLabel}>
                Activity
              </p>
              <p className="mt-1 text-sm leading-6 text-ae-text-muted">
                {intelligence.latestActivity}
              </p>
            </div>
          </div>

          {topRecommendation ? (
            <div className="rounded-xl border border-ae-primary/15 bg-ae-primary/[0.05] p-4">
              <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ae-primary">
                Why this agent matches
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {topRecommendation.reasons.map((reason) => (
                  <div className="min-w-0" key={reason.label}>
                    <p className="text-sm font-semibold text-ae-text">
                      {reason.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ae-text-muted">
                      {reason.detail}
                    </p>
                  </div>
                ))}
              </div>
              {topRecommendation.missingSkills.length > 0 ? (
                <p className="mt-3 text-xs text-ae-text-muted">
                  Missing skills: {topRecommendation.missingSkills.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        aria-expanded={expanded}
        className="group inline-flex w-fit items-center gap-2 text-left text-xs font-medium text-ae-primary transition hover:text-ae-text"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <svg aria-hidden viewBox="0 0 16 16" className={`size-3.5 shrink-0 transition duration-200 ${expanded ? "rotate-180" : ""}`}>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          {expanded
            ? "Hide details"
            : `Details · ${intelligence.applicants} applicant${intelligence.applicants === 1 ? "" : "s"} · top match ${topRecommendation?.agent.name ?? intelligence.topMatchingAgent?.name ?? "pending"}`}
        </span>
      </button>

      <div className="mt-auto grid gap-4 border-t border-white/[0.06] pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex min-w-0 flex-wrap items-end gap-x-8 gap-y-3">
          <div className="min-w-0">
            <p className={tileLabel}>
              Budget
            </p>
            <p className="mt-1 font-ae-display text-xl font-semibold tracking-tight text-ae-text sm:text-2xl">
              {budgetLabel(opportunity.budget, opportunity.cadence)}
            </p>
          </div>
          <div>
            <p className={tileLabel}>
              Trust
            </p>
            <p className="mt-1 text-sm font-medium text-ae-text-muted">
              {opportunity.trustLevel}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <PrimaryButton
            disabled={hasLockedApplication}
            onClick={() => onApply?.(opportunity)}
          >
            {application?.status === "rejected"
              ? "Reapply"
              : application
                ? "Applied"
                : "Apply"}
          </PrimaryButton>
          <SecondaryButton onClick={() => onNegotiate?.(opportunity)}>
            {negotiation ? "Update Terms" : "Negotiate"}
          </SecondaryButton>
        </div>
      </div>
    </GlassCard>
  );
}

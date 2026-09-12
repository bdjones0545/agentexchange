import { useState } from "react";

import type { Application, Negotiation } from "../state/marketplaceTypes";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

type ApplicantReviewCardProps =
  | {
      application: Application;
      negotiation?: never;
      type: "application";
    }
  | {
      application?: never;
      negotiation: Negotiation;
      type: "negotiation";
    };

export function ApplicantReviewCard(props: ApplicantReviewCardProps) {
  const {
    acceptApplication,
    acceptNegotiation,
    canManageApplication,
    canManageNegotiation,
    counterNegotiation,
    rejectApplication,
    rejectNegotiation,
  } = useAgentExchange();
  const [counterNote, setCounterNote] = useState("");
  const [counterRate, setCounterRate] = useState("");
  const [counterTimeline, setCounterTimeline] = useState("");

  if (props.type === "application") {
    const { application } = props;

    return (
      <GlassCard className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
              Application
            </p>
            <h3 className="mt-2 font-ae-display text-xl font-semibold text-ae-text">
              {application.agentName}
            </h3>
            <p className="mt-1 text-sm text-ae-text-muted">
              {application.opportunityTitle}
            </p>
          </div>
          <ApplicationStatusBadge status={application.status} />
        </div>
        <p className="text-sm leading-6 text-ae-text-muted">
          {application.proposal}
        </p>
        {application.status === "pending" ? (
          canManageApplication(application) ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <PrimaryButton onClick={() => acceptApplication(application.id)}>
                Accept
              </PrimaryButton>
              <SecondaryButton onClick={() => rejectApplication(application.id)}>
                Reject
              </SecondaryButton>
            </div>
          ) : (
            <p className="text-xs text-ae-text-muted">
              Waiting for the organization to review this application.
            </p>
          )
        ) : null}
      </GlassCard>
    );
  }

  const { negotiation } = props;

  return (
    <GlassCard className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
            Negotiation
          </p>
          <h3 className="mt-2 font-ae-display text-xl font-semibold text-ae-text">
            {negotiation.agentName ?? "Recommended Agent"}
          </h3>
          <p className="mt-1 text-sm text-ae-text-muted">
            {negotiation.opportunityTitle}
          </p>
        </div>
        <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-primary">
          {negotiation.status}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3">
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Rate
          </p>
          <p className="mt-1 font-semibold text-ae-text">
            {negotiation.counterRate ?? negotiation.rate}
          </p>
        </div>
        <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3">
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Timeline
          </p>
          <p className="mt-1 font-semibold text-ae-text">
            {negotiation.counterTimeline ?? negotiation.timeline}
          </p>
        </div>
        <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3">
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Notes
          </p>
          <p className="mt-1 text-sm text-ae-text-muted">
            {negotiation.counterNote ?? negotiation.milestoneNotes}
          </p>
        </div>
      </div>
      {(negotiation.status === "pending" || negotiation.status === "countered") &&
      !canManageNegotiation(negotiation) ? (
        <p className="text-xs text-ae-text-muted">
          Waiting for the organization to respond.
        </p>
      ) : null}
      {(negotiation.status === "pending" || negotiation.status === "countered") &&
      canManageNegotiation(negotiation) ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setCounterRate(event.target.value)}
              placeholder="Counter rate"
              value={counterRate}
            />
            <input
              className="rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setCounterTimeline(event.target.value)}
              placeholder="Counter timeline"
              value={counterTimeline}
            />
            <input
              className="rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setCounterNote(event.target.value)}
              placeholder="Counter note"
              value={counterNote}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <PrimaryButton onClick={() => acceptNegotiation(negotiation.id)}>
              Accept
            </PrimaryButton>
            <SecondaryButton onClick={() => rejectNegotiation(negotiation.id)}>
              Reject
            </SecondaryButton>
            <SecondaryButton
              disabled={!counterRate.trim() && !counterTimeline.trim()}
              onClick={() =>
                counterNegotiation(
                  negotiation.id,
                  counterRate || negotiation.rate,
                  counterTimeline || negotiation.timeline,
                  counterNote || "Organization proposed adjusted terms.",
                )
              }
            >
              Counter
            </SecondaryButton>
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
}

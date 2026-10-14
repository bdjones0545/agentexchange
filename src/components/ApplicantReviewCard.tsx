import { useState, type ReactNode } from "react";
import { initialsFor } from "../lib/initials";

import { centsToDollarsInput, dollarsInputToCents, parseMoneyToCents } from "../lib/money";
import { getAllOpportunities } from "../data/localSelectors";
import type { Application, Negotiation } from "../state/marketplaceTypes";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { AgreedPriceField } from "./AgreedPriceField";
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

const initials = (name: string) => initialsFor(name);

function CardHeader({ kind, name, subtitle, status }: { kind: string; name: string; subtitle: string; status: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3.5">
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ae-primary to-ae-cyan font-ae-label text-sm font-bold text-ae-primary-ink"
      >
        {initials(name) || "AG"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.16em] text-ae-text-muted">
          {kind}
        </p>
        <h3 className="mt-1 break-words font-ae-display text-lg font-semibold tracking-tight text-ae-text">
          {name}
        </h3>
        <p className="mt-0.5 break-words text-sm text-ae-text-muted">{subtitle}</p>
      </div>
      {status}
    </div>
  );
}

export function ApplicantReviewCard(props: ApplicantReviewCardProps) {
  const {
    acceptApplication,
    acceptNegotiation,
    canManageApplication,
    canManageNegotiation,
    counterNegotiation,
    createdOpportunities,
    isSharedMode,
    rejectApplication,
    rejectNegotiation,
  } = useAgentExchange();
  const [counterNote, setCounterNote] = useState("");
  const [counterRate, setCounterRate] = useState("");
  const [counterTimeline, setCounterTimeline] = useState("");
  // The price the organization confirms on accept. Suggested from the brief's
  // budget (application) or the negotiated rate; editable until accepted.
  const opportunityId = props.type === "application" ? props.application.opportunityId : props.negotiation.opportunityId;
  const opportunity = getAllOpportunities(createdOpportunities).find((candidate) => candidate.id === opportunityId);
  const suggestedCents =
    props.type === "negotiation"
      ? props.negotiation.counterAmountCents ?? props.negotiation.amountCents ?? parseMoneyToCents(props.negotiation.counterRate ?? props.negotiation.rate) ?? parseMoneyToCents(opportunity?.budget)
      : parseMoneyToCents(opportunity?.budget);
  const [amountInput, setAmountInput] = useState(() => (suggestedCents ? centsToDollarsInput(suggestedCents) : ""));
  const amountCents = dollarsInputToCents(amountInput);
  const priceMissing = isSharedMode && amountCents === null;

  if (props.type === "application") {
    const { application } = props;

    return (
      <GlassCard className="space-y-4 sm:p-6" interactive>
        <CardHeader
          kind="Application"
          name={application.agentName}
          status={<ApplicationStatusBadge status={application.status} />}
          subtitle={application.opportunityTitle}
        />
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm leading-6 text-ae-text-muted">
          {application.proposal}
        </p>
        {application.status === "pending" ? (
          canManageApplication(application) ? (
            <div className="space-y-4 border-t border-white/[0.06] pt-4">
              <AgreedPriceField
                amountCents={amountCents}
                hint={opportunity?.budget ? `Suggested from the brief's budget (${opportunity.budget}).` : undefined}
                onChange={setAmountInput}
                value={amountInput}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <PrimaryButton disabled={priceMissing} onClick={() => acceptApplication(application.id, amountCents ?? undefined)}>
                  Accept
                </PrimaryButton>
                <SecondaryButton onClick={() => rejectApplication(application.id)}>
                  Reject
                </SecondaryButton>
              </div>
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
    <GlassCard className="space-y-4 sm:p-6" interactive>
      <CardHeader
        kind="Negotiation"
        name={negotiation.agentName ?? "Recommended Agent"}
        status={
          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-ae-amber/25 bg-ae-amber/10 px-2.5 py-1 font-ae-label text-xs font-semibold capitalize text-ae-amber">
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {negotiation.status}
          </span>
        }
        subtitle={negotiation.opportunityTitle}
      />
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <dt className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            Rate
          </dt>
          <dd className="mt-1 break-words font-semibold text-ae-text">
            {negotiation.counterRate ?? negotiation.rate}
          </dd>
        </div>
        <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <dt className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            Timeline
          </dt>
          <dd className="mt-1 break-words font-semibold text-ae-text">
            {negotiation.counterTimeline ?? negotiation.timeline}
          </dd>
        </div>
        <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <dt className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            Notes
          </dt>
          <dd className="mt-1 break-words text-sm text-ae-text-muted">
            {negotiation.counterNote ?? negotiation.milestoneNotes}
          </dd>
        </div>
      </dl>
      {(negotiation.status === "pending" || negotiation.status === "countered") &&
      !canManageNegotiation(negotiation) ? (
        <p className="text-xs text-ae-text-muted">
          Waiting for the organization to respond.
        </p>
      ) : null}
      {(negotiation.status === "pending" || negotiation.status === "countered") &&
      canManageNegotiation(negotiation) ? (
        <div className="space-y-4 border-t border-white/[0.06] pt-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              aria-label="Counter rate"
              className="ax-input"
              onChange={(event) => setCounterRate(event.target.value)}
              placeholder="Counter rate"
              value={counterRate}
            />
            <input
              aria-label="Counter timeline"
              className="ax-input"
              onChange={(event) => setCounterTimeline(event.target.value)}
              placeholder="Counter timeline"
              value={counterTimeline}
            />
            <input
              aria-label="Counter note"
              className="ax-input"
              onChange={(event) => setCounterNote(event.target.value)}
              placeholder="Counter note"
              value={counterNote}
            />
          </div>
          <AgreedPriceField
            amountCents={amountCents}
            hint={`Suggested from the ${negotiation.counterRate ? "counter rate" : "proposed rate"} (${negotiation.counterRate ?? negotiation.rate}).`}
            onChange={setAmountInput}
            value={amountInput}
          />
          <div className="flex flex-col flex-wrap gap-2 sm:flex-row">
            <PrimaryButton
              disabled={priceMissing || (negotiation.amountCents !== undefined && amountCents !== negotiation.amountCents)}
              onClick={() => acceptNegotiation(negotiation.id, amountCents ?? undefined)}
              title={negotiation.amountCents !== undefined && amountCents !== negotiation.amountCents ? "The price differs from the agent's proposal; counter instead." : undefined}
            >
              {negotiation.amountCents !== undefined ? `Accept at $${(negotiation.amountCents / 100).toFixed(negotiation.amountCents % 100 === 0 ? 0 : 2)}` : "Accept"}
            </PrimaryButton>
            <SecondaryButton onClick={() => rejectNegotiation(negotiation.id)}>
              Reject
            </SecondaryButton>
            <SecondaryButton
              disabled={(!counterRate.trim() && !counterTimeline.trim() && amountCents === (negotiation.amountCents ?? null)) || priceMissing}
              onClick={() =>
                counterNegotiation(
                  negotiation.id,
                  counterRate || (amountCents ? `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}` : negotiation.rate),
                  counterTimeline || negotiation.timeline,
                  counterNote || "Organization proposed adjusted terms.",
                  amountCents ?? undefined,
                )
              }
            >
              Counter at {amountCents ? `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}` : "…"}
            </SecondaryButton>
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
}

import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { AgreedPriceField } from "../components/AgreedPriceField";
import { ApplicationStatusBadge } from "../components/ApplicationStatusBadge";
import { GlassCard } from "../components/GlassCard";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { getAllOpportunities } from "../data/localSelectors";
import { centsToDollarsInput, dollarsInputToCents, formatCents, parseMoneyToCents } from "../lib/money";
import { useAgentExchange } from "../state/AgentExchangeContext";
import type { Application } from "../state/marketplaceTypes";

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function QueueSection({ children, count, title }: { children: ReactNode; count: number; title: string }) {
  return (
    <section className="space-y-5">
      <h2 className="flex items-center gap-3 font-ae-display text-2xl font-semibold tracking-tight text-ae-text sm:text-3xl">
        {title}
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 font-ae-label text-xs font-semibold tabular-nums text-ae-text-muted">
          {count}
        </span>
      </h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function RowHeader({ agentName, date, status, title }: { agentName: string; date: string; status: ReactNode; title: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3.5">
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ae-primary to-ae-cyan font-ae-label text-sm font-bold text-ae-primary-ink"
      >
        {initials(agentName) || "AG"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
          {date}
        </p>
        <h3 className="mt-1 break-words font-ae-display text-lg font-semibold leading-snug tracking-tight text-ae-text sm:text-xl">
          {title}
        </h3>
        <p className="mt-0.5 break-words text-sm text-ae-text-muted">
          Agent: {agentName}
        </p>
      </div>
      {status}
    </div>
  );
}

export function ApplicationsPage() {
  const {
    acceptHireRequest,
    applications,
    canAcceptHireRequest,
    canManageApplication,
    hireRequests,
    isSharedMode,
    negotiations,
  } = useAgentExchange();

  const hasLocalActivity =
    applications.length > 0 || hireRequests.length > 0 || negotiations.length > 0;

  return (
    <section className="space-y-10">
      <PageHeader
        description={
          isSharedMode
            ? "Applications, negotiations, and hire requests you are a party to. Organizations accept applications; agent operators accept hire requests. Accepting creates a contract for both sides."
            : "Review locally submitted applications, negotiations, and hire requests. Accepting an application or hire request creates a local contract."
        }
        eyebrow="Applications"
        title={isSharedMode ? "Your action queue." : "Local action queue."}
      >
        {hasLocalActivity ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              ["Applications", applications.length, "bg-ae-primary"],
              ["Hire requests", hireRequests.length, "bg-ae-cyan"],
              ["Negotiations", negotiations.length, "bg-ae-amber"],
            ].map(([label, count, dot]) => (
              <span
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ae-text-muted"
                key={label}
              >
                <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
                {label}
                <span className="font-semibold tabular-nums text-ae-text">{count}</span>
              </span>
            ))}
          </div>
        ) : null}
      </PageHeader>

      {!hasLocalActivity ? (
        <GlassCard className="mx-auto max-w-2xl space-y-4 px-6 py-10 text-center sm:px-10">
          <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-2xl border border-ae-primary/20 bg-ae-primary/10 text-ae-primary">
            <svg className="size-6" viewBox="0 0 24 24">
              <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
            </svg>
          </span>
          <h2 className="font-ae-display text-2xl font-semibold tracking-tight text-ae-text">
            {isSharedMode ? "Nothing waiting on you" : "No local actions yet"}
          </h2>
          <p className="mx-auto max-w-xl text-sm leading-6 text-ae-text-muted">
            Apply, negotiate, or hire from the marketplace and agent profiles to
            populate this queue.
          </p>
          <div className="pt-2">
            <Link
              className="inline-flex items-center justify-center rounded-xl bg-ae-primary-action px-5 py-3 font-ae-label text-sm font-semibold text-ae-primary-ink transition hover:-translate-y-0.5"
              to="/marketplace"
            >
              Browse the marketplace
            </Link>
          </div>
        </GlassCard>
      ) : null}

      {applications.length > 0 ? (
        <QueueSection count={applications.length} title="Opportunity Applications">
          {applications.map((application) => (
            <GlassCard className="space-y-4 sm:p-6" interactive key={application.id}>
              <RowHeader
                agentName={application.agentName}
                date={formatCreatedAt(application.createdAt)}
                status={<ApplicationStatusBadge status={application.status} />}
                title={application.opportunityTitle}
              />
              <p className="whitespace-pre-line break-words rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm leading-6 text-ae-text-muted">
                {application.proposal}
              </p>
              {application.status === "pending" ? (
                canManageApplication(application) ? (
                  <AcceptApplicationWithPrice application={application} />
                ) : (
                  <p className="text-xs text-ae-text-muted">
                    Waiting for the organization to review.
                  </p>
                )
              ) : null}
            </GlassCard>
          ))}
        </QueueSection>
      ) : null}

      {hireRequests.length > 0 ? (
        <QueueSection count={hireRequests.length} title="Hire Requests">
          {hireRequests.map((hireRequest) => (
            <GlassCard className="space-y-4 sm:p-6" interactive key={hireRequest.id}>
              <RowHeader
                agentName={hireRequest.agentName}
                date={formatCreatedAt(hireRequest.createdAt)}
                status={<ApplicationStatusBadge status={hireRequest.status} />}
                title={
                  <>
                    {hireRequest.quickJobTitle ||
                      hireRequest.opportunityTitle}
                    {hireRequest.amountCents ? (
                      <span className="ml-2 inline-flex items-center whitespace-nowrap rounded-full border border-ae-emerald/25 bg-ae-emerald/10 px-2.5 py-0.5 align-middle font-ae-label text-xs font-semibold tabular-nums text-ae-emerald">
                        {formatCents(hireRequest.amountCents, hireRequest.currency ?? "USD")}
                      </span>
                    ) : null}
                  </>
                }
              />
              {hireRequest.status === "pending" ? (
                canAcceptHireRequest(hireRequest) ? (
                  <div className="border-t border-white/[0.06] pt-4">
                    <PrimaryButton
                      className="w-full sm:w-auto"
                      onClick={() => acceptHireRequest(hireRequest.id)}
                    >
                      Accept Hire Request
                    </PrimaryButton>
                  </div>
                ) : (
                  <p className="text-xs text-ae-text-muted">
                    Waiting for the agent operator to accept.
                  </p>
                )
              ) : null}
            </GlassCard>
          ))}
        </QueueSection>
      ) : null}

      {negotiations.length > 0 ? (
        <QueueSection count={negotiations.length} title="Pending Negotiations">
          {negotiations.map((negotiation) => (
            <GlassCard className="space-y-4 sm:p-6" interactive key={negotiation.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
                    {formatCreatedAt(negotiation.createdAt)}
                  </p>
                  <h3 className="mt-1 break-words font-ae-display text-lg font-semibold leading-snug tracking-tight text-ae-text sm:text-xl">
                    {negotiation.opportunityTitle}
                  </h3>
                </div>
                <ApplicationStatusBadge status="negotiating" />
              </div>
              <dl className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Rate", negotiation.rate],
                  ["Timeline", negotiation.timeline],
                  ["Status", "Pending"],
                ].map(([label, value]) => (
                  <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3" key={label}>
                    <dt className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                      {label}
                    </dt>
                    <dd className="mt-1 break-words font-semibold text-ae-text">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="break-words text-sm leading-6 text-ae-text-muted">
                {negotiation.milestoneNotes}
              </p>
            </GlassCard>
          ))}
        </QueueSection>
      ) : null}

      {hasLocalActivity && !isSharedMode ? (
        <p className="mx-auto w-fit rounded-full border border-ae-primary/20 bg-ae-primary/10 px-4 py-2 text-center font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-primary">
          Local data stored in this browser
        </p>
      ) : null}
    </section>
  );
}

/**
 * Accepting an application fixes the contract's price, so the organization
 * confirms it here. Suggested from the brief's budget; editable until accepted.
 */
function AcceptApplicationWithPrice({ application }: { application: Application }) {
  const { acceptApplication, createdOpportunities, isSharedMode } = useAgentExchange();
  const opportunity = getAllOpportunities(createdOpportunities).find(
    (candidate) => candidate.id === application.opportunityId,
  );
  const suggested = parseMoneyToCents(opportunity?.budget);
  const [amountInput, setAmountInput] = useState(suggested ? centsToDollarsInput(suggested) : "");
  const amountCents = dollarsInputToCents(amountInput);

  return (
    <div className="space-y-4 border-t border-white/[0.06] pt-4">
      <AgreedPriceField
        amountCents={amountCents}
        hint={opportunity?.budget ? `Suggested from the brief's budget (${opportunity.budget}).` : undefined}
        onChange={setAmountInput}
        value={amountInput}
      />
      <PrimaryButton
        className="w-full sm:w-auto"
        disabled={isSharedMode && amountCents === null}
        onClick={() => acceptApplication(application.id, amountCents ?? undefined)}
      >
        Accept Application
      </PrimaryButton>
    </div>
  );
}

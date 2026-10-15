import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ACCESS_RULES,
  SERVICE_KINDS,
  accessSteps,
  buyerStages,
  formatChannels,
  formatRefundLimit,
  formatSpendCap,
  renewalCheck,
  weekStages,
} from "../lib/managedService";
import { useAgentExchange } from "../state/AgentExchangeContext";
import type { LocalContract } from "../state/marketplaceTypes";
import { PrimaryButton } from "./PrimaryButton";

type ManagedServicePanelProps = {
  contract: LocalContract;
  /** The organization side sees access steps and the renew control; the agent side sees its rules. */
  isOrganizationSide: boolean;
};

/**
 * One week of a managed service: where the agent works, how access is shared,
 * the ad-spend cap or the support authority limit, and, for the organization,
 * starting the next week.
 */
export function ManagedServicePanel({ contract, isOrganizationSide }: ManagedServicePanelProps) {
  const navigate = useNavigate();
  const { renewContract } = useAgentExchange();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terms = contract.serviceTerms;
  if (!terms) return null;

  const kind = SERVICE_KINDS[terms.kind];
  const cap = formatSpendCap(terms.adSpendCapCents, contract.currency ?? "USD");
  const renewal = renewalCheck(contract);
  const stages = isOrganizationSide ? buyerStages(terms) : weekStages(terms);
  const isLastWeek = terms.week >= terms.weeks;
  const support = terms.kind === "support" ? terms.support : undefined;
  const contact = support?.escalationContact ?? (isOrganizationSide ? "you" : "the buyer");

  async function startNextWeek() {
    setBusy(true);
    setError(null);
    try {
      const next = await renewContract(contract.id);
      navigate(`/contracts/${next.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the next week.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="managed-service-title"
      className="overflow-hidden rounded-2xl border border-ae-primary/20 bg-gradient-to-b from-ae-primary/[0.06] to-ae-surface/70"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="min-w-0">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Managed service</p>
          <h2 id="managed-service-title" className="mt-1.5 font-ae-display text-lg font-semibold tracking-tight text-ae-text">
            {kind.label} · week {terms.week} of {terms.weeks}
          </h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-ae-label text-xs font-semibold text-ae-text-muted">
          {isLastWeek ? "Final week" : `${terms.weeks - terms.week} more agreed`}
        </span>
      </div>

      <div className="space-y-5 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-ae-text">This week</p>
          <ol className="mt-2 space-y-1.5 text-sm leading-6 text-ae-text-muted">
            {stages.map((stage, index) => (
              <li key={stage} className="flex gap-2.5">
                <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ae-primary/15 font-mono text-[11px] font-semibold text-ae-primary">
                  {index + 1}
                </span>
                <span>{stage.charAt(0).toUpperCase() + stage.slice(1)}</span>
              </li>
            ))}
          </ol>
        </div>

        {cap ? (
          <p className="rounded-xl border border-ae-amber/25 bg-ae-amber/[0.07] px-3.5 py-2.5 text-sm leading-6 text-ae-text-muted">
            <span className="font-semibold text-ae-amber">Ad spend cap: {cap}.</span>{" "}
            {isOrganizationSide
              ? "The platform bills ad spend to your own account; it never goes through AgentExchange. Set the same limit as the account's spending limit, so a mistake can't overspend."
              : "The platform bills ad spend to the buyer's own account. Never raise budgets above the cap."}
          </p>
        ) : null}

        {support ? (
          <div className="space-y-3">
            <p className="rounded-xl border border-ae-amber/25 bg-ae-amber/[0.07] px-3.5 py-2.5 text-sm leading-6 text-ae-text-muted">
              <span className="font-semibold text-ae-amber">Authority limit: {formatRefundLimit(support.refundLimitCents, contract.currency ?? "USD")}.</span>{" "}
              {isOrganizationSide
                ? `Anything above it, or outside the playbook, goes to ${contact}. Where your help desk or store allows it, give the agent's seat the same refund limit.`
                : `Never refund or credit above it. Send anything above it, or outside the playbook, to ${contact}.`}
            </p>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ae-text-muted">Channels</dt>
                <dd className="mt-0.5 text-ae-text">{support.channels.length ? formatChannels(support.channels) : "Agreed with the agent"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ae-text-muted">Coverage</dt>
                <dd className="mt-0.5 break-words text-ae-text">{support.hours ?? "Agreed with the agent"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ae-text-muted">Expected volume</dt>
                <dd className="mt-0.5 text-ae-text">{support.weeklyVolume ? `About ${support.weeklyVolume.toLocaleString("en-US")} a week` : "Not stated"}</dd>
              </div>
            </dl>
            {support.channels.includes("phone") ? (
              <p className="text-xs leading-5 text-ae-text-muted">
                On calls the agent says it is an AI, follows call-recording consent, hands the caller to a person on request, and never takes card numbers by voice.
              </p>
            ) : null}
          </div>
        ) : null}

        {terms.platforms.length ? (
          <div>
            <p className="text-sm font-semibold text-ae-text">{isOrganizationSide ? "Share access" : "Where you work"}</p>
            <p className="mt-1 text-xs leading-5 text-ae-text-muted">{ACCESS_RULES}</p>
            <div className="mt-2.5 space-y-2">
              {terms.platforms.map((platform) =>
                isOrganizationSide ? (
                  <details key={platform} className="group rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5">
                    <summary className="cursor-pointer list-none text-sm font-medium text-ae-text [&::-webkit-details-marker]:hidden">
                      {platform}
                      <span aria-hidden className="float-right text-ae-text-muted transition group-open:rotate-180">▾</span>
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-ae-text-muted">{accessSteps(platform)}</p>
                  </details>
                ) : (
                  <p key={platform} className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-sm text-ae-text">
                    {platform}
                  </p>
                ),
              )}
            </div>
          </div>
        ) : null}

        {isOrganizationSide && !isLastWeek ? (
          <div className="space-y-2 border-t border-white/[0.06] pt-4">
            <PrimaryButton className="w-full" disabled={busy || !renewal.ok} onClick={() => void startNextWeek()}>
              {busy ? "Starting…" : `Start week ${terms.week + 1}`}
            </PrimaryButton>
            <p className="text-xs leading-5 text-ae-text-muted">
              {renewal.ok
                ? "Creates next week's contract at the same price. You fund it separately; the agent carries on once it's funded."
                : renewal.reason}
            </p>
          </div>
        ) : null}

        {error ? <p className="rounded-xl border border-ae-error/25 bg-ae-error/[0.08] px-3.5 py-2.5 text-sm text-ae-error">{error}</p> : null}
      </div>
    </section>
  );
}

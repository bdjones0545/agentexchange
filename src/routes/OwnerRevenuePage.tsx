import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AuthRequiredNotice } from "../components/AuthRequiredNotice";
import { GlassCard } from "../components/GlassCard";
import { PageHeader } from "../components/PageHeader";
import { formatCents } from "../lib/money";
import { fetchOwnerRevenue, revenueStatusLabel, type RevenueResult, type RevenueTotals } from "../lib/ownerRevenue";
import { useAuth } from "../state/AuthContext";

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function contractCount(count: number) {
  return `${count} ${count === 1 ? "contract" : "contracts"}`;
}

function TotalsCard({ label, totals }: { label: string; totals: RevenueTotals }) {
  return (
    <GlassCard className="flex h-full flex-col gap-3">
      <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">{label}</p>
      <p className="font-ae-display text-3xl font-semibold tracking-[-0.03em] text-ae-text">{formatCents(totals.netRevenueCents)}</p>
      <dl className="space-y-1 text-sm text-ae-text-muted">
        <div className="flex justify-between gap-3"><dt>Buyer fees</dt><dd className="font-medium text-ae-text">{formatCents(totals.buyerFeeCents)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Platform fees</dt><dd className="font-medium text-ae-text">{formatCents(totals.platformFeeCents)}</dd></div>
        {totals.refundCostCents > 0 ? (
          <div className="flex justify-between gap-3"><dt>Refunds borne</dt><dd className="font-medium text-ae-text">−{formatCents(totals.refundCostCents)}</dd></div>
        ) : null}
        <div className="flex justify-between gap-3"><dt>Released</dt><dd className="font-medium text-ae-text">{contractCount(totals.contracts)} · {formatCents(totals.priceCents)}</dd></div>
      </dl>
    </GlassCard>
  );
}

export function OwnerRevenuePage() {
  const { loading: authLoading, session, isSupabaseEnabled } = useAuth();
  const [result, setResult] = useState<RevenueResult | null>(null);
  const token = session?.access_token;

  useEffect(() => {
    if (authLoading || !token) return;
    let cancelled = false;
    void fetchOwnerRevenue(browserTimeZone()).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, token]);

  const report = result?.state === "ok" ? result.report : null;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Platform owner"
        title="AgentExchange revenue"
        description="Buyer service fees plus platform fees on released live contracts, read from AgentExchange's own ledger rather than the shared Stripe balance. Shown before Stripe's processing fees."
      />

      {!isSupabaseEnabled ? (
        <GlassCard><p className="text-sm text-ae-text-muted">Revenue needs the live database; this build runs in local demo mode.</p></GlassCard>
      ) : authLoading ? null : !token || result?.state === "signed-out" ? (
        <AuthRequiredNotice action="see platform revenue" />
      ) : result === null ? (
        <p className="text-sm text-ae-text-muted">Loading the ledger…</p>
      ) : result.state === "not-owner" ? (
        <GlassCard>
          <p className="text-sm leading-6 text-ae-text-muted">
            This page isn't available for your account. <Link className="font-semibold text-ae-primary underline decoration-ae-primary/40 underline-offset-4" to="/wallet">Go to your wallet</Link>
          </p>
        </GlassCard>
      ) : result.state === "error" ? (
        <GlassCard><p className="text-sm text-ae-text-muted">{result.message}</p></GlassCard>
      ) : report ? (
        <>
          <section aria-label="Revenue totals" className="grid gap-4 sm:grid-cols-3">
            <TotalsCard label="Today" totals={report.today} />
            <TotalsCard label="This month" totals={report.month} />
            <TotalsCard label="All time" totals={report.allTime} />
          </section>
          <p className="text-xs text-ae-text-muted">
            Grouped by release date in {report.timeZone}. Live Stripe mode only; test-mode pilot contracts are excluded. As of {new Date(report.asOf).toLocaleString()}.
          </p>

          <GlassCard className="space-y-4 p-6 sm:p-8">
            <h2 className="font-ae-display text-2xl font-semibold tracking-tight text-ae-text">Released contracts</h2>
            {report.lines.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.12] px-5 py-10 text-center text-sm leading-6 text-ae-text-muted">
                No live contract has been released yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-white/[0.04]">
                    <tr>
                      {["Released", "Contract", "Price", "Buyer fee", "Platform fee", "Operator net", "Status", "Refunds"].map((h) => (
                        <th className="whitespace-nowrap border-b border-white/[0.08] px-3 py-2.5 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text" key={h} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {report.lines.map((line) => (
                      <tr className="align-top text-ae-text/80" key={line.contractId}>
                        <td className="whitespace-nowrap px-3 py-2.5">{new Date(line.releasedAt).toLocaleDateString(undefined, { timeZone: report.timeZone })}</td>
                        <td className="min-w-[12rem] break-words px-3 py-2.5 text-ae-text">{line.title}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">{formatCents(line.priceCents, line.currency)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5" title={line.buyerFeeFromCharge ? undefined : "No live charge matched this payout; the published 3% rate was used"}>
                          {formatCents(line.buyerFeeCents, line.currency)}{line.buyerFeeFromCharge ? "" : " (est.)"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">{formatCents(line.platformFeeCents, line.currency)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">{formatCents(line.operatorNetCents, line.currency)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">{revenueStatusLabel(line)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {line.refundedCents > 0 ? `${formatCents(line.refundedCents, line.currency)} (platform −${formatCents(line.refundCostCents, line.currency)})` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      ) : null}
    </div>
  );
}

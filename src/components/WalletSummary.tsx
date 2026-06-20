import type { WalletSummary as WalletSummaryData } from "../data/earnings";
import { GlassCard } from "./GlassCard";

type WalletSummaryProps = {
  summary: WalletSummaryData;
};

export function WalletSummary({ summary }: WalletSummaryProps) {
  return (
    <GlassCard className="grid gap-6 overflow-hidden lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Revenue & Earnings
        </p>
        <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
          {summary.accountName}
        </h1>
        <p className="mt-3 max-w-2xl text-ae-text-muted">
          A premium earnings dashboard for revenue, payouts, transactions, and
          contract performance. All values are static mock data for Phase 5.
        </p>
      </div>

      <div className="rounded-ae-xl border border-ae-primary/20 bg-ae-primary/10 p-5 shadow-ae-glow">
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-primary">
          Reporting period
        </p>
        <p className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
          {summary.reportingPeriod}
        </p>
        <p className="mt-4 text-sm text-ae-text-muted">
          Available balance:{" "}
          <span className="font-semibold text-ae-text">
            {summary.availableBalance}
          </span>
        </p>
      </div>
    </GlassCard>
  );
}

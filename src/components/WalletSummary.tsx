import type { WalletSummary as WalletSummaryData } from "../data/earnings";
import { PageHeader } from "./PageHeader";

type WalletSummaryProps = {
  summary: WalletSummaryData;
  description?: string;
};

/** The wallet masthead: page title, lede and the headline contract value. */
export function WalletSummary({ summary, description }: WalletSummaryProps) {
  return (
    <PageHeader
      actions={
        <div className="w-full min-w-[15rem] rounded-2xl border border-ae-primary/25 bg-gradient-to-br from-ae-primary/[0.12] via-ae-surface/80 to-ae-surface/40 p-5 shadow-[0_24px_48px_-28px_rgb(0_0_0_/_0.7)] sm:w-auto">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-primary">
            Agreed value · {summary.reportingPeriod}
          </p>
          <p className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.03em] text-ae-text">
            {summary.totalRevenue}
          </p>
          <p className="mt-1 text-xs text-ae-text-muted">Not a withdrawable balance</p>
        </div>
      }
      description={description ?? "Contract value, payment status and payouts for your account."}
      eyebrow="Wallet"
      title={summary.accountName}
    />
  );
}

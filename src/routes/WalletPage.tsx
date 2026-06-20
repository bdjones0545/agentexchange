import { EarningsChart } from "../components/EarningsChart";
import { PayoutCard } from "../components/PayoutCard";
import { RevenueCard } from "../components/RevenueCard";
import { TransactionList } from "../components/TransactionList";
import { WalletSummary } from "../components/WalletSummary";
import {
  earningsHistory,
  payouts,
  revenueMetrics,
  transactions,
  walletSummary,
} from "../data/earnings";

export function WalletPage() {
  const pendingPayouts = payouts.filter((payout) => payout.status !== "Paid");
  const completedPayouts = payouts.filter((payout) => payout.status === "Paid");

  return (
    <section className="space-y-10">
      <WalletSummary summary={walletSummary} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {revenueMetrics.map((metric) => (
          <RevenueCard key={metric.id} metric={metric} />
        ))}
      </section>

      <EarningsChart points={earningsHistory} />

      <TransactionList transactions={transactions} />

      <section className="space-y-4">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Pending Payouts
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text">
            Scheduled earnings releases
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {pendingPayouts.map((payout) => (
            <PayoutCard key={payout.id} payout={payout} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Completed Payouts
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text">
            Recently completed payouts
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {completedPayouts.map((payout) => (
            <PayoutCard key={payout.id} payout={payout} />
          ))}
        </div>
      </section>
    </section>
  );
}

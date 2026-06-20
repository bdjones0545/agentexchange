import type { Transaction } from "../data/earnings";
import { GlassCard } from "./GlassCard";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

type TransactionListProps = {
  transactions: Transaction[];
};

export function TransactionList({ transactions }: TransactionListProps) {
  return (
    <GlassCard className="space-y-5">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Recent Transactions
        </p>
        <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
          Contract revenue activity
        </h2>
      </div>

      <div className="space-y-3">
        {transactions.map((transaction) => (
          <article
            className="grid gap-4 rounded-ae-lg border border-white/[0.06] bg-white/[0.04] p-4 lg:grid-cols-[0.8fr_1fr_1fr_1.2fr_auto_auto] lg:items-center"
            key={transaction.id}
          >
            <div>
              <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                Date
              </p>
              <p className="mt-1 text-sm font-semibold text-ae-text">
                {transaction.date}
              </p>
            </div>
            <div>
              <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                Organization
              </p>
              <p className="mt-1 text-sm font-semibold text-ae-text">
                {transaction.organization}
              </p>
            </div>
            <div>
              <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                Agent
              </p>
              <p className="mt-1 text-sm font-semibold text-ae-text">
                {transaction.agent}
              </p>
            </div>
            <div>
              <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                Contract
              </p>
              <p className="mt-1 text-sm font-semibold text-ae-text">
                {transaction.contract}
              </p>
            </div>
            <div>
              <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                Amount
              </p>
              <p className="mt-1 font-ae-display text-lg font-semibold text-ae-text">
                {transaction.amount}
              </p>
            </div>
            <PaymentStatusBadge status={transaction.status} />
          </article>
        ))}
      </div>
    </GlassCard>
  );
}

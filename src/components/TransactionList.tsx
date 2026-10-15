import type { ReactNode } from "react";

import type { Transaction } from "../data/earnings";
import type { ContractPaymentStatus } from "../state/marketplaceTypes";
import { PaymentStatusBadge as ContractPaymentStatusBadge } from "./FundingPanel";
import { GlassCard } from "./GlassCard";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

type TransactionRow = Transaction & {
  /** A contract's real money state. When present it is shown instead of `status`. */
  paymentStatus?: ContractPaymentStatus;
};

type TransactionListProps = {
  transactions: TransactionRow[];
  /** Shown in place of the list when there are no rows. */
  emptyState?: ReactNode;
};

export function TransactionList({ transactions, emptyState }: TransactionListProps) {
  return (
    <GlassCard className="space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Transactions
          </p>
          <h2 className="mt-2 font-ae-display text-2xl font-semibold tracking-tight text-ae-text sm:text-3xl">
            Contract activity
          </h2>
        </div>
        {transactions.length > 0 ? (
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            {transactions.length} {transactions.length === 1 ? "contract" : "contracts"}
          </p>
        ) : null}
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.12] px-5 py-10 text-center text-sm leading-6 text-ae-text-muted">
          {emptyState ?? "No contract activity yet."}
        </div>
      ) : (
        <ul className="space-y-3">
          {transactions.map((transaction) => (
            <li
              className="grid gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-white/[0.14] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"
              key={transaction.id}
            >
              <div className="min-w-0">
                <p className="break-words font-semibold text-ae-text">{transaction.contract}</p>
                <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ae-text-muted">
                  <div className="flex min-w-0 gap-1.5">
                    <dt>Organization</dt>
                    <dd className="break-words font-medium text-ae-text">{transaction.organization}</dd>
                  </div>
                  <div className="flex min-w-0 gap-1.5">
                    <dt>Agent</dt>
                    <dd className="break-words font-medium text-ae-text">{transaction.agent}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Date</dt>
                    <dd className="font-medium text-ae-text">{transaction.date}</dd>
                  </div>
                </dl>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <p className="font-ae-display text-xl font-semibold tracking-tight text-ae-text">
                  {transaction.amount}
                </p>
                {transaction.paymentStatus ? (
                  <ContractPaymentStatusBadge status={transaction.paymentStatus} />
                ) : (
                  <PaymentStatusBadge status={transaction.status} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

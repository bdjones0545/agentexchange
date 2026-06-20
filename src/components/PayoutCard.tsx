import type { Payout } from "../data/earnings";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

type PayoutCardProps = {
  payout: Payout;
};

export function PayoutCard({ payout }: PayoutCardProps) {
  const accent = accentStyles[payout.accent];

  return (
    <GlassCard className={`space-y-4 ${accent.border}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
            {payout.reference}
          </p>
          <h3 className="mt-2 font-ae-display text-xl font-semibold text-ae-text">
            {payout.title}
          </h3>
        </div>
        <PaymentStatusBadge status={payout.status} />
      </div>

      <div className="grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
        <div>
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Date
          </p>
          <p className="mt-1 text-sm font-semibold text-ae-text">
            {payout.date}
          </p>
        </div>
        <div>
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Destination
          </p>
          <p className="mt-1 text-sm font-semibold text-ae-text">
            {payout.destination}
          </p>
        </div>
        <div>
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Amount
          </p>
          <p className={`mt-1 font-ae-display text-xl font-semibold ${accent.text}`}>
            {payout.amount}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

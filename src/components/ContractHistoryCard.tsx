import { contractPriceLabel } from "../lib/money";
import type { ContractHistory } from "../data/agents";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";

type ContractHistoryCardProps = {
  contract: ContractHistory;
};

export function ContractHistoryCard({ contract }: ContractHistoryCardProps) {
  const accent = accentStyles[contract.accent];

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-ae-display text-lg font-semibold tracking-tight text-ae-text">
            {contract.title}
          </h3>
          {contract.summary ? (
            <p className="mt-1.5 text-sm leading-6 text-ae-text-muted">
              {contract.summary}
            </p>
          ) : null}
        </div>
        {contract.rating > 0 ? (
          <span
            aria-label={`Rated ${contract.rating} of 5`}
            className={`shrink-0 text-sm tracking-[0.15em] ${accent.text}`}
            role="img"
          >
            {"★".repeat(contract.rating)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <p className="text-xs text-ae-text-muted">{contract.date}</p>
        <p className="font-ae-display text-lg font-semibold tabular-nums text-ae-text">
          {contractPriceLabel(contract)}
        </p>
      </div>
    </GlassCard>
  );
}

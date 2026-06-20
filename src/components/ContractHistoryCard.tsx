import type { ContractHistory } from "../data/agents";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";

type ContractHistoryCardProps = {
  contract: ContractHistory;
};

export function ContractHistoryCard({ contract }: ContractHistoryCardProps) {
  const accent = accentStyles[contract.accent];

  return (
    <GlassCard className={`space-y-4 ${accent.border}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-ae-display text-xl font-semibold text-ae-text">
            {contract.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-ae-text-muted">
            {contract.summary}
          </p>
        </div>
        <div className={`font-ae-label text-xs font-semibold ${accent.text}`}>
          {"*".repeat(contract.rating)}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text-muted">
          {contract.date}
        </p>
        <p className="font-ae-display text-lg font-semibold text-ae-text">
          {contract.value}
        </p>
      </div>
    </GlassCard>
  );
}

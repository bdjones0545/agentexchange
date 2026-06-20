import { useNavigate } from "react-router-dom";

import type { Contract } from "../data/operations";
import { accentStyles } from "./accentStyles";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { GlassCard } from "./GlassCard";
import { SecondaryButton } from "./SecondaryButton";

type ContractCardProps = {
  contract: Contract;
};

export function ContractCard({ contract }: ContractCardProps) {
  const navigate = useNavigate();
  const accent = accentStyles[contract.accent];

  return (
    <GlassCard
      className={`space-y-5 transition duration-200 hover:-translate-y-1 hover:border-ae-primary/30 ${accent.border}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
            {contract.organization}
          </p>
          <h3 className="mt-2 font-ae-display text-2xl font-semibold tracking-[-0.02em] text-ae-text">
            {contract.title}
          </h3>
        </div>
        <ContractStatusBadge status={contract.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3">
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Agent
          </p>
          <p className="mt-2 font-semibold text-ae-text">{contract.agent}</p>
        </div>
        <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3">
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Contract Value
          </p>
          <p className="mt-2 font-semibold text-ae-text">{contract.value}</p>
        </div>
        <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3">
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Start Date
          </p>
          <p className="mt-2 font-semibold text-ae-text">{contract.startDate}</p>
        </div>
        <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3">
          <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
            Due Date
          </p>
          <p className="mt-2 font-semibold text-ae-text">{contract.dueDate}</p>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/[0.06] pt-4">
        <div className="flex items-center justify-between">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            Progress
          </p>
          <p className={`font-ae-label text-sm font-semibold ${accent.text}`}>
            {contract.progress}%
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ae-primary-action to-ae-primary"
            style={{ width: `${contract.progress}%` }}
          />
        </div>
      </div>

      <SecondaryButton
        className="w-full sm:w-auto"
        onClick={() => navigate(`/contracts/${contract.id}`)}
      >
        View Details
      </SecondaryButton>
    </GlassCard>
  );
}

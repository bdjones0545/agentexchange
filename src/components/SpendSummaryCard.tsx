import type { OrganizationSummary } from "../data/organizations";
import type { ContractStatus } from "../data/operations";
import { contractValueDollars, formatCents } from "../lib/money";
import { GlassCard } from "./GlassCard";

/** An organization summary whose rating is null until the organization has actually left a review. */
export type OrganizationFigures = Omit<OrganizationSummary, "rating"> & { rating: number | null };

type ValuedContract = { status: ContractStatus; value: string; amountCents?: number };

function dollars(value: number) {
  return formatCents(Math.round(value * 100));
}

/**
 * Contract-value figures from the contracts the viewer can see: the agreed
 * price where one is stored, otherwise a best-effort reading of the legacy
 * text. These are contract values, not money moved; payment state lives on
 * each contract.
 */
export function contractValueFigures(contracts: ValuedContract[]) {
  const total = contracts.reduce((sum, contract) => sum + contractValueDollars(contract), 0);
  const completed = contracts
    .filter((contract) => contract.status === "Completed")
    .reduce((sum, contract) => sum + contractValueDollars(contract), 0);

  return {
    averageContractValue: dollars(contracts.length > 0 ? total / contracts.length : 0),
    completedSpend: dollars(completed),
    pendingSpend: dollars(Math.max(0, total - completed)),
    totalSpend: dollars(total),
  };
}

/** The summary a page shows: real contract values and no rating until one was given. */
export function organizationFigures(
  summary: OrganizationSummary,
  contracts: ValuedContract[],
  reviewsGiven: number,
): OrganizationFigures {
  return {
    ...summary,
    ...contractValueFigures(contracts),
    rating: reviewsGiven > 0 ? summary.rating : null,
  };
}

type SpendSummaryCardProps = {
  organization: Pick<OrganizationSummary, "averageContractValue" | "completedSpend" | "pendingSpend" | "totalSpend">;
};

export function SpendSummaryCard({ organization }: SpendSummaryCardProps) {
  return (
    <GlassCard className="relative overflow-hidden sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-ae-primary/10 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Contract value
          </p>
          <p className="mt-3 font-ae-display text-4xl font-semibold tabular-nums tracking-[-0.04em] text-ae-text sm:text-5xl">
            {organization.totalSpend}
          </p>
          <p className="mt-2 text-sm leading-6 text-ae-text-muted">
            Agreed prices of the contracts you can see. Whether each one is funded or paid is shown on the contract.
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
          {[
            ["In progress", organization.pendingSpend],
            ["Completed", organization.completedSpend],
            ["Avg contract", organization.averageContractValue],
          ].map(([label, value]) => (
            <div
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
              key={label}
            >
              <dt className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                {label}
              </dt>
              <dd className="mt-1 truncate font-semibold tabular-nums text-ae-text">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </GlassCard>
  );
}

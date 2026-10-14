import { contractPriceLabel } from "../lib/money";
import { PaymentStatusBadge } from "./FundingPanel";
import type { ContractPaymentStatus } from "../state/marketplaceTypes";
import { useNavigate } from "react-router-dom";

import {
  getAgentRatingLabel,
  getAgentCompletedContracts,
  getVerificationStatus,
} from "../data/agentTrust";
import { getAllAgents } from "../data/localSelectors";
import type { Contract } from "../data/operations";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { GlassCard } from "./GlassCard";
import { SecondaryButton } from "./SecondaryButton";
import { VerificationBadge } from "./VerificationBadge";

type ContractCardProps = {
  contract: Contract;
};

export function ContractCard({ contract }: ContractCardProps) {
  // Supabase-backed rows carry money state; seed contracts do not.
  const paymentStatus = (contract as { paymentStatus?: ContractPaymentStatus }).paymentStatus;
  const navigate = useNavigate();
  const { agentReviews, contractDisputes, createdAgents, localContracts } =
    useAgentExchange();
  const allAgents = getAllAgents(createdAgents);
  const agent = allAgents.find((candidate) => candidate.name === contract.agent);
  // Trust signals count only the contracts this viewer can actually see.
  const allContracts: Contract[] = localContracts;
  const verificationStatus = agent
    ? getVerificationStatus({
        agent,
        contracts: allContracts,
        disputes: contractDisputes,
        reviews: agentReviews,
      })
    : undefined;
  const progress = Math.max(0, Math.min(100, contract.progress));

  return (
    <GlassCard className="@container sm:p-6" interactive>
      <div className="flex flex-col gap-5 @3xl:flex-row @3xl:items-center @3xl:gap-8">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ContractStatusBadge status={contract.status} />
            {paymentStatus && paymentStatus !== "unfunded" ? (
              <PaymentStatusBadge status={paymentStatus} />
            ) : null}
          </div>
          <h3 className="mt-3 break-words font-ae-display text-lg font-semibold leading-snug tracking-tight text-ae-text sm:text-xl">
            {contract.title}
          </h3>
          <p className="mt-1 truncate text-sm text-ae-text-muted">
            <span className="text-ae-text">{contract.organization}</span>
            <span aria-hidden className="mx-2 text-ae-text-muted/50">/</span>
            {contract.agent}
          </p>
          {agent && verificationStatus ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <VerificationBadge status={verificationStatus} />
              <span className="inline-flex w-fit items-center whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-ae-text-muted">
                {getAgentRatingLabel(agent, agentReviews)}
              </span>
              <span className="inline-flex w-fit items-center whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-ae-text-muted">
                {getAgentCompletedContracts(agent, allContracts).length} done
              </span>
            </div>
          ) : null}
        </div>

        <dl className="grid grid-cols-3 gap-3 @3xl:w-80 @3xl:shrink-0">
          {[
            ["Value", contractPriceLabel(contract)],
            ["Start", contract.startDate || "—"],
            ["Due", contract.dueDate || "—"],
          ].map(([label, value]) => (
            <div className="min-w-0" key={label}>
              <dt className="truncate font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                {label}
              </dt>
              <dd className="mt-1 truncate text-sm font-semibold text-ae-text" title={value}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Progress
            </p>
            <p className="font-ae-label text-xs font-semibold tabular-nums text-ae-primary">
              {contract.progress}%
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ae-primary to-ae-cyan"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <SecondaryButton
          className="w-full sm:w-auto"
          onClick={() => navigate(`/contracts/${contract.id}`)}
        >
          View Details
          <svg aria-hidden className="size-4" viewBox="0 0 16 16">
            <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
          </svg>
        </SecondaryButton>
      </div>
    </GlassCard>
  );
}

import { Link } from "react-router-dom";

import { AuthRequiredNotice } from "../components/AuthRequiredNotice";
import { GlassCard } from "../components/GlassCard";
import { PayoutNotice } from "../components/PayoutNotice";
import { RevenueCard } from "../components/RevenueCard";
import { TransactionList } from "../components/TransactionList";
import { WalletSummary } from "../components/WalletSummary";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import type { RevenueMetric, WalletSummary as WalletSummaryData } from "../data/earnings";
import { contractPriceLabel, contractValueDollars, formatCents } from "../lib/money";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { useAuth } from "../state/AuthContext";
import type { LocalContract } from "../state/marketplaceTypes";

function formatMoney(dollars: number) {
  return formatCents(Math.round(dollars * 100));
}

function totalValue(contracts: LocalContract[]) {
  return contracts.reduce((total, contract) => total + contractValueDollars(contract), 0);
}

function contractCount(count: number) {
  return `${count} ${count === 1 ? "contract" : "contracts"}`;
}

export function WalletPage() {
  const { contractWorkspaces, isSharedMode, localContracts } = useAgentExchange();
  const { loading: authLoading } = useAuth();
  // Every figure derives from the contracts this account is a party to: their
  // agreed price, status and platform-managed payment state. Nothing here is
  // simulated, and none of it is a balance that can be withdrawn.
  const contracts: LocalContract[] = localContracts.map((contract) => {
    const workspace = contractWorkspaces.find(
      (candidate) => candidate.contractId === contract.id,
    );

    return workspace ? { ...contract, ...applyWorkspaceToContract(contract, workspace) } : contract;
  });
  const completed = contracts.filter((contract) => contract.status === "Completed");
  const inProgress = contracts.filter((contract) => contract.status !== "Completed");
  const held = contracts.filter((contract) => contract.paymentStatus === "authorized");
  const released = contracts.filter(
    (contract) => contract.paymentStatus === "captured" || contract.paymentStatus === "paid_out",
  );

  // WalletSummary shows the account name, period and total agreed value.
  const summary: WalletSummaryData = {
    accountName: "Your contracts",
    reportingPeriod: "All time",
    totalRevenue: formatMoney(totalValue(contracts)),
    pendingPayouts: formatMoney(totalValue(inProgress)),
    availableBalance: formatMoney(totalValue(released)),
    revenueThisMonth: formatMoney(totalValue(contracts)),
  };
  const metrics: RevenueMetric[] = [
    {
      id: "in-progress",
      label: "In progress",
      value: formatMoney(totalValue(inProgress)),
      detail: `${contractCount(inProgress.length)} not yet completed`,
      accent: "amber",
    },
    {
      id: "completed",
      label: "Completed",
      value: formatMoney(totalValue(completed)),
      detail: `${contractCount(completed.length)} marked completed`,
      accent: "violet",
    },
    {
      id: "held",
      label: "Funded · held",
      value: formatMoney(totalValue(held)),
      detail: "Card authorization holds awaiting approval. Holds can expire.",
      accent: "cyan",
    },
    {
      id: "released",
      label: "Paid",
      value: formatMoney(totalValue(released)),
      detail: "Payment captured after the work was approved",
      accent: "emerald",
    },
  ];
  const transactions = contracts.map((contract) => {
    const paymentStatus = contract.paymentStatus ?? "unfunded";
    const paid = paymentStatus === "captured" || paymentStatus === "paid_out";

    return {
      id: `local-${contract.id}`,
      date: contract.startDate || "—",
      organization: contract.organization,
      agent: contract.agent,
      contract: contract.title,
      amount: contractPriceLabel(contract),
      status: paid ? ("Paid" as const) : ("Pending" as const),
      accent: paid ? ("emerald" as const) : ("amber" as const),
      paymentStatus,
    };
  });

  return (
    <div className="space-y-10">
      <WalletSummary
        description={
          isSharedMode
            ? "Figures come from the agreed price and payment status of contracts you’re a party to. None of it is a balance you can withdraw here."
            : "Local demo mode: figures come from contracts created in this browser. No real payments are made."
        }
        summary={summary}
      />

      {authLoading ? null : <AuthRequiredNotice action="see your contracts and payments" />}

      <section aria-label="Contract value by status" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <RevenueCard key={metric.id} metric={metric} />
        ))}
      </section>

      <TransactionList
        emptyState={
          <>
            <p>No contracts yet. When you hire an agent, or your agent is hired, the contract appears here.</p>
            <p className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 font-semibold">
              <Link className="text-ae-primary underline decoration-ae-primary/40 underline-offset-4" to="/marketplace">Browse briefs</Link>
              <Link className="text-ae-primary underline decoration-ae-primary/40 underline-offset-4" to="/agents">Browse agents</Link>
            </p>
          </>
        }
        transactions={transactions}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PayoutNotice />
        <GlassCard className="flex flex-col p-5 sm:p-6">
          <h3 className="font-ae-display text-base font-semibold text-ae-text">Payout history</h3>
          <p className="mt-1.5 text-sm leading-6 text-ae-text-muted">
            Payout history isn’t shown here yet. Earnings transfer to your connected Stripe account after work is approved; bank settlement follows your Stripe payout schedule.
          </p>
          <Link className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-semibold text-ae-primary underline decoration-ae-primary/40 underline-offset-4 transition hover:decoration-ae-primary" to="/account#payment-settings">
            Payout settings <span aria-hidden>→</span>
          </Link>
        </GlassCard>
      </div>
    </div>
  );
}

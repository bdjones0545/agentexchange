import { EarningsChart } from "../components/EarningsChart";
import { PayoutCard } from "../components/PayoutCard";
import { RevenueCard } from "../components/RevenueCard";
import { TransactionList } from "../components/TransactionList";
import { WalletSummary } from "../components/WalletSummary";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import {
  earningsHistory,
  payouts,
  revenueMetrics,
  transactions,
  walletSummary,
} from "../data/earnings";
import { useAgentExchange } from "../state/AgentExchangeContext";

function parseMoney(value: string) {
  const numbers = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];

  if (numbers.length === 0) {
    return 0;
  }

  const average = numbers.reduce((total, number) => total + number, 0) / numbers.length;

  return value.toLowerCase().includes("k") ? average * 1000 : average;
}

function formatMoney(value: number) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }

  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }

  return `$${Math.round(value)}`;
}

export function WalletPage() {
  const { contractWorkspaces, localContracts } = useAgentExchange();
  const localContractsWithProgress = localContracts.map((contract) => {
    const workspace = contractWorkspaces.find(
      (candidate) => candidate.contractId === contract.id,
    );

    return workspace ? applyWorkspaceToContract(contract, workspace) : contract;
  });
  const completedLocalContracts = localContractsWithProgress.filter(
    (contract) => contract.status === "Completed",
  );
  const pendingLocalContracts = localContractsWithProgress.filter(
    (contract) => contract.status !== "Completed",
  );
  const localTotalRevenue = localContractsWithProgress.reduce(
    (total, contract) => total + parseMoney(contract.value),
    0,
  );
  const localCompletedRevenue = completedLocalContracts.reduce(
    (total, contract) => total + parseMoney(contract.value),
    0,
  );
  const localPendingRevenue = pendingLocalContracts.reduce(
    (total, contract) => total + parseMoney(contract.value),
    0,
  );
  const dynamicWalletSummary = {
    ...walletSummary,
    availableBalance:
      localCompletedRevenue > 0
        ? formatMoney(localCompletedRevenue)
        : walletSummary.availableBalance,
    pendingPayouts:
      localPendingRevenue > 0
        ? formatMoney(localPendingRevenue)
        : walletSummary.pendingPayouts,
    revenueThisMonth:
      localTotalRevenue > 0
        ? formatMoney(localTotalRevenue)
        : walletSummary.revenueThisMonth,
    totalRevenue:
      localTotalRevenue > 0
        ? formatMoney(1840000 + localTotalRevenue)
        : walletSummary.totalRevenue,
  };
  const dynamicRevenueMetrics = revenueMetrics.map((metric) => {
    if (metric.id === "total-revenue") {
      return { ...metric, value: dynamicWalletSummary.totalRevenue };
    }

    if (metric.id === "pending-payouts") {
      return { ...metric, value: dynamicWalletSummary.pendingPayouts };
    }

    if (metric.id === "available-balance") {
      return { ...metric, value: dynamicWalletSummary.availableBalance };
    }

    if (metric.id === "revenue-this-month") {
      return { ...metric, value: dynamicWalletSummary.revenueThisMonth };
    }

    return metric;
  });
  const localTransactions = localContractsWithProgress.map((contract) => ({
    id: `local-${contract.id}`,
    date: new Date().toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    organization: contract.organization,
    agent: contract.agent,
    contract: contract.title,
    amount: contract.value,
    status: contract.status === "Completed" ? "Paid" as const : "Pending" as const,
    accent: contract.status === "Completed" ? "emerald" as const : "amber" as const,
  }));
  const pendingPayouts = payouts.filter((payout) => payout.status !== "Paid");
  const completedPayouts = payouts.filter((payout) => payout.status === "Paid");

  return (
    <section className="space-y-10">
      <WalletSummary summary={dynamicWalletSummary} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dynamicRevenueMetrics.map((metric) => (
          <RevenueCard key={metric.id} metric={metric} />
        ))}
      </section>

      <EarningsChart points={earningsHistory} />

      <TransactionList transactions={[...localTransactions, ...transactions]} />

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

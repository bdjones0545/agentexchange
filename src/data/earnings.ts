import type { AccentTone } from "./marketplace";

export type PaymentStatus = "Paid" | "Pending" | "Scheduled" | "Processing";

export type RevenueMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
  accent: AccentTone;
};

export type WalletSummary = {
  accountName: string;
  reportingPeriod: string;
  totalRevenue: string;
  pendingPayouts: string;
  availableBalance: string;
  revenueThisMonth: string;
};

export type EarningsPoint = {
  id: string;
  label: string;
  value: number;
  displayValue: string;
};

export type Transaction = {
  id: string;
  date: string;
  organization: string;
  agent: string;
  contract: string;
  amount: string;
  status: PaymentStatus;
  accent: AccentTone;
};

export type Payout = {
  id: string;
  title: string;
  date: string;
  destination: string;
  amount: string;
  status: PaymentStatus;
  reference: string;
  accent: AccentTone;
};

export const walletSummary: WalletSummary = {
  accountName: "AgentExchange Earnings",
  reportingPeriod: "June 2026",
  totalRevenue: "$1.84M",
  pendingPayouts: "$48.2k",
  availableBalance: "$126.8k",
  revenueThisMonth: "$94.6k",
};

export const revenueMetrics: RevenueMetric[] = [
  {
    id: "total-revenue",
    label: "Total Revenue",
    value: walletSummary.totalRevenue,
    detail: "Lifetime contract earnings",
    accent: "violet",
  },
  {
    id: "pending-payouts",
    label: "Pending Payouts",
    value: walletSummary.pendingPayouts,
    detail: "Scheduled for review and release",
    accent: "amber",
  },
  {
    id: "available-balance",
    label: "Available Balance",
    value: walletSummary.availableBalance,
    detail: "Ready for standard payout",
    accent: "emerald",
  },
  {
    id: "revenue-this-month",
    label: "Revenue This Month",
    value: walletSummary.revenueThisMonth,
    detail: "Across completed milestones",
    accent: "cyan",
  },
];

export const earningsHistory: EarningsPoint[] = [
  {
    id: "jan",
    label: "Jan",
    value: 42000,
    displayValue: "$42k",
  },
  {
    id: "feb",
    label: "Feb",
    value: 56000,
    displayValue: "$56k",
  },
  {
    id: "mar",
    label: "Mar",
    value: 68000,
    displayValue: "$68k",
  },
  {
    id: "apr",
    label: "Apr",
    value: 74000,
    displayValue: "$74k",
  },
  {
    id: "may",
    label: "May",
    value: 88000,
    displayValue: "$88k",
  },
  {
    id: "jun",
    label: "Jun",
    value: 94600,
    displayValue: "$94.6k",
  },
];

export const transactions: Transaction[] = [
  {
    id: "txn-orbit-audit",
    date: "Jun 20, 2026",
    organization: "Orbit Dynamics",
    agent: "Nexus-1 Alpha",
    contract: "Autonomous Infrastructure Audit",
    amount: "$12,400",
    status: "Paid",
    accent: "emerald",
  },
  {
    id: "txn-helix-risk",
    date: "Jun 19, 2026",
    organization: "Helix Capital",
    agent: "Fin-Agent Prime",
    contract: "Risk Signal Synthesis",
    amount: "$8,750",
    status: "Processing",
    accent: "cyan",
  },
  {
    id: "txn-protocol-threat",
    date: "Jun 18, 2026",
    organization: "Protocol Labs",
    agent: "Nexus-1 Alpha",
    contract: "Protocol Threat Model",
    amount: "$15,000",
    status: "Pending",
    accent: "amber",
  },
  {
    id: "txn-nova-routing",
    date: "Jun 17, 2026",
    organization: "Nova Retail",
    agent: "Atlas-Alpha",
    contract: "GTM Routing Automation",
    amount: "$6,200",
    status: "Scheduled",
    accent: "violet",
  },
];

export const payouts: Payout[] = [
  {
    id: "payout-pending-jun-24",
    title: "June contract earnings",
    date: "Jun 24, 2026",
    destination: "Operating account",
    amount: "$28,400",
    status: "Scheduled",
    reference: "Payout PX-1048",
    accent: "amber",
  },
  {
    id: "payout-pending-jun-27",
    title: "Approved milestone earnings",
    date: "Jun 27, 2026",
    destination: "Revenue account",
    amount: "$19,800",
    status: "Pending",
    reference: "Payout PX-1052",
    accent: "violet",
  },
  {
    id: "payout-completed-jun-14",
    title: "Mid-month earnings",
    date: "Jun 14, 2026",
    destination: "Operating account",
    amount: "$36,000",
    status: "Paid",
    reference: "Payout PX-1031",
    accent: "emerald",
  },
  {
    id: "payout-completed-jun-07",
    title: "Completed contract earnings",
    date: "Jun 07, 2026",
    destination: "Revenue account",
    amount: "$41,250",
    status: "Paid",
    reference: "Payout PX-1024",
    accent: "cyan",
  },
];

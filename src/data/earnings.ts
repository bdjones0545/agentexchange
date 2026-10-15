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


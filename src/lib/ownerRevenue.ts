// Browser side of the owner revenue report (/owner/revenue). The figures and
// the owner check both live in /api/owner-revenue; this only fetches them with
// the signed-in session and names the outcome.
import { supabase } from "./supabase";

export type RevenueTotals = {
  contracts: number;
  priceCents: number;
  buyerFeeCents: number;
  platformFeeCents: number;
  revenueCents: number;
  refundCostCents: number;
  netRevenueCents: number;
};

export type RevenueLine = {
  contractId: string;
  title: string;
  releasedAt: string;
  currency: string;
  priceCents: number;
  buyerFeeCents: number;
  buyerFeeFromCharge: boolean;
  platformFeeCents: number;
  operatorNetCents: number;
  revenueCents: number;
  refundedCents: number;
  refundCostCents: number;
  netRevenueCents: number;
  payoutStatus: string;
  paymentStatus: string;
};

export type RevenueReport = {
  currency: string;
  timeZone: string;
  asOf: string;
  today: RevenueTotals;
  month: RevenueTotals;
  allTime: RevenueTotals;
  lines: RevenueLine[];
};

export type RevenueResult =
  | { state: "ok"; report: RevenueReport }
  | { state: "signed-out" }
  | { state: "not-owner" }
  | { state: "error"; message: string };

export function revenueResult(status: number, body: unknown): RevenueResult {
  const data = (body ?? {}) as { ok?: boolean; error?: unknown };
  if (status === 200 && data.ok) return { state: "ok", report: body as RevenueReport };
  if (status === 401) return { state: "signed-out" };
  if (status === 404) return { state: "not-owner" };
  return { state: "error", message: typeof data.error === "string" ? data.error : `Request failed (${status})` };
}

export async function fetchOwnerRevenue(timeZone: string): Promise<RevenueResult> {
  if (!supabase) return { state: "error", message: "Supabase is not configured" };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { state: "signed-out" };
  try {
    const res = await fetch(`/api/owner-revenue?tz=${encodeURIComponent(timeZone)}`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
    return revenueResult(res.status, await res.json().catch(() => ({})));
  } catch {
    return { state: "error", message: "Could not reach the server" };
  }
}

/** One status a person can read, from the payout and the contract's payment state. */
export function revenueStatusLabel(line: Pick<RevenueLine, "payoutStatus" | "paymentStatus" | "refundedCents">): string {
  if (line.paymentStatus === "refunded") return "Refunded";
  if (line.payoutStatus === "reversed") return "Transfer reversed";
  if (line.refundedCents > 0) return "Partly refunded";
  if (line.payoutStatus === "transferred" || line.payoutStatus === "paid") return "Paid to operator";
  if (line.payoutStatus === "pending") return "Operator payout pending";
  return line.payoutStatus;
}

// AgentExchange's own revenue, apart from the shared TrainChat Stripe balance.
//
// The Stripe account is shared with other products, so its balance cannot say
// what AgentExchange earned. The ledger can. Each released contract has one
// payouts row (gross = the agreed price, fee = the platform fee, net = what the
// operator is owed) and a captured charge in payments (the price plus the buyer
// service fee). Platform revenue per contract = buyer fee + platform fee.
//
// Only provider_mode = 'live' rows count; the pilot's test-mode rows are tagged
// 'test'. Figures are before Stripe's processing fees, which come out of the
// shared balance and are not recorded in the ledger.
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUYER_FEE_BPS } from "./pricing.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The platform owner gate: Supabase auth user ids in PLATFORM_OWNER_USER_IDS
 * (comma-separated). Unset or empty means nobody, so the revenue endpoint is
 * closed until the owner names themselves.
 */
export function isPlatformOwner(userId: string, env: Record<string, string | undefined> = process.env): boolean {
  const ids = (env.PLATFORM_OWNER_USER_IDS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter((s) => UUID.test(s));
  return ids.includes(userId.toLowerCase());
}

export interface PayoutLedgerRow {
  contract_id: string;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  currency: string;
  status: string;
  reversed_cents: number | null;
  payment_intent_id: string | null;
  /** The Connect transfer id once the operator was paid; never sent to the browser. */
  provider_ref: string | null;
  created_at: string;
}

export interface PaymentLedgerRow {
  contract_id: string;
  kind: "charge" | "refund";
  status: string;
  amount_cents: number;
  provider_ref: string | null;
}

export interface ContractTitleRow {
  id: string;
  title: string;
  payment_status: string;
}

export interface RevenueLedger {
  payouts: PayoutLedgerRow[];
  payments: PaymentLedgerRow[];
  contracts: ContractTitleRow[];
}

export interface RevenueLine {
  contractId: string;
  title: string;
  /** When the charge was captured and the payout recorded. */
  releasedAt: string;
  currency: string;
  priceCents: number;
  buyerFeeCents: number;
  /** False when no live charge matched the payout and the published buyer fee rate was used. */
  buyerFeeFromCharge: boolean;
  platformFeeCents: number;
  operatorNetCents: number;
  /** Buyer fee + platform fee. */
  revenueCents: number;
  refundedCents: number;
  /** The share of refunds the platform bore after the operator's share was taken back. */
  refundCostCents: number;
  /** revenueCents − refundCostCents. */
  netRevenueCents: number;
  /** payouts.status: pending (operator not yet paid), transferred, reversed. */
  payoutStatus: string;
  /** contracts.payment_status: captured, paid_out, refunded. */
  paymentStatus: string;
}

export interface RevenueTotals {
  contracts: number;
  priceCents: number;
  buyerFeeCents: number;
  platformFeeCents: number;
  revenueCents: number;
  refundCostCents: number;
  netRevenueCents: number;
}

export interface RevenueSummary {
  currency: "USD";
  timeZone: string;
  asOf: string;
  today: RevenueTotals;
  month: RevenueTotals;
  allTime: RevenueTotals;
  /** Newest first. */
  lines: RevenueLine[];
}

export function revenueLine(payout: PayoutLedgerRow, contract: ContractTitleRow | undefined, payments: PaymentLedgerRow[]): RevenueLine {
  const own = payments.filter((p) => p.contract_id === payout.contract_id);
  // The charge the payout was cut from: the price plus the buyer fee.
  const charge = own.find((p) => p.kind === "charge" && p.provider_ref !== null && p.provider_ref === payout.payment_intent_id);
  const fromCharge = charge !== undefined && charge.amount_cents >= payout.gross_cents;
  const buyerFeeCents = fromCharge ? charge.amount_cents - payout.gross_cents : Math.round((payout.gross_cents * BUYER_FEE_BPS) / 10_000);
  const chargedCents = payout.gross_cents + buyerFeeCents;
  // Refund rows hold the cumulative refunded amount for the charge.
  const refundedCents = own.filter((p) => p.kind === "refund").reduce((t, p) => t + p.amount_cents, 0);
  // A refund takes back the operator's proportional share: reversed from the
  // transfer once they were paid (server/connect.ts), withheld before that.
  const recoveredCents = payout.provider_ref
    ? (payout.reversed_cents ?? 0)
    : Math.floor((payout.net_cents * refundedCents) / Math.max(1, chargedCents));
  const revenueCents = buyerFeeCents + payout.fee_cents;
  const refundCostCents = Math.max(0, refundedCents - recoveredCents);
  return {
    contractId: payout.contract_id,
    title: contract?.title ?? "Untitled contract",
    releasedAt: payout.created_at,
    currency: payout.currency,
    priceCents: payout.gross_cents,
    buyerFeeCents,
    buyerFeeFromCharge: fromCharge,
    platformFeeCents: payout.fee_cents,
    operatorNetCents: payout.net_cents,
    revenueCents,
    refundedCents,
    refundCostCents,
    netRevenueCents: revenueCents - refundCostCents,
    payoutStatus: payout.status,
    paymentStatus: contract?.payment_status ?? "unknown",
  };
}

/** A valid IANA time zone, or UTC. */
export function safeTimeZone(value: string | null | undefined): string {
  if (!value || value.length > 64) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

/** YYYY-MM-DD of an instant in a time zone. */
function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function emptyTotals(): RevenueTotals {
  return { contracts: 0, priceCents: 0, buyerFeeCents: 0, platformFeeCents: 0, revenueCents: 0, refundCostCents: 0, netRevenueCents: 0 };
}

function add(totals: RevenueTotals, line: RevenueLine) {
  totals.contracts += 1;
  totals.priceCents += line.priceCents;
  totals.buyerFeeCents += line.buyerFeeCents;
  totals.platformFeeCents += line.platformFeeCents;
  totals.revenueCents += line.revenueCents;
  totals.refundCostCents += line.refundCostCents;
  totals.netRevenueCents += line.netRevenueCents;
}

/** Totals by release date in the viewer's time zone; a later refund stays with its contract's release date. */
export function summarizeRevenue(ledger: RevenueLedger, options: { now: Date; timeZone: string }): RevenueSummary {
  const contracts = new Map(ledger.contracts.map((c) => [c.id, c]));
  const lines = ledger.payouts
    .map((p) => revenueLine(p, contracts.get(p.contract_id), ledger.payments))
    .sort((a, b) => (a.releasedAt < b.releasedAt ? 1 : a.releasedAt > b.releasedAt ? -1 : 0));
  const today = localDate(options.now, options.timeZone);
  const month = today.slice(0, 7);
  const summary: RevenueSummary = {
    currency: "USD",
    timeZone: options.timeZone,
    asOf: options.now.toISOString(),
    today: emptyTotals(),
    month: emptyTotals(),
    allTime: emptyTotals(),
    lines,
  };
  for (const line of lines) {
    // Funding refuses anything but USD, so another currency is a ledger error:
    // it is listed but kept out of the totals rather than summed as dollars.
    if (line.currency !== "USD") continue;
    const day = localDate(new Date(line.releasedAt), options.timeZone);
    add(summary.allTime, line);
    if (day.slice(0, 7) === month) add(summary.month, line);
    if (day === today) add(summary.today, line);
  }
  return summary;
}

type Page = { data: unknown; error: { message: string } | null };

/** Every row of a query, advancing by what each page returned so a lower max-rows cap cannot skip rows. */
async function allRows<T>(step: string, page: (from: number, to: number) => PromiseLike<Page>): Promise<T[]> {
  const out: T[] = [];
  for (;;) {
    const { data, error } = await page(out.length, out.length + 999);
    if (error) throw new Error(`${step}: ${error.message}`);
    const rows = (data ?? []) as T[];
    if (rows.length === 0) return out;
    out.push(...rows);
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The live ledger rows behind the revenue report. Reads with the service role: the owner sees every contract. */
export async function loadLiveRevenue(client: SupabaseClient): Promise<RevenueLedger> {
  const payouts = await allRows<PayoutLedgerRow>("payouts", (from, to) =>
    client
      .from("payouts")
      .select("contract_id,gross_cents,fee_cents,net_cents,currency,status,reversed_cents,payment_intent_id,provider_ref,created_at")
      .eq("provider_mode", "live")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  const contracts: ContractTitleRow[] = [];
  const payments: PaymentLedgerRow[] = [];
  // Ids go in the query string; keep each list short.
  for (const ids of chunks([...new Set(payouts.map((p) => p.contract_id))], 100)) {
    const { data, error } = await client.from("contracts").select("id,title,payment_status").in("id", ids);
    if (error) throw new Error(`contracts: ${error.message}`);
    contracts.push(...((data ?? []) as ContractTitleRow[]));
    payments.push(
      ...(await allRows<PaymentLedgerRow>("payments", (from, to) =>
        client
          .from("payments")
          .select("contract_id,kind,status,amount_cents,provider_ref")
          .eq("provider_mode", "live")
          .in("contract_id", ids)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      )),
    );
  }
  return { payouts, payments, contracts };
}

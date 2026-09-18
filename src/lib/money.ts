// Money helpers. Amounts are integer cents in a three-letter currency; the
// database enforces the same. Text budgets ("$400 - $800", "$1.2k / month")
// still exist on opportunities and negotiations, so there is a parser for
// turning them into a sensible default offer, never into a stored price.

export type Money = { amountCents: number; currency: string };

const K = 1000;

/**
 * Best-effort reading of a human budget string. A range becomes its midpoint,
 * "k" scales by a thousand, and "/ month"-style cadence is ignored. Returns
 * null when no number is present. Used only to prefill an editable field.
 */
export function parseMoneyToCents(text: string | null | undefined): number | null {
  if (!text) return null;
  const matches = [...text.matchAll(/\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m)?/gi)];
  const values = matches
    .map((m) => {
      const n = Number(m[1].replace(/,/g, ""));
      if (!Number.isFinite(n)) return null;
      const suffix = (m[2] ?? "").toLowerCase();
      return suffix === "k" ? n * K : suffix === "m" ? n * K * K : n;
    })
    .filter((n): n is number => n !== null && n > 0);
  if (values.length === 0) return null;
  const avg = values.slice(0, 2).reduce((a, b) => a + b, 0) / Math.min(values.length, 2);
  return Math.round(avg * 100);
}

export function formatCents(amountCents: number, currency = "USD", { compact = false } = {}): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
    ...(compact ? { notation: "compact" as const } : {}),
  });
  return formatter.format(amountCents / 100);
}

/** What a contract at this price yields to the operator and the platform. */
export function feeBreakdown(amountCents: number, platformFeeBps: number) {
  const feeCents = Math.round((amountCents * platformFeeBps) / 10_000);
  return { grossCents: amountCents, feeCents, netCents: amountCents - feeCents };
}

/** Parse a dollars input ("600", "600.50", "$1,200") into cents; null if invalid. */
export function dollarsInputToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 ? cents : null;
}

export function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

/** The price to show for a contract: the agreed amount when it exists, else the legacy text. */
export function contractPriceLabel(contract: { value: string; amountCents?: number; currency?: string }): string {
  return contract.amountCents ? formatCents(contract.amountCents, contract.currency ?? "USD") : contract.value;
}

/** Dollars for arithmetic: the agreed amount, else a best-effort reading of the text. */
export function contractValueDollars(contract: { value: string; amountCents?: number }): number {
  if (contract.amountCents) return contract.amountCents / 100;
  const cents = parseMoneyToCents(contract.value);
  return cents ? cents / 100 : 0;
}

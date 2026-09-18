// The take rate, confirmed 2026-09-18: 15% from the operator side (snapshotted on
// each contract by the database), 3% service fee added on the organization side
// so card processing never comes out of the platform fee. Minimums apply.
export const PLATFORM_FEE_BPS = 1500;
export const BUYER_FEE_BPS = 300;
export const MIN_CONTRACT_CENTS = 5000;
export const MIN_PLATFORM_FEE_CENTS = 500;

export interface Quote {
  /** The agreed price the operator and organization settled on. */
  amountCents: number;
  /** 3% service fee the organization pays on top. */
  buyerFeeCents: number;
  /** What the organization's card is charged. */
  totalCents: number;
  /** Deducted from the price before the operator is paid. */
  platformFeeCents: number;
  /** What the operator receives. */
  operatorNetCents: number;
  currency: string;
}

export function quoteContract(amountCents: number, platformFeeBps: number, currency = "USD"): Quote {
  if (!Number.isInteger(amountCents) || amountCents < MIN_CONTRACT_CENTS) {
    throw new Error(`contract price must be at least ${MIN_CONTRACT_CENTS} cents`);
  }
  const buyerFeeCents = Math.round((amountCents * BUYER_FEE_BPS) / 10_000);
  const platformFeeCents = Math.max(MIN_PLATFORM_FEE_CENTS, Math.round((amountCents * platformFeeBps) / 10_000));
  return {
    amountCents,
    buyerFeeCents,
    totalCents: amountCents + buyerFeeCents,
    platformFeeCents,
    operatorNetCents: amountCents - platformFeeCents,
    currency,
  };
}

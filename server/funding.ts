// Fund on hire, hold, release on approval.
//
// Three operations, each pure over a Ledger and a StripeGateway so they can be
// proven without the network:
//   createFunding  — the organization asks to fund a contract; a Checkout
//                    session with a manual-capture PaymentIntent is created and
//                    a pending payment recorded.
//   handleStripeEvent — the webhook: the ONLY path that moves payment_status
//                    forward on Stripe's word, idempotent per event id.
//   releaseFunds   — the organization releases (captures) after approving all
//                    deliverables, or cancels an uncaptured hold.
import type { Ledger, PaymentStatus } from "./ledger.js";
import { quoteContract, type Quote } from "./pricing.js";
import type { StripeGateway } from "./stripe.js";

export interface FundingDeps {
  ledger: Ledger;
  stripe: StripeGateway;
  appUrl: string;
  /** Tell the worker something happened (identifiers only). Best-effort. */
  notify?: (event: { event: "contract_funded" | "deliverable_decision"; contractId: string }) => Promise<unknown>;
}

export class FundingError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function requireOrgSide(ledger: Ledger, contractId: string, callerProfileId: string) {
  const contract = await ledger.getContract(contractId);
  if (!contract) throw new FundingError(404, "contract not found");
  const owner = await ledger.organizationOwner(contract.organization_id);
  if (!owner || owner !== callerProfileId) throw new FundingError(403, "only the organization side may do this");
  return contract;
}

export async function createFunding(
  deps: FundingDeps,
  input: { contractId: string; callerProfileId: string; customerEmail?: string },
): Promise<{ url: string; quote: Quote; sessionId: string }> {
  const contract = await requireOrgSide(deps.ledger, input.contractId, input.callerProfileId);
  if (contract.payment_status !== "unfunded") throw new FundingError(409, `contract is already ${contract.payment_status}`);
  if (!contract.amount_cents) throw new FundingError(409, "contract has no agreed price");
  let quote: Quote;
  try {
    quote = quoteContract(contract.amount_cents, contract.platform_fee_bps, contract.currency);
  } catch (e) {
    throw new FundingError(409, e instanceof Error ? e.message : "invalid price");
  }
  const session = await deps.stripe.createCheckoutSession({
    contractId: contract.id,
    title: contract.title,
    currency: quote.currency,
    amountCents: quote.amountCents,
    buyerFeeCents: quote.buyerFeeCents,
    successUrl: `${deps.appUrl}/contracts/${contract.id}?funding=complete`,
    cancelUrl: `${deps.appUrl}/contracts/${contract.id}?funding=cancelled`,
    customerEmail: input.customerEmail,
  });
  if (!session.url) throw new FundingError(502, "Stripe returned no checkout URL");
  await deps.ledger.recordPayment({
    contractId: contract.id,
    providerRef: session.id,
    kind: "charge",
    amountCents: quote.totalCents,
    currency: quote.currency,
    status: "pending",
    metadata: { quote, checkoutSessionId: session.id },
  });
  return { url: session.url, quote, sessionId: session.id };
}

type StripeLikeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** Apply one Stripe event. Returns what happened, for the response body and the log. */
export async function handleStripeEvent(deps: FundingDeps, event: StripeLikeEvent): Promise<{ outcome: string; contractId?: string }> {
  const obj = event.data.object;
  const metadata = (obj.metadata ?? {}) as Record<string, unknown>;
  const contractIdHint = str(metadata.contractId) ?? str(obj.client_reference_id);
  const claimed = await deps.ledger.claimEvent(event.id, event.type, contractIdHint);
  if (!claimed) return { outcome: "duplicate", contractId: contractIdHint ?? undefined };

  const finish = async (outcome: string, contractId?: string) => {
    await deps.ledger.finishEvent(event.id, outcome);
    return { outcome, contractId };
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const sessionId = str(obj.id);
      const paymentIntentId = str(obj.payment_intent);
      const contractId = contractIdHint;
      if (!sessionId || !paymentIntentId || !contractId) return finish("ignored: missing ids");
      const contract = await deps.ledger.getContract(contractId);
      if (!contract) return finish("ignored: contract not found", contractId);
      // The session's pending payment becomes the authorized hold, keyed by the PaymentIntent.
      await deps.ledger.updatePayment(sessionId, { status: "authorized", providerRef: paymentIntentId, metadata: { checkoutSessionId: sessionId } });
      if (contract.payment_status === "unfunded") {
        await deps.ledger.setPaymentStatus(contractId, "authorized");
      }
      try {
        await deps.notify?.({ event: "contract_funded", contractId });
      } catch {
        // best-effort
      }
      return finish("authorized", contractId);
    }
    case "checkout.session.expired": {
      const sessionId = str(obj.id);
      if (sessionId) await deps.ledger.updatePayment(sessionId, { status: "failed" });
      return finish("expired", contractIdHint ?? undefined);
    }
    case "payment_intent.succeeded": {
      // Confirmation of a capture (release already recorded it); make it true even if release crashed midway.
      const piId = str(obj.id);
      if (!piId) return finish("ignored: no id");
      const payment = await deps.ledger.findPaymentByRef(piId);
      if (!payment) return finish("ignored: unknown payment intent");
      if (payment.status !== "captured") await deps.ledger.updatePayment(piId, { status: "captured" });
      const contract = await deps.ledger.getContract(payment.contract_id);
      if (contract && contract.payment_status === "authorized") await deps.ledger.setPaymentStatus(payment.contract_id, "captured");
      return finish("captured", payment.contract_id);
    }
    case "payment_intent.canceled": {
      const piId = str(obj.id);
      if (!piId) return finish("ignored: no id");
      const payment = await deps.ledger.findPaymentByRef(piId);
      if (!payment) return finish("ignored: unknown payment intent");
      await deps.ledger.updatePayment(piId, { status: "failed" });
      const contract = await deps.ledger.getContract(payment.contract_id);
      if (contract && contract.payment_status === "authorized") await deps.ledger.setPaymentStatus(payment.contract_id, "unfunded");
      return finish("hold released", payment.contract_id);
    }
    case "charge.refunded": {
      const piId = str(obj.payment_intent);
      const refunded = typeof obj.amount_refunded === "number" ? obj.amount_refunded : 0;
      const currency = (str(obj.currency) ?? "usd").toUpperCase();
      if (!piId) return finish("ignored: no payment intent");
      const payment = await deps.ledger.findPaymentByRef(piId);
      if (!payment) return finish("ignored: unknown payment intent");
      await deps.ledger.recordPayment({ contractId: payment.contract_id, providerRef: `${piId}:refund:${event.id}`, kind: "refund", amountCents: refunded, currency, status: "refunded" });
      await deps.ledger.setPaymentStatus(payment.contract_id, "refunded");
      return finish("refunded", payment.contract_id);
    }
    default:
      return finish(`ignored: ${event.type}`);
  }
}

export async function releaseFunds(
  deps: FundingDeps,
  input: { contractId: string; callerProfileId: string; action: "capture" | "cancel" },
): Promise<{ paymentStatus: PaymentStatus; quote?: Quote }> {
  const contract = await requireOrgSide(deps.ledger, input.contractId, input.callerProfileId);
  if (contract.payment_status !== "authorized") throw new FundingError(409, `contract is ${contract.payment_status}, not funded`);
  const paymentIntentId = await deps.ledger.authorizedPaymentRef(contract.id);
  if (!paymentIntentId) throw new FundingError(409, "no authorized payment on record");

  if (input.action === "cancel") {
    await deps.stripe.cancelPaymentIntent(paymentIntentId);
    await deps.ledger.updatePayment(paymentIntentId, { status: "failed" });
    await deps.ledger.setPaymentStatus(contract.id, "unfunded");
    return { paymentStatus: "unfunded" };
  }

  // Release only when every deliverable has been approved: the same condition
  // the product uses to call a contract Completed.
  const summary = await deps.ledger.deliverableSummary(contract.id);
  if (summary.total === 0 || summary.approved !== summary.total) {
    throw new FundingError(409, `release requires every deliverable approved (${summary.approved} of ${summary.total})`);
  }
  const quote = quoteContract(contract.amount_cents ?? 0, contract.platform_fee_bps, contract.currency);
  const captured = await deps.stripe.capturePaymentIntent(paymentIntentId);
  if (captured.status !== "succeeded") throw new FundingError(502, `capture returned ${captured.status}`);
  await deps.ledger.updatePayment(paymentIntentId, { status: "captured" });
  await deps.ledger.setPaymentStatus(contract.id, "captured");
  const operator = await deps.ledger.operatorProfileForAgent(contract.agent_id);
  await deps.ledger.recordPayout({
    contractId: contract.id,
    agentId: contract.agent_id,
    operatorProfileId: operator,
    grossCents: quote.amountCents,
    feeCents: quote.platformFeeCents,
    currency: quote.currency,
  });
  return { paymentStatus: "captured", quote };
}

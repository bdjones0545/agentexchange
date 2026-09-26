import {selectAgentPaymentMethod} from './agentCards.js';
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
import { runMoneyOperation, type OperationStore } from "./moneyOperations.js";
import type { Ledger, PaymentStatus } from "./ledger.js";
import { quoteContract, type Quote } from "./pricing.js";
import type { StripeGateway } from "./stripe.js";

export interface FundingDeps {
  ledger: Ledger;
  operations: OperationStore;
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

async function createFundingCore(
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
    idempotencyKey: `fund:${contract.id}`,
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
    authorizedBy: "human",
  });
  return { url: session.url, quote, sessionId: session.id };
}

// ── Saved card: the human step (once) and the agent step (many) ─────────────

/** A Stripe-hosted page where the operator saves a card to their Customer. */
export async function createCardSetup(deps: FundingDeps, input: { profileId: string; email?: string; agentKeyId?:string; setupToken?:string }): Promise<{ url: string }> {
  let account = await deps.ledger.getBillingAccount(input.profileId);
  if (!account?.stripe_customer_id) {
    const customer = await deps.stripe.createCustomer({ email: input.email, profileId: input.profileId });
    await deps.ledger.upsertBillingAccount(input.profileId, { stripe_customer_id: customer.id });
    account = await deps.ledger.getBillingAccount(input.profileId);
  }
  const session = await deps.stripe.createSetupSession({
    customerId: account!.stripe_customer_id!,
    profileId: input.profileId,
    agentKeyId:input.agentKeyId, setupToken:input.setupToken,
    successUrl: `${deps.appUrl}/account?card=saved${input.agentKeyId ? `&agentSetup=${encodeURIComponent(input.agentKeyId)}` : ""}`,
    cancelUrl: `${deps.appUrl}/account?card=cancelled${input.agentKeyId ? `&agentSetup=${encodeURIComponent(input.agentKeyId)}` : ""}`,
  });
  if (!session.url) throw new FundingError(502, "Stripe returned no setup URL");
  return { url: session.url };
}

/**
 * An agent funds a contract with the operator's saved card: a manual-capture
 * hold placed off-session, within the operator's rolling 24-hour cap. Same
 * ledger effect as a completed Checkout, authorized_by = 'agent'.
 */
async function fundWithSavedCardCore(
  deps: FundingDeps,
  input: { contractId: string; callerProfileId: string; selectedPaymentMethod?:string },
): Promise<{ paymentStatus: PaymentStatus; quote: Quote; paymentIntentId: string }> {
  const contract = await requireOrgSide(deps.ledger, input.contractId, input.callerProfileId);
  if (contract.payment_status === 'authorized' || contract.payment_status === 'captured') {
    const id = await deps.ledger.authorizedPaymentRef(contract.id);
    if (!id) throw new FundingError(409, 'Payment requires reconciliation');
    return {paymentStatus:contract.payment_status,quote:quoteContract(contract.amount_cents ?? 0,contract.platform_fee_bps,contract.currency),paymentIntentId:id};
  }
  if (contract.payment_status !== "unfunded") throw new FundingError(409, `contract is already ${contract.payment_status}`);
  if (!contract.amount_cents) throw new FundingError(409, "contract has no agreed price");
  const account = await deps.ledger.getBillingAccount(input.callerProfileId);
  if (!account?.stripe_customer_id || !(input.selectedPaymentMethod ?? account.default_payment_method_id)) {
    throw new FundingError(409, "no saved card: the operator must add one at /account before agents can fund contracts");
  }
  let quote: Quote;
  try {
    quote = quoteContract(contract.amount_cents, contract.platform_fee_bps, contract.currency);
  } catch (e) {
    throw new FundingError(409, e instanceof Error ? e.message : "invalid price");
  }
  const hold = await deps.stripe.createOffSessionHold({
    idempotencyKey: `fund:${contract.id}`,
    contractId: contract.id,
    customerId: account.stripe_customer_id,
    paymentMethodId: input.selectedPaymentMethod ?? account.default_payment_method_id!,
    currency: quote.currency,
    amountCents: quote.totalCents,
    description: `AgentExchange contract ${contract.title}`,
  });
  if (hold.status !== "requires_capture") throw new FundingError(409, `card hold returned ${hold.status}; payment requires operator reconciliation before another funding attempt`);
  const snapshot = await deps.stripe.retrievePaymentIntent(hold.id);
  if (snapshot.status !== 'requires_capture' || snapshot.contractId !== contract.id || snapshot.amount !== quote.totalCents || snapshot.currency !== quote.currency) throw new FundingError(409, 'Payment does not match this contract');
  await deps.ledger.recordPayment({
    contractId: contract.id,
    providerRef: hold.id,
    kind: "charge",
    amountCents: quote.totalCents,
    currency: quote.currency,
    status: "authorized",
    metadata: { quote, offSession: true, captureBefore: snapshot.captureBefore },
    authorizedBy: "agent",
  });
  await deps.ledger.setPaymentStatus(contract.id, "authorized");
  try {
    await deps.notify?.({ event: "contract_funded", contractId: contract.id });
  } catch {
    // best-effort
  }
  return { paymentStatus: "authorized", quote, paymentIntentId: hold.id };
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
async function handleStripeEventCore(deps: FundingDeps, event: StripeLikeEvent): Promise<{ outcome: string; contractId?: string }> {
  const obj = event.data.object;
  const metadata = (obj.metadata ?? {}) as Record<string, unknown>;
  const contractIdHint = str(metadata.contractId) ?? str(obj.client_reference_id);
  await deps.ledger.claimEvent(event.id, event.type, contractIdHint);

  const finish = async (outcome: string, contractId?: string) => {
    await deps.ledger.finishEvent(event.id, outcome);
    return { outcome, contractId };
  };

  switch (event.type) {
    case "checkout.session.completed": {
      if (str(obj.mode) === "setup") {
        // The operator saved a card. Record the payment method for their agents.
        const profileId = str(metadata.profileId);
        if (metadata.purpose !== 'agent_card' || !profileId) return finish('ignored: unrelated setup');
        const billing = await deps.ledger.getBillingAccount(profileId);
        if (!billing || billing.stripe_customer_id !== str(obj.customer)) throw new FundingError(409, 'Setup customer does not match billing account');
        const setupIntent = obj.setup_intent as unknown;
        const paymentMethodId =
          typeof setupIntent === "string"
            ? await deps.stripe.retrieveSetupIntentPaymentMethod(setupIntent)
            : typeof setupIntent === "object" && setupIntent !== null
              ? str((setupIntent as Record<string, unknown>).payment_method)
              : null;
        if (!profileId) return finish("ignored: setup without profile");
        if (!paymentMethodId) return finish("ignored: setup without payment method", profileId);
        const pm = await deps.stripe.retrievePaymentMethod(paymentMethodId);
        if(metadata.agentKeyId) {
          if(!metadata.setupToken || !deps.ledger.saveAgentCard) throw new FundingError(409,'Agent card setup metadata is incomplete');
          const saved=await deps.ledger.saveAgentCard(profileId,str(metadata.agentKeyId)!,str(metadata.setupToken)!,pm);
          return finish(saved ? 'agent card saved' : 'ignored: superseded or revoked agent card setup');
        }
        await deps.ledger.upsertBillingAccount(profileId, {
          default_payment_method_id: pm.id,
          card_brand: pm.brand,
          card_last4: pm.last4,
          card_exp_month: pm.expMonth,
          card_exp_year: pm.expYear,
        });
        return finish("card saved");
      }
      const sessionId = str(obj.id);
      const paymentIntentId = str(obj.payment_intent);
      const contractId = contractIdHint;
      if (!sessionId || !paymentIntentId || !contractId) return finish("ignored: missing ids");
      const contract = await deps.ledger.getContract(contractId);
      if (!contract) return finish("ignored: contract not found", contractId);
      const snapshot = await deps.stripe.retrievePaymentIntent(paymentIntentId);
      const quote = quoteContract(contract.amount_cents ?? 0, contract.platform_fee_bps, contract.currency);
      if (snapshot.contractId !== contract.id || snapshot.amount !== quote.totalCents || snapshot.currency !== quote.currency) throw new FundingError(409, 'Checkout payment does not match contract');
      const prior = await deps.ledger.findPaymentByRef(sessionId) ?? await deps.ledger.findPaymentByRef(paymentIntentId);
      if (!prior || prior.contract_id !== contract.id) throw new FundingError(409,'Checkout ledger is not ready; retry event');
      if (snapshot.status === 'canceled') {
        await deps.ledger.updatePayment(sessionId,{status:'failed'});
        await deps.ledger.setPaymentStatus(contractId,'unfunded');
        return finish('hold released',contractId);
      }
      if (!['requires_capture','succeeded'].includes(snapshot.status)) throw new FundingError(409, `Checkout is not authorized: ${snapshot.status}`);
      // The session's pending payment becomes the authorized hold, keyed by the PaymentIntent.
      await deps.ledger.updatePayment(sessionId, { status: snapshot.status === "succeeded" ? "captured" : "authorized", providerRef: paymentIntentId, metadata: { checkoutSessionId: sessionId, captureBefore: snapshot.captureBefore } });
      if (contract.payment_status === "unfunded") {
        await deps.ledger.setPaymentStatus(contractId, snapshot.status === "succeeded" ? "captured" : "authorized");
      }
      if (snapshot.status === "succeeded") await ensurePayout(deps,contract,paymentIntentId);
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
      if (!payment) {
        if (!contractIdHint) return finish("ignored: unrelated payment");
        throw new FundingError(409, "Payment ledger is not ready; retry event");
      }
      if (payment.status !== "captured") await deps.ledger.updatePayment(piId, { status: "captured" });
      const contract = await deps.ledger.getContract(payment.contract_id);
      if (contract && contract.payment_status === "authorized") await deps.ledger.setPaymentStatus(payment.contract_id, "captured");
      if (contract) await ensurePayout(deps, contract, piId);
      return finish("captured", payment.contract_id);
    }
    case "payment_intent.canceled": {
      const piId = str(obj.id);
      if (!piId) return finish("ignored: no id");
      const payment = await deps.ledger.findPaymentByRef(piId);
      if (!payment) {
        if (!contractIdHint) return finish("ignored: unrelated payment");
        throw new FundingError(409, "Payment ledger is not ready; retry event");
      }
      await deps.ledger.updatePayment(piId, { status: "failed" });
      const contract = await deps.ledger.getContract(payment.contract_id);
      if (contract && contract.payment_status === "authorized") await deps.ledger.setPaymentStatus(payment.contract_id, "unfunded");
      return finish("hold released", payment.contract_id);
    }
    case "charge.refunded": {
      const piId = str(obj.payment_intent);
      let refunded = typeof obj.amount_refunded === "number" ? obj.amount_refunded : 0;
      const currency = (str(obj.currency) ?? "usd").toUpperCase();
      if (!piId) return finish("ignored: no payment intent");
      const payment = await deps.ledger.findPaymentByRef(piId);
      if (!payment) {
        if (!contractIdHint) return finish("ignored: unrelated payment");
        throw new FundingError(409, "Payment ledger is not ready; retry event");
      }
      const current = await deps.stripe.retrievePaymentIntent(piId);
      refunded = current.refunded;
      await deps.ledger.recordPayment({ contractId: payment.contract_id, providerRef: `${piId}:refund-total`, kind: "refund", amountCents: refunded, currency, status: "refunded" });
      if (refunded === current.amount) await deps.ledger.setPaymentStatus(payment.contract_id, "refunded");
      return finish("refunded", payment.contract_id);
    }
    default:
      return finish(`ignored: ${event.type}`);
  }
}

async function releaseFundsCore(
  deps: FundingDeps,
  input: { contractId: string; callerProfileId: string; action: "capture" | "cancel" },
): Promise<{ paymentStatus: PaymentStatus; quote?: Quote }> {
  const contract = await requireOrgSide(deps.ledger, input.contractId, input.callerProfileId);
  if (!["authorized", "captured"].includes(contract.payment_status)) throw new FundingError(409, `contract is ${contract.payment_status}, not funded`);
  const paymentIntentId = await deps.ledger.authorizedPaymentRef(contract.id);
  if (!paymentIntentId) throw new FundingError(409, "no authorized payment on record");

  if (input.action === "cancel") {
    if (contract.payment_status !== "authorized") throw new FundingError(409, "Captured payments cannot be canceled");
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
  const snapshot = await deps.stripe.retrievePaymentIntent(paymentIntentId);
  if (snapshot.contractId !== contract.id || snapshot.amount !== quote.totalCents || snapshot.currency !== quote.currency || snapshot.refunded || snapshot.disputed) throw new FundingError(409, 'Payment requires review');
  if (snapshot.status === 'requires_capture' && snapshot.captureBefore !== null && snapshot.captureBefore * 1000 <= Date.now()) throw new FundingError(409, 'Card authorization expired; no capture attempted');
  const captured = snapshot.status === 'succeeded' ? snapshot : await deps.stripe.capturePaymentIntent(paymentIntentId);
  if (captured.status !== "succeeded" || captured.amountReceived !== quote.totalCents) throw new FundingError(502, `capture returned ${captured.status}`);
  await deps.ledger.updatePayment(paymentIntentId, { status: "captured" });
  await deps.ledger.setPaymentStatus(contract.id, "captured");
  await ensurePayout(deps, contract, paymentIntentId);
  return { paymentStatus: "captured", quote };
}

async function ensurePayout(deps: FundingDeps, contract: Awaited<ReturnType<Ledger['getContract']>> & {}, paymentIntentId: string) {
  const quote = quoteContract(contract.amount_cents ?? 0, contract.platform_fee_bps, contract.currency);
  const operator = await deps.ledger.operatorProfileForAgent(contract.agent_id);
  await deps.ledger.recordPayout({ contractId: contract.id, agentId: contract.agent_id, operatorProfileId: operator,
    grossCents: quote.amountCents, feeCents: quote.platformFeeCents, currency: quote.currency, paymentIntentId });
}

async function fundingOperation<T>(deps: FundingDeps, input: {contractId: string; callerProfileId: string; agentKeyId?:string; selectedPaymentMethod?:string}, kind: string, run: () => Promise<T>): Promise<T> {
  const contract = await requireOrgSide(deps.ledger, input.contractId, input.callerProfileId);
  let quote: Quote;
  try { quote = quoteContract(contract.amount_cents ?? 0, contract.platform_fee_bps, contract.currency); }
  catch { throw new FundingError(409, 'Contract has no valid agreed price'); }
  if (quote.currency !== 'USD') throw new FundingError(409, 'Payment launch supports USD contracts only');
  return runMoneyOperation(deps.operations, { key: `fund:${contract.id}`, kind, profileId: input.callerProfileId,
    contractId: contract.id, amountCents: quote.totalCents, request: {contractId: contract.id, quote, ...(input.agentKeyId ? {agentKeyId:input.agentKeyId,selectedPaymentMethod:input.selectedPaymentMethod} : {})} }, run);
}
export async function createFunding(deps: FundingDeps, input: {contractId: string; callerProfileId: string; customerEmail?: string}) {
  return fundingOperation(deps, input, 'fund_human', () => createFundingCore(deps, input));
}
export async function fundWithSavedCard(deps: FundingDeps, input: {contractId: string; callerProfileId: string; agentKeyId?:string; selectedPaymentMethod?:string}) {
  if(input.agentKeyId) {
    if(!deps.ledger.getAgentCard) throw new FundingError(503,'Agent card storage unavailable');
    const card=await deps.ledger.getAgentCard(input.callerProfileId,input.agentKeyId);
    const account=await deps.ledger.getBillingAccount(input.callerProfileId);
    let selected:string;
    try {selected=selectAgentPaymentMethod(account?.default_payment_method_id ?? null,card);} catch(e) {throw new FundingError(409,(e as Error).message);}
    if(input.selectedPaymentMethod && input.selectedPaymentMethod!==selected) throw new FundingError(409,'Card changed during funding; operator reconciliation required');
    input={...input,selectedPaymentMethod:selected};
  }
  const result = await fundingOperation(deps, input, 'fund_agent', () => fundWithSavedCardCore(deps, input));
  const current = await requireOrgSide(deps.ledger,input.contractId,input.callerProfileId);
  if (!['authorized','captured'].includes(current.payment_status)) throw new FundingError(409, 'Previous funding is no longer active; operator reconciliation required');
  return {...result,paymentStatus:current.payment_status};
}
export async function releaseFunds(deps: FundingDeps, input: {contractId: string; callerProfileId: string; action: 'capture' | 'cancel'}) {
  const contract = await requireOrgSide(deps.ledger, input.contractId, input.callerProfileId);
  if (!['authorized','captured'].includes(contract.payment_status)) throw new FundingError(409, 'Contract is not funded');
  if (input.action === 'capture') {
    const summary = await deps.ledger.deliverableSummary(contract.id);
    if (summary.total === 0 || summary.approved !== summary.total) throw new FundingError(409, 'Release requires every deliverable approved');
  }
  return runMoneyOperation(deps.operations, {key: `release:${input.contractId}`, kind: input.action,
    profileId: input.callerProfileId, contractId: input.contractId, request: input}, () => releaseFundsCore(deps, input));
}
export async function handleStripeEvent(deps: FundingDeps, event: StripeLikeEvent) {
  return runMoneyOperation(deps.operations, {key: `event:${event.id}`, kind: 'webhook', request: {event}}, () => handleStripeEventCore(deps, event));
}

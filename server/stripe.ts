// The slice of Stripe this product uses, behind an interface so the funding
// logic is testable without the network. `realStripe` is the only place the
// SDK is touched.
import { createHash } from "node:crypto";
import Stripe from "stripe";

export interface CheckoutSessionInput {
  idempotencyKey: string;
  contractId: string;
  title: string;
  currency: string;
  amountCents: number;
  buyerFeeCents: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export interface OffSessionChargeInput {
  idempotencyKey: string;
  contractId: string;
  customerId: string;
  paymentMethodId: string;
  currency: string;
  amountCents: number;
  description: string;
}

export interface StripeGateway {
  createCheckoutSession(input: CheckoutSessionInput): Promise<{ id: string; url: string | null }>;
  /** A Customer for an operator; called once, id stored on billing_accounts. */
  createCustomer(input: { email?: string; profileId: string }): Promise<{ id: string }>;
  /** Stripe-hosted page where a human saves a card to the Customer (mode=setup). */
  createSetupSession(input: { customerId: string; profileId: string; successUrl: string; cancelUrl: string }): Promise<{ id: string; url: string | null }>;
  /** The payment method a completed SetupIntent attached. */
  retrieveSetupIntentPaymentMethod(setupIntentId: string): Promise<string | null>;
  /** Details of a saved payment method, for display. */
  retrievePaymentMethod(paymentMethodId: string): Promise<{ id: string; brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null }>;
  /** A manual-capture hold on a saved card with no human present. */
  createOffSessionHold(input: OffSessionChargeInput): Promise<{ id: string; status: string }>;
  capturePaymentIntent(paymentIntentId: string): Promise<{ id: string; status: string; amountReceived: number }>;
  cancelPaymentIntent(paymentIntentId: string): Promise<{ id: string; status: string }>;
  refundPaymentIntent(paymentIntentId: string): Promise<{ id: string; status: string | null }>;
  retrievePaymentIntent(id: string): Promise<PaymentSnapshot>;
  constructEvent(rawBody: string, signature: string, webhookSecret: string): Stripe.Event;
}

export interface PaymentSnapshot {
  id: string; status: string; amount: number; amountReceived: number; currency: string;
  contractId: string | null; chargeId: string | null; captureBefore: number | null;
  refunded: number; disputed: boolean;
}

function integrationId(seed: string) {
  const suffix = Array.from(createHash('sha256').update(seed).digest().subarray(0,8), b => String.fromCharCode(97+b%26)).join('');
  return `agentexchange_${suffix}`;
}
export function realStripe(secretKey: string): StripeGateway {
  const stripe = new Stripe(secretKey, { apiVersion: "2026-08-26.dahlia", typescript: true, timeout: 5000, maxNetworkRetries: 1 });
  return {
    async createCheckoutSession(input) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        integration_identifier: integrationId(input.contractId),
        client_reference_id: input.contractId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.amountCents,
              product_data: { name: input.title, description: "Agreed contract price. Held until you approve the work." },
            },
          },
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.buyerFeeCents,
              product_data: { name: "Service fee (3%)" },
            },
          },
        ],
        // A hold, not a charge: captured when the organization approves the work.
        payment_intent_data: { capture_method: "manual", metadata: { contractId: input.contractId } },
        metadata: { contractId: input.contractId },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      }, { idempotencyKey: input.idempotencyKey });
      return { id: session.id, url: session.url };
    },
    async createCustomer(input) {
      const c = await stripe.customers.create({ metadata: { profileId: input.profileId } }, { idempotencyKey: `customer:${input.profileId}` });
      return { id: c.id };
    },
    async createSetupSession(input) {
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        currency: "usd",
        integration_identifier: integrationId(input.profileId),
        customer: input.customerId,
        metadata: { profileId: input.profileId, purpose: "agent_card" },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      });
      return { id: session.id, url: session.url };
    },
    async retrieveSetupIntentPaymentMethod(setupIntentId) {
      const si = await stripe.setupIntents.retrieve(setupIntentId);
      return typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id ?? null;
    },
    async retrievePaymentMethod(paymentMethodId) {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      return { id: pm.id, brand: pm.card?.brand ?? null, last4: pm.card?.last4 ?? null, expMonth: pm.card?.exp_month ?? null, expYear: pm.card?.exp_year ?? null };
    },
    async createOffSessionHold(input) {
      const pi = await stripe.paymentIntents.create({
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        customer: input.customerId,
        payment_method: input.paymentMethodId,
        off_session: true,
        confirm: true,
        capture_method: "manual",
        description: input.description,
        metadata: { contractId: input.contractId, authorizedBy: "agent" },
      }, { idempotencyKey: input.idempotencyKey });
      return { id: pi.id, status: pi.status };
    },
    async capturePaymentIntent(id) {
      const pi = await stripe.paymentIntents.capture(id, {}, { idempotencyKey: `capture:${id}` });
      return { id: pi.id, status: pi.status, amountReceived: pi.amount_received };
    },
    async cancelPaymentIntent(id) {
      const pi = await stripe.paymentIntents.cancel(id, {}, { idempotencyKey: `cancel:${id}` });
      return { id: pi.id, status: pi.status };
    },
    async refundPaymentIntent(id) {
      const refund = await stripe.refunds.create({ payment_intent: id });
      return { id: refund.id, status: refund.status };
    },
    async retrievePaymentIntent(id) {
      const pi = await stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] });
      const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
      return { id: pi.id, status: pi.status, amount: pi.amount, amountReceived: pi.amount_received,
        currency: pi.currency.toUpperCase(), contractId: pi.metadata.contractId ?? null,
        chargeId: charge?.id ?? null, captureBefore: charge?.payment_method_details?.card?.capture_before ?? null,
        refunded: charge?.amount_refunded ?? 0, disputed: charge?.disputed ?? false };
    },
    constructEvent(rawBody, signature, webhookSecret) {
      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    },
  };
}

/** Test helper: a signed header for a payload, using the SDK's own signer. */
export function signTestEvent(payload: string, secret: string): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret });
}

// The slice of Stripe this product uses, behind an interface so the funding
// logic is testable without the network. `realStripe` is the only place the
// SDK is touched.
import Stripe from "stripe";

export interface CheckoutSessionInput {
  contractId: string;
  title: string;
  currency: string;
  amountCents: number;
  buyerFeeCents: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export interface StripeGateway {
  createCheckoutSession(input: CheckoutSessionInput): Promise<{ id: string; url: string | null }>;
  capturePaymentIntent(paymentIntentId: string): Promise<{ id: string; status: string; amountReceived: number }>;
  cancelPaymentIntent(paymentIntentId: string): Promise<{ id: string; status: string }>;
  refundPaymentIntent(paymentIntentId: string): Promise<{ id: string; status: string | null }>;
  constructEvent(rawBody: string, signature: string, webhookSecret: string): Stripe.Event;
}

export function realStripe(secretKey: string): StripeGateway {
  const stripe = new Stripe(secretKey, { apiVersion: "2025-02-24.acacia", typescript: true });
  return {
    async createCheckoutSession(input) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        client_reference_id: input.contractId,
        customer_email: input.customerEmail,
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
      });
      return { id: session.id, url: session.url };
    },
    async capturePaymentIntent(id) {
      const pi = await stripe.paymentIntents.capture(id);
      return { id: pi.id, status: pi.status, amountReceived: pi.amount_received };
    },
    async cancelPaymentIntent(id) {
      const pi = await stripe.paymentIntents.cancel(id);
      return { id: pi.id, status: pi.status };
    },
    async refundPaymentIntent(id) {
      const refund = await stripe.refunds.create({ payment_intent: id });
      return { id: refund.id, status: refund.status };
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

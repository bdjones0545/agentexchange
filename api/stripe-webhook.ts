import { operationStore } from "../server/moneyOperations.js";
// POST /api/stripe-webhook — Stripe's word on what happened to the money. The
// signature is verified over the raw body; each event id is claimed once in
// stripe_events before anything changes, so redeliveries are no-ops.
import { readServerEnv } from "../server/config.js";
import { dispatch } from "../server/dispatch.js";
import { handleStripeEvent } from "../server/funding.js";
import { supabaseLedger } from "../server/ledger.js";
import { realStripe } from "../server/stripe.js";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const env = readServerEnv();
  if (!env || !env.paymentsEnabled) return Response.json({ ok: false, error: "Payments are not enabled" }, { status: 503, headers: NO_STORE });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ ok: false, error: "missing signature" }, { status: 400, headers: NO_STORE });
  const raw = await request.text();
  const stripe = realStripe(process.env.STRIPE_SECRET_KEY!);
  let event;
  try {
    event = stripe.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e) {
    return Response.json({ ok: false, error: "invalid signature" }, { status: 400, headers: NO_STORE });
  }
  try {
    const result = await handleStripeEvent(
      {
        ledger: supabaseLedger(), operations: operationStore(),
        stripe,
        appUrl: env.appUrl,
        notify: (e) => dispatch(env, e),
      },
      event as unknown as { id: string; type: string; data: { object: Record<string, unknown> } },
    );
    return Response.json({ ok: true, ...result }, { headers: NO_STORE });
  } catch (e) {
    // A 5xx makes Stripe retry, which is what we want for a transient ledger failure.
    console.error("webhook failed", event.id, event.type, e instanceof Error ? e.name : "unknown");
    return Response.json({ ok: false, error: "webhook handling failed" }, { status: 500, headers: NO_STORE });
  }
}

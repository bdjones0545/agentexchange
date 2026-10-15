// Which Stripe mode this deployment talks to, read from the secret key prefix.
// Rows written in test mode keep their test-mode ids after the switch to live
// keys; tagging them lets reconciliation skip objects the live account cannot see.
export type StripeMode = "test" | "live";

export function stripeMode(secretKey: string | undefined): StripeMode {
  return secretKey?.startsWith("sk_live_") || secretKey?.startsWith("rk_live_") ? "live" : "test";
}

export function currentStripeMode(): StripeMode {
  return stripeMode(process.env.STRIPE_SECRET_KEY);
}

// Browser side of funding. Everything here talks to the product's own API with
// the user's session; Stripe is never called from the browser and no key is
// bundled. Amounts are quoted by the server.
import { isSupabaseConfigured, supabase } from "./supabase";

export type PaymentsConfig = {
  enabled: boolean;
  platformFeeBps: number;
  buyerFeeBps: number;
  minContractCents: number;
};

export type FundingQuote = {
  amountCents: number;
  buyerFeeCents: number;
  totalCents: number;
  platformFeeCents: number;
  operatorNetCents: number;
  currency: string;
};

const DISABLED: PaymentsConfig = { enabled: false, platformFeeBps: 1500, buyerFeeBps: 300, minContractCents: 5000 };

export async function fetchPaymentsConfig(): Promise<PaymentsConfig> {
  if (!isSupabaseConfigured) return DISABLED;
  try {
    const res = await fetch("/api/payments-config", { headers: { accept: "application/json" } });
    if (!res.ok) return DISABLED;
    return { ...DISABLED, ...((await res.json()) as Partial<PaymentsConfig>) };
  } catch {
    return DISABLED;
  }
}

async function authed(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  if (!supabase) return { ok: false, status: 503, data: { error: "Supabase not configured" } };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, status: 401, data: { error: "Sign in first" } };
  const res = await fetch(path, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { ok: res.ok, status: res.status, data: json };
}

/** Start funding: returns the Stripe Checkout URL to send the organization to. */
export async function startFunding(contractId: string): Promise<{ url?: string; quote?: FundingQuote; error?: string }> {
  const r = await authed("/api/checkout", { contractId });
  if (!r.ok) return { error: String(r.data.error ?? `checkout failed (${r.status})`) };
  return { url: r.data.url as string, quote: r.data.quote as FundingQuote };
}

/** Release the held funds (capture) or cancel the hold. */
export async function releaseFunding(contractId: string, action: "capture" | "cancel"): Promise<{ paymentStatus?: string; error?: string }> {
  const r = await authed("/api/release", { contractId, action });
  if (!r.ok) return { error: String(r.data.error ?? `release failed (${r.status})`) };
  return { paymentStatus: r.data.paymentStatus as string };
}

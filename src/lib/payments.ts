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

/** The card hold as the contract parties can see it (payments rows are readable by both sides). */
export type HoldState = {
  /** Epoch seconds after which the issuer drops the authorization; null when unknown. */
  holdExpiresAt: number | null;
  /** Earlier holds that ended without a capture: cancelled, lapsed, or an abandoned Checkout. */
  endedAttempts: number;
};

export async function fetchHoldState(contractId: string): Promise<HoldState> {
  if (!isSupabaseConfigured || !supabase) return { holdExpiresAt: null, endedAttempts: 0 };
  const { data, error } = await supabase
    .from("payments")
    .select("status, metadata, created_at")
    .eq("contract_id", contractId)
    .eq("kind", "charge")
    .order("created_at", { ascending: false });
  if (error || !data) return { holdExpiresAt: null, endedAttempts: 0 };
  const live = data.find((row) => row.status === "authorized");
  const captureBefore = (live?.metadata as { captureBefore?: unknown } | null)?.captureBefore;
  return {
    holdExpiresAt: typeof captureBefore === "number" ? captureBefore : null,
    endedAttempts: data.filter((row) => row.status === "failed").length,
  };
}

const HOUR = 3600;

/**
 * What the contract page says about the hold window. Holds last about seven
 * days and are never renewed, so work has to be approved and released inside
 * that window; after it the hold lapses and the contract is funded again.
 */
export function holdNotice(
  status: string,
  state: HoldState,
  isOrganizationSide: boolean,
  nowSeconds: number,
): { tone: "info" | "warning"; text: string } | null {
  if (status === "authorized" && state.holdExpiresAt) {
    const left = state.holdExpiresAt - nowSeconds;
    const when = new Date(state.holdExpiresAt * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    if (left <= 0) {
      return { tone: "warning", text: "The card hold has expired. It will be released shortly, and the contract can then be funded again." };
    }
    if (left <= 48 * HOUR) {
      const hours = Math.max(1, Math.floor(left / HOUR));
      return {
        tone: "warning",
        text: isOrganizationSide
          ? `The card hold expires in about ${hours} hour${hours === 1 ? "" : "s"} (${when}). Approve the work and release payment before then, or the hold lapses and the contract needs funding again.`
          : `The card hold expires in about ${hours} hour${hours === 1 ? "" : "s"} (${when}). Deliver before then; after it the organization has to fund the contract again.`,
      };
    }
    return { tone: "info", text: `Card hold expires ${when}. Work must be approved and released before then.` };
  }
  if (status === "unfunded" && state.endedAttempts > 0) {
    return {
      tone: "info",
      text: isOrganizationSide
        ? "An earlier card hold ended without payment (cancelled, expired, or Checkout not completed). Funding again places a new hold."
        : "The earlier card hold ended without payment. Work pauses until the organization funds the contract again.",
    };
  }
  return null;
}

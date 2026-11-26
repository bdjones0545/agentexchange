import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PAYOUT_COUNTRIES, PAYOUT_REGIONS } from "../lib/payoutCountries";
import { supabase } from "../lib/supabase";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";

type SellerState = { enabled?: boolean; connected?: boolean; ready?: { transfers: boolean; payouts: boolean } | null };

const OTHER = "__other";

async function sellerCall(method: "GET" | "POST", body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  if (!supabase) return { ok: false, data: {} };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, data: {} };
  try {
    const res = await fetch("/api/seller", {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data: json };
  } catch {
    return { ok: false, data: { error: "Could not connect. Please retry." } };
  }
}

const steps = [
  "Pick the country where you or your business is legally based, then finish Stripe's verification on its secure pages. A real person (for a company, a company representative) completes it; Stripe may ask for an ID document.",
  "When a buyer releases payment, or it's released automatically, your share is sent to your Stripe account: the agreed price minus the 15% platform fee (minimum $5). On a $200 contract you receive $170.",
  "Stripe then pays it into your bank on your Stripe payout schedule. AgentExchange has no minimum and doesn't hold earnings back.",
];

/** An operator's payout account: where we can pay, how, and its Stripe status. */
export function ReceiveEarnings() {
  const [seller, setSeller] = useState<SellerState | null>(null);
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flag = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("seller") : null;

  useEffect(() => {
    void sellerCall("GET").then((r) => { if (r.ok) setSeller(r.data as SellerState); });
  }, []);

  if (!seller?.enabled) return null;

  const ready = Boolean(seller.ready?.transfers && seller.ready?.payouts);
  const connected = Boolean(seller.connected);
  const status = ready ? "Ready" : connected ? "Setup incomplete" : "Not set up";

  async function start() {
    setBusy(true);
    setError(null);
    const r = await sellerCall("POST", connected ? {} : { country });
    if (r.ok && typeof r.data.url === "string") {
      window.location.assign(r.data.url);
      return;
    }
    setError(String(r.data.error ?? "Payout setup could not start. Please try again."));
    setBusy(false);
  }

  return (
    <GlassCard className="space-y-6 p-6 sm:p-8" data-testid="receive-earnings">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Get paid</p>
          <h2 className="mt-2 font-ae-display text-2xl font-semibold tracking-tight text-ae-text">Receive earnings</h2>
        </div>
        <span className={`rounded-full border px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] ${ready ? "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald" : "border-ae-amber/25 bg-ae-amber/10 text-ae-amber"}`}>{status}</span>
      </div>

      {flag === "refresh" && !ready ? <p role="status" className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ae-text-muted">That Stripe link expired, which is normal after a while. Choose Continue payout setup to pick up where you left off.</p> : null}
      {flag === "return" && !ready ? <p role="status" className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ae-text-muted">Back from Stripe. If anything is still missing, Stripe shows it when you choose Continue payout setup. Status updates within a few minutes of finishing.</p> : null}

      <ol className="grid gap-3 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm leading-6 text-ae-text-muted">
            <span className="mb-2 grid size-7 place-items-center rounded-full border border-ae-primary/30 bg-ae-primary/10 font-ae-label text-xs font-bold text-ae-primary">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      {ready ? (
        <p className="text-sm leading-6 text-ae-text-muted">Your payout account is ready. Each released contract appears in your <Link className="font-semibold text-ae-text underline decoration-ae-primary/50 underline-offset-4 hover:text-ae-primary" to="/wallet">payout history</Link>.</p>
      ) : connected ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-ae-text-muted">Stripe still needs a few details before it can pay you. Until then, released earnings wait for you.</p>
          <PrimaryButton className="shrink-0" disabled={busy} onClick={() => void start()}>{busy ? "Opening Stripe…" : "Continue payout setup"}</PrimaryButton>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1 space-y-2">
              <span className="ax-label">Country where you or your business is legally based</span>
              <select aria-label="Payout country" className="ax-input" value={country} onChange={(e) => { setCountry(e.target.value); setError(null); }}>
                <option value="">Choose a country</option>
                {PAYOUT_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                <option value={OTHER}>My country isn't listed</option>
              </select>
            </label>
            <PrimaryButton className="shrink-0" disabled={busy || !country || country === OTHER} onClick={() => void start()}>{busy ? "Opening Stripe…" : "Set up payouts"}</PrimaryButton>
          </div>
          {country === OTHER ? (
            <p role="note" className="rounded-xl border border-ae-amber/25 bg-ae-amber/10 px-4 py-3 text-sm leading-6 text-ae-amber">
              AgentExchange can't pay operators based outside the listed countries yet. Payouts go only through Stripe Connect, which can pay operators based in {PAYOUT_REGIONS}. There's no other payout method, so please don't take paid work here until your country is supported. A US bank account doesn't change this: Stripe goes by where you or your business is legally based.
            </p>
          ) : (
            <p className="text-xs leading-5 text-ae-text-muted">We can pay operators based in {PAYOUT_REGIONS}. Stripe Connect is the only payout method: no crypto, PayPal or instant payouts, and an existing Stripe account can't be connected.</p>
          )}
        </div>
      )}

      <p className="text-xs leading-5 text-ae-text-muted">Payouts are in early access: a released contract is sent to your Stripe account, but we can't promise a bank date. Your legal name stays with Stripe; buyers only see your agent and organization names.</p>
      {error ? <p role="alert" className="rounded-xl border border-ae-error/25 bg-ae-error/10 px-4 py-3 text-sm leading-6 text-ae-error">{error}</p> : null}
    </GlassCard>
  );
}

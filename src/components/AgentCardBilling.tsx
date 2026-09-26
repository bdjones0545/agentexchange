import { useEffect, useState } from "react";

import { formatCents } from "../lib/money";
import { supabase } from "../lib/supabase";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

type Billing = {
  enabled: boolean;
  card: { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null } | null;
  agentDailyCapCents: number;
  agentPerContractCapCents: number;
};

async function call(method: "GET" | "POST", body?: unknown, path = "/api/billing") {
  if (!supabase) return { ok: false, data: {} as Record<string, unknown> };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, data: {} as Record<string, unknown> };
  try {
  const res = await fetch(path, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { ok: res.ok, data: json };
  } catch { return {ok:false,data:{error:"Could not connect. Please retry."} as Record<string,unknown>}; }
}

/**
 * The operator's saved card for agent-funded contracts, and the rolling
 * 24-hour cap on what agents holding this account's keys may authorize.
 */
export function AgentCardBilling() {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [perJob, setPerJob] = useState("");
  const [seller, setSeller] = useState<{connected?:boolean;ready?:{transfers:boolean;payouts:boolean}} | null>(null);
  const [sellerCountry, setSellerCountry] = useState("");
  const [cap, setCap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flag = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("card") : null;

  async function load() {
    const r = await call("GET");
    if (r.ok) {
      const b = r.data as unknown as Billing;
      setBilling(b);
      setCap(String(b.agentDailyCapCents / 100));
      setPerJob(String(b.agentPerContractCapCents / 100));
    }
  }
  useEffect(() => {
    void load();
    void call("GET",undefined,"/api/seller").then(r=>{if(r.ok)setSeller(r.data);});
  }, []);

  if (!billing?.enabled) return null;

  async function addCard() {
    setBusy(true);
    setError(null);
    const r = await call("POST", { action: "setup" });
    if (r.ok && typeof r.data.url === "string") {
      window.location.assign(r.data.url);
      return;
    }
    setError(String(r.data.error ?? "Could not start card setup."));
    setBusy(false);
  }

  async function saveCap() {
    const cents = Math.round(Number(cap) * 100);
    const perJobCents = Math.round(Number(perJob) * 100);
    if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isSafeInteger(perJobCents) || perJobCents < 0 || !cap.trim() || !perJob.trim()) {
      setError("Enter a dollar amount.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await call("POST", { action: "cap", agentDailyCapCents: cents, agentPerContractCapCents: perJobCents });
    setBusy(false);
    if (!r.ok) setError(String(r.data.error ?? "Could not save the cap."));
    void load();
  }

  async function setupSeller() {
    setBusy(true); setError(null);
    try {
      const r=await call('POST',{country:sellerCountry},'/api/seller');
      if(r.ok && typeof r.data.url==='string') {window.location.assign(r.data.url);return;}
      setError(String(r.data.error ?? 'Could not start seller setup'));
    } catch {setError('Could not connect. Please retry.');}
    setBusy(false);
  }
  return (
    <GlassCard className="space-y-5">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Agent card</p>
        <h2 className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">Let your agents fund contracts</h2>
        <p className="mt-2 text-sm leading-6 text-ae-text-muted">
          Save a card once. Agents holding your API keys can then fund contracts with it — a hold for the agreed price plus the 3% service fee, released when the work is approved — without you at the keyboard, within both limits below. Only keys you explicitly enable for payments can spend. A zero limit disables agent spending.
        </p>
      </div>

      {flag === "saved" ? <p className="text-sm text-ae-emerald">Card saved. It appears below once Stripe confirms (a few seconds).</p> : null}
      {flag === "cancelled" ? <p className="text-sm text-ae-text-muted">Card setup was cancelled. Nothing changed.</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-text-muted">Saved card</p>
          <p className="mt-2 text-ae-text">
            {billing.card ? `${(billing.card.brand ?? "card").toUpperCase()} •••• ${billing.card.last4 ?? "????"} · ${billing.card.expMonth ?? "??"}/${billing.card.expYear ?? "????"}` : "None"}
          </p>
          <div className="mt-3">
            <PrimaryButton disabled={busy} onClick={() => void addCard()}>
              {billing.card ? "Replace card" : "Add a card"}
            </PrimaryButton>
          </div>
        </div>
        <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-text-muted">Agent daily cap (USD, rolling 24h)</p>
          <div className="mt-2 flex gap-2">
            <input aria-label="Agent daily cap" className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow" inputMode="decimal" onChange={(event) => setCap(event.target.value)} value={cap} />
          </div>
          <p className="mt-2 text-xs leading-5 text-ae-text-muted">Currently {formatCents(billing.agentDailyCapCents)}. Set 0 to stop agents funding anything.</p>
        </div>
      </div>
      <label className="block text-sm text-ae-text-muted">
        Per-contract agent limit (USD, including service fee)
        <input aria-label="Per-contract agent limit" className="mt-2 w-full rounded-ae-md bg-ae-background-deep px-4 py-3 text-ae-text" inputMode="decimal" value={perJob} onChange={e=>setPerJob(e.target.value)} />
      </label>
      <SecondaryButton disabled={busy} onClick={() => void saveCap()}>Save spending limits</SecondaryButton>
      <div className="space-y-3 border-t border-white/10 pt-5">
        <h2 className="text-xl text-ae-text">Receive earnings</h2>
        <p className="text-sm text-ae-text-muted">{seller?.ready?.transfers && seller?.ready?.payouts ? 'Your payout account is ready.' : 'Connect your payout account and complete verification with Stripe. Earnings transfer after work is approved; bank settlement follows your Stripe payout schedule.'}</p>
        <label className="block text-sm text-ae-text-muted">Country where you or your business is legally based
          <input aria-label="Seller country code" placeholder="Two-letter code, e.g. US" maxLength={2} value={sellerCountry} onChange={e=>setSellerCountry(e.target.value.toUpperCase())} className="mt-2 w-full rounded-ae-md bg-ae-background-deep px-4 py-3 text-ae-text" />
        </label>
        <SecondaryButton disabled={busy || !/^[A-Z]{2}$/.test(sellerCountry)} onClick={()=>void setupSeller()}>{seller?.connected ? 'Continue payout setup' : 'Set up payouts'}</SecondaryButton>
      </div>
      {error ? <p className="text-sm text-ae-amber">{error}</p> : null}
    </GlassCard>
  );
}

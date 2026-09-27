import { MoneyOperationError, operationStore } from "../server/moneyOperations.js";
// The operator's card for agent-funded contracts.
//   GET  /api/billing            saved card (brand/last4) and the agent daily cap
//   POST /api/billing {action:"setup"}                     → Stripe-hosted page to save a card
//   POST /api/billing {action:"cap", agentDailyCapCents}   → change the agent daily cap
// A human saves the card once; the platform stores the payment method via the
// webhook. Agents holding the operator's keys can then fund contracts within
// the cap through the fund_contract tool.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bearerToken, callerProfile } from "../server/caller.js";
import { readServerEnv } from "../server/config.js";
import { createCardSetup, FundingError } from "../server/funding.js";
import { supabaseLedger } from "../server/ledger.js";
import { realStripe } from "../server/stripe.js";

const NO_STORE = { "cache-control": "no-store" };

type Auth =
  | { ok: false; response: Response }
  | { ok: true; env: NonNullable<ReturnType<typeof readServerEnv>>; caller: { profileId: string; email: string | null }; client: SupabaseClient };

async function auth(request: Request): Promise<Auth> {
  const env = readServerEnv();
  if (!env) return { ok: false, response: Response.json({ ok: false, error: "Supabase not configured" }, { status: 503, headers: NO_STORE }) };
  const token = bearerToken(request);
  if (!token) return { ok: false, response: Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } }) };
  const caller = await callerProfile(env, token);
  if (!caller) return { ok: false, response: Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE }) };
  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { ok: true, env, caller, client };
}

export async function GET(request: Request): Promise<Response> {
  const a = await auth(request);
  if (!a.ok) return a.response;
  const { data } = await a.client.from("billing_accounts").select("card_brand,card_last4,card_exp_month,card_exp_year,agent_daily_cap_cents,agent_per_contract_cap_cents,default_payment_method_id").eq("profile_id", a.caller.profileId).maybeSingle();
  return Response.json(
    {
      ok: true,
      enabled: a.env.paymentsEnabled,
      card: data?.default_payment_method_id ? { brand: data.card_brand, last4: data.card_last4, expMonth: data.card_exp_month, expYear: data.card_exp_year } : null,
      agentDailyCapCents: data?.agent_daily_cap_cents ?? 0,
      agentPerContractCapCents: data?.agent_per_contract_cap_cents ?? 0,
    },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request): Promise<Response> {
  const a = await auth(request);
  if (!a.ok) return a.response;
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; agentDailyCapCents?: unknown; agentPerContractCapCents?: unknown };
  if (body.action === "cap") {
    const cap = Number(body.agentDailyCapCents);
    const perJob = Number(body.agentPerContractCapCents);
    if (!Number.isInteger(perJob) || perJob < 0 || perJob > 10_000_000) return Response.json({ok:false,error:"Invalid per-contract cap"},{status:400,headers:NO_STORE});
    if (!Number.isInteger(cap) || cap < 0 || cap > 10_000_000) return Response.json({ ok: false, error: "agentDailyCapCents must be an integer between 0 and 10000000" }, { status: 400, headers: NO_STORE });
    // Ensure the row exists (service role), then the operator updates the cap under RLS.
    await supabaseLedger().upsertBillingAccount(a.caller.profileId, {});
    const { error } = await a.client.from("billing_accounts").update({ agent_daily_cap_cents: cap, agent_per_contract_cap_cents: perJob }).eq("profile_id", a.caller.profileId);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE });
    return Response.json({ ok: true, agentDailyCapCents: cap }, { headers: NO_STORE });
  }
  if (body.action !== "setup") return Response.json({ ok: false, error: "action must be setup or cap" }, { status: 400, headers: NO_STORE });
  if (!a.env.paymentsEnabled) return Response.json({ ok: false, error: "Payments are not enabled" }, { status: 503, headers: NO_STORE });
  try {
    const r = await createCardSetup(
      { ledger: supabaseLedger(), operations: operationStore(), stripe: realStripe(process.env.STRIPE_SECRET_KEY!), appUrl: a.env.appUrl },
      { profileId: a.caller.profileId, email: a.caller.email ?? undefined },
    );
    return Response.json({ ok: true, url: r.url }, { headers: NO_STORE });
  } catch (e) {
    if ((e instanceof FundingError || e instanceof MoneyOperationError)) return Response.json({ ok: false, error: e.message }, { status: e.status, headers: NO_STORE });
    console.error("billing setup failed", e instanceof Error ? e.name : "unknown");
    return Response.json({ ok: false, error: "billing setup failed" }, { status: 500, headers: NO_STORE });
  }
}

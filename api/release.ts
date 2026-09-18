// POST /api/release {contractId, action: "capture" | "cancel"} — the organization
// releases the held funds after approving every deliverable, or cancels the hold.
import { bearerToken, callerProfile } from "../server/caller.js";
import { readServerEnv } from "../server/config.js";
import { FundingError, releaseFunds } from "../server/funding.js";
import { supabaseLedger } from "../server/ledger.js";
import { realStripe } from "../server/stripe.js";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const env = readServerEnv();
  if (!env) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 503, headers: NO_STORE });
  if (!env.paymentsEnabled) return Response.json({ ok: false, error: "Payments are not enabled" }, { status: 503, headers: NO_STORE });
  const token = bearerToken(request);
  if (!token) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });
  const caller = await callerProfile(env, token);
  if (!caller) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  let body: { contractId?: unknown; action?: unknown };
  try {
    body = (await request.json()) as { contractId?: unknown; action?: unknown };
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  if (typeof body.contractId !== "string" || (body.action !== "capture" && body.action !== "cancel")) {
    return Response.json({ ok: false, error: "contractId and action (capture|cancel) required" }, { status: 400, headers: NO_STORE });
  }
  try {
    const result = await releaseFunds(
      { ledger: supabaseLedger(), stripe: realStripe(process.env.STRIPE_SECRET_KEY!), appUrl: env.appUrl },
      { contractId: body.contractId, callerProfileId: caller.profileId, action: body.action },
    );
    return Response.json({ ok: true, ...result }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof FundingError) return Response.json({ ok: false, error: e.message }, { status: e.status, headers: NO_STORE });
    console.error("release failed", e);
    return Response.json({ ok: false, error: "release failed" }, { status: 500, headers: NO_STORE });
  }
}

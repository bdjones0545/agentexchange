// GET /api/owner-revenue?tz=America/New_York — AgentExchange's own revenue,
// read from its ledger (live rows only), for the platform owner.
//
// The gate is server-side: the caller's Supabase session must belong to an auth
// user id listed in PLATFORM_OWNER_USER_IDS. Everyone else, and everyone while
// that variable is unset, gets the same 404 as a missing route.
import { bearerToken, callerProfile } from "../server/caller.js";
import { readServerEnv } from "../server/config.js";
import { isPlatformOwner, loadLiveRevenue, safeTimeZone, summarizeRevenue } from "../server/revenue.js";
import { serviceClient, serviceRoleConfigured } from "../server/service.js";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const env = readServerEnv();
  if (!env) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 503, headers: NO_STORE });
  const token = bearerToken(request);
  if (!token) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });
  const caller = await callerProfile(env, token);
  if (!caller) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!isPlatformOwner(caller.userId)) return Response.json({ ok: false, error: "Not found" }, { status: 404, headers: NO_STORE });
  if (!serviceRoleConfigured()) return Response.json({ ok: false, error: "Ledger unavailable" }, { status: 503, headers: NO_STORE });
  const timeZone = safeTimeZone(new URL(request.url).searchParams.get("tz"));
  try {
    const ledger = await loadLiveRevenue(serviceClient());
    return Response.json({ ok: true, ...summarizeRevenue(ledger, { now: new Date(), timeZone }) }, { headers: NO_STORE });
  } catch {
    // Never log ledger rows or database errors: counts and outcome only.
    console.error(JSON.stringify({ event: "owner_revenue", ok: false, reason: "ledger_read_failed" }));
    return Response.json({ ok: false, error: "Could not read the ledger" }, { status: 500, headers: NO_STORE });
  }
}

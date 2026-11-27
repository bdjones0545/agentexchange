// POST /api/dispatch — a signed-in browser tells the product that something
// happened on a hire request or contract; the product forwards it to every
// worker the database says is a party. The caller must present its own
// Supabase access token and must itself be able to see the entity.
import { callerProfile } from "../server/caller.js";
import { readServerEnv } from "../server/config.js";
import { callerCanSee, DispatchEventSchema, loggedDispatch } from "../server/dispatch.js";
import { deliverSoon } from "../server/agentWebhooks.js";
import { serviceClient } from "../server/service.js";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  let env;
  try {
    env = readServerEnv();
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "bad configuration" }, { status: 503, headers: NO_STORE });
  }
  if (!env) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 503, headers: NO_STORE });
  if (env.workers.length === 0) return Response.json({ ok: true, results: [] }, { headers: NO_STORE });

  const auth = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });
  const accessToken = m[1].trim();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  const parsed = DispatchEventSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "invalid event" }, { status: 400, headers: NO_STORE });

  if (!(await callerCanSee(env, accessToken, parsed.data))) {
    // Only a refusal pays for the extra Auth check: an expired or forged
    // sign-in is a 401 the browser can act on, not "not visible".
    if (!(await callerProfile(env, accessToken))) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });
    }
    return Response.json({ ok: false, error: "not visible to caller" }, { status: 403, headers: NO_STORE });
  }
  const results = await loggedDispatch(env, "browser")(parsed.data);
  // The browser calls this right after its own write; push that write's webhook events too.
  await deliverSoon(serviceClient);
  return Response.json({ ok: true, results }, { headers: NO_STORE });
}

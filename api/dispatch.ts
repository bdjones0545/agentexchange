// POST /api/dispatch — a signed-in browser tells the product that something
// happened on a hire request or contract; the product forwards it to every
// worker the database says is a party. The caller must present its own
// Supabase access token and must itself be able to see the entity.
import { readServerEnv } from "../server/config.js";
import { callerCanSee, dispatch, DispatchEventSchema } from "../server/dispatch.js";

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
    return Response.json({ ok: false, error: "not visible to caller" }, { status: 403, headers: NO_STORE });
  }
  const results = await dispatch(env, parsed.data);
  return Response.json({ ok: true, results }, { headers: NO_STORE });
}

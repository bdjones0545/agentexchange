// POST /api/notifications — a signed-in browser reports that it just submitted
// a deliverable; the product emails the organization's owner. The caller must
// present its own Supabase access token and be able to see the deliverable.
// The email itself is decided from stored state (server/notifications.ts): a
// draft, an unknown id or an already-sent submission sends nothing.
import { z } from "zod";
import { readServerEnv } from "../server/config.js";
import { callerCanSeeDeliverable, notifyDeliverableSubmitted } from "../server/notifications.js";

const NO_STORE = { "cache-control": "no-store" };

const NoticeSchema = z.object({ event: z.literal("deliverable_submitted"), deliverableId: z.uuid() });

export async function POST(request: Request): Promise<Response> {
  let env;
  try {
    env = readServerEnv();
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "bad configuration" }, { status: 503, headers: NO_STORE });
  }
  if (!env) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 503, headers: NO_STORE });

  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!m) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  const parsed = NoticeSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "invalid event" }, { status: 400, headers: NO_STORE });

  if (!(await callerCanSeeDeliverable(env, m[1].trim(), parsed.data.deliverableId))) {
    return Response.json({ ok: false, error: "not visible to caller" }, { status: 403, headers: NO_STORE });
  }
  const notice = await notifyDeliverableSubmitted(parsed.data.deliverableId, "browser");
  return Response.json({ ok: true, status: notice.status }, { headers: NO_STORE });
}

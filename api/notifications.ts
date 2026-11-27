// POST /api/notifications — a signed-in browser reports that it just submitted
// a deliverable, or that the seller just accepted a hire request; the product
// emails the organization's owner. The caller must present its own Supabase
// access token and be able to see the record it names. The email itself is
// decided from stored state (server/notifications.ts): a draft, a contract the
// buyer accepted themselves, an unknown id or an already-sent email sends
// nothing.
import { z } from "zod";
import { bearerToken, callerProfile } from "../server/caller.js";
import { readServerEnv } from "../server/config.js";
import { callerCanSeeContract, callerCanSeeDeliverable, notifyContractAccepted, notifyDeliverableSubmitted } from "../server/notifications.js";

const NO_STORE = { "cache-control": "no-store" };

const NoticeSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("deliverable_submitted"), deliverableId: z.uuid() }),
  z.object({ event: z.literal("contract_accepted"), contractId: z.uuid() }),
]);

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });

export async function POST(request: Request): Promise<Response> {
  let env;
  try {
    env = readServerEnv();
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "bad configuration" }, { status: 503, headers: NO_STORE });
  }
  if (!env) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 503, headers: NO_STORE });

  const accessToken = bearerToken(request);
  if (!accessToken) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  const parsed = NoticeSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "invalid event" }, { status: 400, headers: NO_STORE });

  const notice = parsed.data;
  const visible =
    notice.event === "deliverable_submitted"
      ? await callerCanSeeDeliverable(env, accessToken, notice.deliverableId)
      : await callerCanSeeContract(env, accessToken, notice.contractId);
  if (!visible) {
    // Only a refusal pays for the extra Auth check: an expired or forged
    // sign-in is a 401 the browser can act on, not "not visible".
    if (!(await callerProfile(env, accessToken))) return unauthorized();
    return Response.json({ ok: false, error: "not visible to caller" }, { status: 403, headers: NO_STORE });
  }
  const result =
    notice.event === "deliverable_submitted"
      ? await notifyDeliverableSubmitted(notice.deliverableId, "browser")
      : await notifyContractAccepted(notice.contractId, "browser");
  return Response.json({ ok: true, status: result.status }, { headers: NO_STORE });
}

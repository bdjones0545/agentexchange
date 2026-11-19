// Webhooks on the signed-in owner's agent keys.
//   GET    /api/agent-webhooks                        every webhook on the caller's keys (never the secret)
//   PUT    /api/agent-webhooks {keyId, url, events?}  set or replace; returns the signing secret ONCE
//   DELETE /api/agent-webhooks {keyId}                remove
//   POST   /api/agent-webhooks {keyId, action:"test"} send a signed webhook.test event now
// The tables are service-only; every call is scoped to the caller's own profile and keys.
import { bearerToken, callerProfile } from "../server/caller.js";
import { readServerEnv } from "../server/config.js";
import { removeWebhook, sendTestEvent, setWebhook, WebhookUrlError, webhookStatus, WEBHOOK_STATUS_COLUMNS } from "../server/agentWebhooks.js";
import { serviceClient } from "../server/service.js";

const NO_STORE = { "cache-control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

async function caller(request: Request) {
  const env = readServerEnv();
  const token = bearerToken(request);
  if (!env || !token) return null;
  return callerProfile(env, token);
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function failure(e: unknown) {
  if (e instanceof WebhookUrlError) return json({ ok: false, error: e.message }, 400);
  console.error(JSON.stringify({ event: "agent_webhooks", ok: false, reason: e instanceof Error ? e.name : "unknown" }));
  return json({ ok: false, error: "Webhook request failed" }, 500);
}

export async function GET(request: Request): Promise<Response> {
  const who = await caller(request);
  if (!who) return json({ ok: false, error: "Unauthorized" }, 401);
  const { data, error } = await serviceClient().from("agent_webhooks").select(WEBHOOK_STATUS_COLUMNS).eq("profile_id", who.profileId);
  if (error) return failure(error);
  return json({ ok: true, webhooks: ((data ?? []) as Record<string, unknown>[]).map(webhookStatus) });
}

export async function PUT(request: Request): Promise<Response> {
  const who = await caller(request);
  if (!who) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await readBody(request);
  if (!body || typeof body.keyId !== "string" || typeof body.url !== "string") return json({ ok: false, error: "keyId and url required" }, 400);
  try {
    return json({ ok: true, ...(await setWebhook(serviceClient(), who.profileId, body.keyId, body.url, body.events)) });
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const who = await caller(request);
  if (!who) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await readBody(request);
  if (!body || typeof body.keyId !== "string") return json({ ok: false, error: "keyId required" }, 400);
  try {
    await removeWebhook(serviceClient(), who.profileId, body.keyId);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request): Promise<Response> {
  const who = await caller(request);
  if (!who) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await readBody(request);
  if (!body || typeof body.keyId !== "string" || body.action !== "test") return json({ ok: false, error: "keyId and action \"test\" required" }, 400);
  try {
    const result = await sendTestEvent(serviceClient(), who.profileId, body.keyId);
    return json({ ok: true, delivered: result.ok, status: result.status });
  } catch (e) {
    return failure(e);
  }
}

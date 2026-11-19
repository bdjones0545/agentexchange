// GET /api/agent-events — the per-minute job (vercel.json cron) that delivers
// queued agent webhook events, retrying failures with backoff, and prunes
// events older than 30 days once an hour. Cron bearer only.
import { timingSafeEqual } from "node:crypto";
import { deliverDue, httpTransport, pruneOldEvents, supabaseDeliveryStore } from "../server/agentWebhooks.js";
import { serviceClient } from "../server/service.js";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(`Bearer ${expected}`) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(`Bearer ${expected}`))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const client = serviceClient();
    const started = Date.now();
    const report = await deliverDue(supabaseDeliveryStore(client), httpTransport(), Date.now, started + 25_000);
    if (new Date(started).getUTCMinutes() === 0) await pruneOldEvents(client, started);
    // Counts only: never URLs, secrets, ids or response bodies.
    console.info(JSON.stringify({ event: "agent_webhook_delivery", ok: true, ...report }));
    return Response.json({ ok: true, ...report }, { headers: NO_STORE });
  } catch {
    console.error(JSON.stringify({ event: "agent_webhook_delivery", ok: false, reason: "runner_failed" }));
    return Response.json({ ok: false, error: "Webhook delivery failed" }, { status: 500, headers: NO_STORE });
  }
}

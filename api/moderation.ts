// GET  /api/moderation                       listings waiting for review, and rejected ones
// POST /api/moderation {agentId, decision}   "approve" makes a listing public; "reject" keeps it private
// GET also returns open disputes and account deletion requests (server/supportQueue.ts)
// POST /api/moderation {deletionRequestId, status, response}   update a deletion request
//
// Platform owner only, by the same server-side gate as /api/owner-revenue: the
// caller's Supabase session must belong to an auth user id in
// PLATFORM_OWNER_USER_IDS. Everyone else gets the same 404 as a missing route.
// The status is written with the service role because the database lets no
// user session change it (guard_agent_moderation).
import { bearerToken, callerProfile } from "../server/caller.js";
import { readServerEnv } from "../server/config.js";
import { decideListing, loadModerationQueue, parseDecision } from "../server/moderation.js";
import { loadDeletionRequests, loadDisputes, parseDeletionUpdate, updateDeletionRequest } from "../server/supportQueue.js";
import { isPlatformOwner } from "../server/revenue.js";
import { serviceClient, serviceRoleConfigured } from "../server/service.js";

const NO_STORE = { "cache-control": "no-store" };

async function gate(request: Request): Promise<Response | null> {
  const env = readServerEnv();
  if (!env) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 503, headers: NO_STORE });
  const token = bearerToken(request);
  if (!token) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });
  const caller = await callerProfile(env, token);
  if (!caller) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!isPlatformOwner(caller.userId)) return Response.json({ ok: false, error: "Not found" }, { status: 404, headers: NO_STORE });
  if (!serviceRoleConfigured()) return Response.json({ ok: false, error: "Review unavailable" }, { status: 503, headers: NO_STORE });
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const refused = await gate(request);
  if (refused) return refused;
  try {
    const db = serviceClient();
    const [listings, disputes, deletionRequests] = await Promise.all([loadModerationQueue(db), loadDisputes(db), loadDeletionRequests(db)]);
    return Response.json({ ok: true, ...listings, disputes, deletionRequests }, { headers: NO_STORE });
  } catch {
    console.error(JSON.stringify({ event: "moderation_queue", ok: false }));
    return Response.json({ ok: false, error: "Could not read the review queue" }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: Request): Promise<Response> {
  const refused = await gate(request);
  if (refused) return refused;
  const body: unknown = await request.json().catch(() => null);
  if (body && typeof body === "object" && "deletionRequestId" in body) {
    const update = parseDeletionUpdate(body);
    if (!update) return Response.json({ ok: false, error: "A request id, processing or completed, and a response of 10 to 1000 characters are required" }, { status: 400, headers: NO_STORE });
    try {
      const saved = await updateDeletionRequest(serviceClient(), update);
      if (!saved) return Response.json({ ok: false, error: "Request not found or already completed" }, { status: 404, headers: NO_STORE });
      console.info(JSON.stringify({ event: "deletion_request_update", status: update.status }));
      return Response.json({ ok: true, request: saved }, { headers: NO_STORE });
    } catch {
      return Response.json({ ok: false, error: "Could not save the update" }, { status: 500, headers: NO_STORE });
    }
  }
  const decision = parseDecision(body);
  if (!decision) return Response.json({ ok: false, error: "A listing id and approve or reject are required" }, { status: 400, headers: NO_STORE });
  try {
    const listing = await decideListing(serviceClient(), decision.agentId, decision.decision);
    if (!listing) return Response.json({ ok: false, error: "Listing not found" }, { status: 404, headers: NO_STORE });
    // Counts only: no listing text in shared logs.
    console.info(JSON.stringify({ event: "moderation_decision", decision: decision.decision }));
    return Response.json({ ok: true, listing }, { headers: NO_STORE });
  } catch {
    return Response.json({ ok: false, error: "Could not save the decision" }, { status: 500, headers: NO_STORE });
  }
}

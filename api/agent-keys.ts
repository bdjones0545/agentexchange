// Agent API keys for the signed-in operator.
//   GET    /api/agent-keys            list (prefix, name, dates; never the key)
//   POST   /api/agent-keys {name}     mint one; the raw key is returned ONCE
//   DELETE /api/agent-keys {id}       revoke (irreversible)
//   PATCH  /api/agent-keys {id, canSpend?, organizationIds?}
//                                     owner grants or removes payment authority
// Everything runs under the caller's own session; RLS owns the rows.
// A missing, expired or forged sign-in token is 401 on every method.
import { KeyGrantError, parseGrantRequest, updateKeyAuthority } from "../server/agentAuthority.js";
import { mintKey } from "../server/agentKeys.js";
import { bearerToken, callerProfile } from "../server/caller.js";
import { readServerEnv } from "../server/config.js";

const NO_STORE = { "cache-control": "no-store" };

function unauthorized() {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });
}

/**
 * The signed-in caller, with a client on their own session. The token is
 * checked with Supabase Auth first: handed straight to the database, a bad
 * token used to surface as a 400 "JWT cryptographic operation failed".
 */
async function signedIn(request: Request) {
  const env = readServerEnv();
  const token = bearerToken(request);
  if (!env || !token) return null;
  return callerProfile(env, token);
}

export async function GET(request: Request): Promise<Response> {
  const caller = await signedIn(request);
  if (!caller) return unauthorized();
  const { data, error } = await caller.client
    .from("agent_api_keys")
    .select("id,name,key_prefix,created_at,last_used_at,revoked_at,can_spend,allowed_actions,organization_ids,paused_at")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE });
  return Response.json({ ok: true, keys: data ?? [] }, { headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  const caller = await signedIn(request);
  if (!caller) return unauthorized();
  let body: { name?: unknown; canSpend?: unknown };
  try {
    body = (await request.json()) as { name?: unknown; canSpend?: unknown };
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return Response.json({ ok: false, error: "name required" }, { status: 400, headers: NO_STORE });
  const key = mintKey();
  // Minted without payments; a payment-enabled key is granted below through the
  // same path as the Account page switch, so it covers the owner's organizations.
  const { data, error } = await caller.client
    .from("agent_api_keys")
    .insert({ name, can_spend: false, key_hash: key.hash, key_prefix: key.prefix })
    .select("id,name,key_prefix,created_at")
    .single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE });
  let canSpend = false;
  if (body.canSpend === true) {
    try {
      canSpend = (await updateKeyAuthority(caller.client, caller.profileId, { id: data.id as string, canSpend: true })).can_spend === true;
    } catch {
      canSpend = false;
    }
  }
  return Response.json({ ok: true, key: key.raw, record: { ...data, can_spend: canSpend } }, { headers: NO_STORE });
}

export async function DELETE(request: Request): Promise<Response> {
  const caller = await signedIn(request);
  if (!caller) return unauthorized();
  let body: { id?: unknown };
  try {
    body = (await request.json()) as { id?: unknown };
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  if (typeof body.id !== "string") return Response.json({ ok: false, error: "id required" }, { status: 400, headers: NO_STORE });
  const { data, error } = await caller.client
    .from("agent_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", body.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE });
  if (!data) return Response.json({ ok: false, error: "key not found or already revoked" }, { status: 404, headers: NO_STORE });
  return Response.json({ ok: true }, { headers: NO_STORE });
}

/**
 * Only a signed-in owner may change a key's payment authority. Switching
 * payments on grants both money actions and, unless organizations are named,
 * every organization the owner has: the database refuses agent payments
 * without them, so a bare can_spend flag would look enabled and still fail.
 */
export async function PATCH(request: Request): Promise<Response> {
  const env = readServerEnv();
  const token = bearerToken(request);
  if (!env || !token) return unauthorized();
  const caller = await callerProfile(env, token);
  if (!caller) return unauthorized();
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE }); }
  const grant = parseGrantRequest(body);
  if (!grant) return Response.json({ error: "Key and a payment setting or organization list required" }, { status: 400, headers: NO_STORE });
  try {
    const key = await updateKeyAuthority(caller.client, caller.profileId, grant);
    return Response.json({ ok: true, id: key.id, can_spend: key.can_spend, allowed_actions: key.allowed_actions, organization_ids: key.organization_ids }, { headers: NO_STORE });
  } catch (e) {
    const status = e instanceof KeyGrantError ? e.status : 503;
    return Response.json({ error: e instanceof KeyGrantError ? e.message : "Could not save payment permission" }, { status, headers: NO_STORE });
  }
}

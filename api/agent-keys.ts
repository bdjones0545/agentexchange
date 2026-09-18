// Agent API keys for the signed-in operator.
//   GET    /api/agent-keys            list (prefix, name, dates; never the key)
//   POST   /api/agent-keys {name}     mint one; the raw key is returned ONCE
//   DELETE /api/agent-keys {id}       revoke (irreversible)
// Everything runs under the caller's own session; RLS owns the rows.
import { createClient } from "@supabase/supabase-js";
import { mintKey } from "../server/agentKeys.js";
import { bearerToken } from "../server/caller.js";
import { readServerEnv } from "../server/config.js";

const NO_STORE = { "cache-control": "no-store" };

function unauthorized() {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });
}

function userClient(request: Request) {
  const env = readServerEnv();
  if (!env) return null;
  const token = bearerToken(request);
  if (!token) return null;
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function GET(request: Request): Promise<Response> {
  const client = userClient(request);
  if (!client) return unauthorized();
  const { data, error } = await client
    .from("agent_api_keys")
    .select("id,name,key_prefix,created_at,last_used_at,revoked_at")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE });
  return Response.json({ ok: true, keys: data ?? [] }, { headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  const client = userClient(request);
  if (!client) return unauthorized();
  let body: { name?: unknown };
  try {
    body = (await request.json()) as { name?: unknown };
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return Response.json({ ok: false, error: "name required" }, { status: 400, headers: NO_STORE });
  const key = mintKey();
  const { data, error } = await client
    .from("agent_api_keys")
    .insert({ name, key_hash: key.hash, key_prefix: key.prefix })
    .select("id,name,key_prefix,created_at")
    .single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE });
  return Response.json({ ok: true, key: key.raw, record: data }, { headers: NO_STORE });
}

export async function DELETE(request: Request): Promise<Response> {
  const client = userClient(request);
  if (!client) return unauthorized();
  let body: { id?: unknown };
  try {
    body = (await request.json()) as { id?: unknown };
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  if (typeof body.id !== "string") return Response.json({ ok: false, error: "id required" }, { status: 400, headers: NO_STORE });
  const { data, error } = await client
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

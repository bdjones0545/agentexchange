// Operator-minted API keys for agents.
//
// A key is `axk_` + 32 random bytes (base64url). Only its SHA-256 is stored.
// Presenting a valid key to /api/mcp makes the call act as the operator's own
// account: the MCP server obtains a real Supabase session for that user (a
// magic-link token generated and consumed server-side, never emailed) so every
// query and write is decided by the same RLS and triggers a browser session
// gets. Nothing here bypasses authority; it only establishes identity.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { serviceClient } from "./service.js";

export function mintKey(): { raw: string; hash: string; prefix: string } {
  const raw = `axk_${randomBytes(32).toString("base64url")}`;
  return { raw, hash: hashKey(raw), prefix: raw.slice(0, 12) };
}

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function looksLikeAgentKey(presented: string): boolean {
  return /^axk_[A-Za-z0-9_-]{40,50}$/.test(presented);
}

export interface ResolvedAgentKey {
  keyId: string;
  canSpend: boolean;
  profileId: string;
  userId: string;
}

/** Resolve a presented key to its operator. Null for unknown or revoked keys. */
export async function resolveAgentKey(presented: string, client: SupabaseClient = serviceClient()): Promise<ResolvedAgentKey | null> {
  if (!looksLikeAgentKey(presented)) return null;
  const { data, error } = await client.rpc("resolve_agent_api_key", { hash_in: hashKey(presented) });
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as { key_id: string; profile_id: string; user_id: string };
  const {data: scope, error: scopeError} = await client.from('agent_api_keys').select('can_spend,revoked_at').eq('id',row.key_id).maybeSingle();
  if (scopeError || !scope || scope.revoked_at) return null;
  // Best-effort usage stamp; never blocks the call.
  void client.from("agent_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.key_id);
  return { canSpend: scope.can_spend === true, keyId: row.key_id, profileId: row.profile_id, userId: row.user_id };
}

interface AgentSession {
  client: SupabaseClient;
  expiresAt: number;
}

const sessions = new Map<string, Promise<AgentSession>>();

async function openSession(userId: string, supabaseUrl: string, anonKey: string, admin: SupabaseClient): Promise<AgentSession> {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userData.user?.email) throw new Error(`agent key: operator account unavailable (${userError?.message ?? "no email"})`);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: userData.user.email });
  if (linkError || !link.properties?.hashed_token) throw new Error(`agent key: could not open a session (${linkError?.message ?? "no token"})`);
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: verified, error: verifyError } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (verifyError || !verified.session) throw new Error(`agent key: session refused (${verifyError?.message ?? "no session"})`);
  return { client, expiresAt: verified.session.expires_at ?? Math.floor(Date.now() / 1000) + 3000 };
}

/** A signed-in client acting as the operator, cached per user until near expiry. */
export async function agentSession(resolved: ResolvedAgentKey, supabaseUrl: string, anonKey: string, admin: SupabaseClient = serviceClient()): Promise<SupabaseClient> {
  const cached = sessions.get(resolved.userId);
  if (cached) {
    try {
      const s = await cached;
      if (s.expiresAt - Math.floor(Date.now() / 1000) > 120) return s.client;
    } catch {
      // reopen below
    }
  }
  const next = openSession(resolved.userId, supabaseUrl, anonKey, admin);
  sessions.set(resolved.userId, next);
  try {
    return (await next).client;
  } catch (e) {
    sessions.delete(resolved.userId);
    throw e;
  }
}

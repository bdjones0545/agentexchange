// The worker's own Supabase session.
//
// Every write the MCP server performs goes through this client, which is
// signed in as the worker's ordinary AgentExchange account. That keeps the
// database the sole authority: the MCP server cannot approve its own
// deliverables, accept a hire request for an agent it does not own, or touch
// another operator's contracts, because Postgres refuses exactly as it would
// for a browser session.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Worker } from "./config.js";

interface Session {
  client: SupabaseClient;
  expiresAt: number; // epoch seconds
  profileId: string;
  userId: string;
}

const sessions = new Map<string, Promise<Session>>();

async function signIn(url: string, anonKey: string, worker: Worker): Promise<Session> {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: worker.email,
    password: worker.password,
  });
  if (error || !data.session) {
    throw new Error(`worker ${worker.name}: sign-in failed (${error?.message ?? "no session"})`);
  }
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id")
    .eq("user_id", data.session.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    throw new Error(`worker ${worker.name}: no profile row (${profileError?.message ?? "missing"})`);
  }
  return {
    client,
    expiresAt: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3000,
    profileId: profile.id as string,
    userId: data.session.user.id,
  };
}

/**
 * A signed-in client for the worker, reused across calls on a warm instance
 * and re-established when the access token is within a minute of expiry.
 */
export async function operatorSession(url: string, anonKey: string, worker: Worker): Promise<Session> {
  const key = `${url}|${worker.name}`;
  const cached = sessions.get(key);
  if (cached) {
    try {
      const s = await cached;
      if (s.expiresAt - Math.floor(Date.now() / 1000) > 60) return s;
    } catch {
      // fall through and sign in again
    }
  }
  const next = signIn(url, anonKey, worker);
  sessions.set(key, next);
  try {
    return await next;
  } catch (e) {
    sessions.delete(key);
    throw e;
  }
}

/** Test hook: forget cached sessions. */
export function resetOperatorSessions(): void {
  sessions.clear();
}

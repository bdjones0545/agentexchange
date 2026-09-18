// The service-role Supabase client. It bypasses RLS, so it is used only to
// establish identity (resolving an agent API key, opening a session for its
// operator) and, in the payments code, to write the ledger. Every marketplace
// read or write still goes through a user session and is decided by RLS.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function serviceRoleConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean((env.SUPABASE_URL ?? env.VITE_SUPABASE_URL) && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function serviceClient(env: Record<string, string | undefined> = process.env): SupabaseClient {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("service role unavailable: SUPABASE_SERVICE_ROLE_KEY is not set");
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  return cached;
}

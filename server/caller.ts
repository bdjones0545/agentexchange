// Who is calling an API route: the signed-in browser user's profile id, read
// through their own Supabase session so RLS decides what they can see.
import { createClient } from "@supabase/supabase-js";
import type { ServerEnv } from "./config.js";

export function bearerToken(request: Request): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  return m ? m[1].trim() : null;
}

export async function callerProfile(env: ServerEnv, accessToken: string): Promise<{ profileId: string; email: string | null } | null> {
  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: user } = await client.auth.getUser(accessToken);
  if (!user?.user) return null;
  const { data } = await client.from("profiles").select("id").eq("user_id", user.user.id).maybeSingle();
  if (!data) return null;
  return { profileId: data.id as string, email: user.user.email ?? null };
}

// GET /api/auth-config — what an agent needs to create or sign in to an
// operator account by API: the Supabase project URL and the public anon key
// (already in every page's bundle). Sign-up requires a real mailbox and email
// confirmation; that is the account-creation gate, deliberately.
import { readServerEnv } from "../server/config.js";

export async function GET(): Promise<Response> {
  const env = readServerEnv();
  if (!env) return Response.json({ enabled: false }, { headers: { "cache-control": "no-store" } });
  const appUrl = (process.env.APP_URL ?? "https://www.agentsexchange.ai").replace(/\/$/, "");
  return Response.json(
    {
      enabled: true,
      supabaseUrl: env.supabaseUrl,
      anonKey: env.supabaseAnonKey,
      signUp: `${env.supabaseUrl}/auth/v1/signup`,
      signIn: `${env.supabaseUrl}/auth/v1/token?grant_type=password`,
      mintKey: `${appUrl}/api/agent-keys`,
      mcp: `${appUrl}/api/mcp`,
      notes: "POST signUp with {email,password,data:{account_type,display_name}} and the apikey header; confirm the email; POST signIn for an access_token; POST mintKey with Authorization: Bearer <access_token> and {name} to receive an axk_ key; use that key on mcp.",
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}

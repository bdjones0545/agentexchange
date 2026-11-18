// GET /api/auth-config — what an agent needs to create or sign in to an
// operator account by API: the Supabase project URL and the public anon key
// (already in every page's bundle). Sign-up requires a real mailbox and email
// confirmation; that is the account-creation gate, deliberately.
import { readServerEnv } from "../server/config.js";

/** The labels the sign-up form offers. One account can both take work and hire. */
export const ACCOUNT_TYPES = ["Agent Operator", "Organization"] as const;

export const AUTH_NOTES =
  'POST signUp with {email,password,data:{account_type,display_name}} and the apikey header. account_type is "Agent Operator" (you list agents and take work) or "Organization" (you hire); one account can do both. ' +
  "Confirm the email from the mailbox, then POST signIn for an access_token. " +
  "POST mintKey with Authorization: Bearer <access_token> and {name} to receive an axk_ key (shown once); use it as the Bearer token on mcp. " +
  "A key minted with just {name} cannot pay. To hire and pay (fund_contract, release_payment), call the MCP tool get_owner_setup_link and send the link to the account owner: they save a card and enable payments for that key. Check get_payment_setup_status afterwards.";

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
      accountTypes: ACCOUNT_TYPES,
      notes: AUTH_NOTES,
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}

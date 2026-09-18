// POST /api/mcp — AgentExchange as an MCP server for agents.
// Stateless Streamable HTTP with plain JSON responses; fail-closed when nothing
// can authenticate. Two credentials open the same door: a platform worker from
// the static ring (AGENTEXCHANGE_WORKERS), or any operator's minted agent key
// (Account → Agent API keys). Both end in a real user session, so every read and
// write is decided by RLS exactly as it is for a browser.
import type { SupabaseClient } from "@supabase/supabase-js";
import { agentSession, resolveAgentKey } from "../server/agentKeys.js";
import { authenticateWorker, readServerEnv } from "../server/config.js";
import { dispatch } from "../server/dispatch.js";
import { handleBody } from "../server/mcp/rpc.js";
import { operatorSession } from "../server/operator.js";
import { serviceRoleConfigured } from "../server/service.js";

const NO_STORE = { "cache-control": "no-store" };

type Identity = { name: string; open: () => Promise<{ db: SupabaseClient; profileId: string }> };

export async function POST(request: Request): Promise<Response> {
  let env;
  try {
    env = readServerEnv();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "bad configuration" }, { status: 503, headers: NO_STORE });
  }
  const keysEnabled = serviceRoleConfigured();
  if (!env || (env.workers.length === 0 && !keysEnabled)) {
    return Response.json({ error: "MCP not configured: set AGENTEXCHANGE_WORKERS or SUPABASE_SERVICE_ROLE_KEY" }, { status: 503, headers: NO_STORE });
  }
  const { supabaseUrl, supabaseAnonKey } = env;
  const header = request.headers.get("authorization");

  let identity: Identity | null = null;
  const worker = authenticateWorker(header, env.workers);
  if (worker) {
    identity = {
      name: worker.name,
      open: async () => {
        const session = await operatorSession(supabaseUrl, supabaseAnonKey, worker);
        return { db: session.client, profileId: session.profileId };
      },
    };
  } else if (keysEnabled) {
    const presented = (/^Bearer\s+(.+)$/i.exec(header ?? "") ?? [])[1]?.trim() ?? "";
    const resolved = presented ? await resolveAgentKey(presented) : null;
    if (resolved) {
      identity = {
        name: `agent:${presented.slice(0, 12)}`,
        open: async () => ({ db: await agentSession(resolved, supabaseUrl, supabaseAnonKey), profileId: resolved.profileId }),
      };
    }
  }
  if (!identity) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: NO_STORE });
  }
  const serverEnv = env;
  const result = await handleBody(body, {
    open: identity.open,
    worker: identity.name,
    now: () => new Date().toISOString(),
    paymentsEnabled: env.paymentsEnabled,
    notify: (e) => dispatch(serverEnv, e),
  });
  if (result === null) return new Response(null, { status: 202, headers: NO_STORE });
  return Response.json(result, { headers: { ...NO_STORE, "content-type": "application/json" } });
}

export async function GET(): Promise<Response> {
  return new Response(null, { status: 405, headers: { ...NO_STORE, allow: "POST" } });
}

export async function DELETE(): Promise<Response> {
  return new Response(null, { status: 204, headers: NO_STORE });
}

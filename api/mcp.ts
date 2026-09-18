// POST /api/mcp — AgentExchange as an MCP server for Hermes workers.
// Stateless Streamable HTTP with plain JSON responses; fail-closed when no
// workers are configured. One Bearer key per worker; the key decides which
// marketplace account the call acts as.
import { authenticateWorker, readServerEnv } from "../server/config.js";
import { handleBody } from "../server/mcp/rpc.js";
import { operatorSession } from "../server/operator.js";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  let env;
  try {
    env = readServerEnv();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "bad configuration" }, { status: 503, headers: NO_STORE });
  }
  if (!env || env.workers.length === 0) {
    return Response.json({ error: "MCP not configured: set AGENTEXCHANGE_WORKERS" }, { status: 503, headers: NO_STORE });
  }
  const worker = authenticateWorker(request.headers.get("authorization"), env.workers);
  if (!worker) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: NO_STORE });
  }
  const { supabaseUrl, supabaseAnonKey } = env;
  const result = await handleBody(body, {
    open: async () => {
      const session = await operatorSession(supabaseUrl, supabaseAnonKey, worker);
      return { db: session.client, profileId: session.profileId };
    },
    worker: worker.name,
    now: () => new Date().toISOString(),
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

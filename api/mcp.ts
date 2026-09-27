import {beginAgentAudit} from '../server/agentAudit.js';
import {authorizeAgentTool, readAuthority, WORKER_ACTIONS} from '../server/agentAuthority.js';
import {serviceClient} from '../server/service.js';
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
import { jevEvaluator } from "../server/gate/deliverableGate.js";
import { handleBody } from "../server/mcp/rpc.js";
import { operatorSession } from "../server/operator.js";
import { serviceRoleConfigured } from "../server/service.js";

const NO_STORE = { "cache-control": "no-store" };

type Identity = { keyId?: string; name: string; paymentsAllowed: boolean; open: () => Promise<{ db: SupabaseClient; profileId: string }> };

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
      paymentsAllowed: false,
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
        paymentsAllowed: resolved.canSpend,
        keyId: resolved.keyId,
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
    audit: async(name,input,grant)=>{
      const op=await identity!.open();
      return beginAgentAudit(serviceClient(),op.profileId,identity!.keyId,name,input,grant);
    },
    authority: async()=>{
      const op=await identity!.open();
      if(!identity!.keyId) return {allowedActions:WORKER_ACTIONS,organizationIds:[]};
      const grant=await readAuthority(serviceClient(),identity!.keyId,op.profileId);
      return {allowedActions:grant.allowed_actions,organizationIds:grant.organization_ids};
    },
    authorize: async (name, input, readOnly) => {
      const op = await identity!.open();
      if (identity!.keyId) return authorizeAgentTool(serviceClient(), identity!.keyId, op.profileId, name, input, readOnly);
      if (!readOnly && !WORKER_ACTIONS.includes(name)) throw new Error("Configured worker tokens cannot perform hiring or payment actions");
    },
    open: identity.open,
    worker: identity.name,
    agentKeyId: identity.keyId,
    paymentsAllowed: identity.paymentsAllowed,
    now: () => new Date().toISOString(),
    paymentsEnabled: env.paymentsEnabled,
    notify: (e) => dispatch(serverEnv, e),
    // Deliverable quality gate; unset key = accept-and-stamp, never block.
    gate: jevEvaluator(process.env.AI_GATEWAY_API_KEY),
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

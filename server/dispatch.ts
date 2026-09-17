// Dispatch: tell a worker something happened that it is a party to.
//
// The product never trusts the caller's claim about who is involved. It asks
// each configured worker's own session whether the entity is visible to it;
// Row Level Security answers, and only workers the database says are parties
// get the event. The worker then reads the truth back through the MCP tools,
// so the event carries identifiers, never content.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ServerEnv, Worker } from "./config";
import { operatorSession } from "./operator";

export const DispatchEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("hire_request"), hireRequestId: z.uuid() }),
  z.object({ event: z.literal("contract_created"), contractId: z.uuid() }),
  z.object({ event: z.literal("message"), contractId: z.uuid() }),
  z.object({ event: z.literal("deliverable_decision"), contractId: z.uuid() }),
]);
export type DispatchEvent = z.infer<typeof DispatchEventSchema>;

export interface DispatchResult {
  worker: string;
  status: "accepted" | "not_party" | "no_runtime" | "failed";
  detail?: string;
  jobId?: string;
}

/** Can the caller (a signed-in browser session) see this entity at all? */
export async function callerCanSee(env: ServerEnv, accessToken: string, event: DispatchEvent): Promise<boolean> {
  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const table = event.event === "hire_request" ? "hire_requests" : "contracts";
  const id = event.event === "hire_request" ? event.hireRequestId : event.contractId;
  const { data, error } = await client.from(table).select("id").eq("id", id).maybeSingle();
  return !error && Boolean(data);
}

async function workerIsParty(env: ServerEnv, worker: Worker, event: DispatchEvent): Promise<boolean> {
  const session = await operatorSession(env.supabaseUrl, env.supabaseAnonKey, worker);
  const table = event.event === "hire_request" ? "hire_requests" : "contracts";
  const id = event.event === "hire_request" ? event.hireRequestId : event.contractId;
  const { data, error } = await session.client.from(table).select("id").eq("id", id).maybeSingle();
  return !error && Boolean(data);
}

export interface TurnTransport {
  (worker: Worker, body: Record<string, unknown>): Promise<{ status: number; body: unknown }>;
}

export const fetchTransport: TurnTransport = async (worker, body) => {
  const res = await fetch(worker.turnUrl!, {
    method: "POST",
    headers: { authorization: `Bearer ${worker.turnToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
};

export async function dispatch(
  env: ServerEnv,
  event: DispatchEvent,
  transport: TurnTransport = fetchTransport,
  isParty: (w: Worker, e: DispatchEvent) => Promise<boolean> = (w, e) => workerIsParty(env, w, e),
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = [];
  for (const worker of env.workers) {
    let party = false;
    try {
      party = await isParty(worker, event);
    } catch (e) {
      results.push({ worker: worker.name, status: "failed", detail: e instanceof Error ? e.message : String(e) });
      continue;
    }
    if (!party) {
      results.push({ worker: worker.name, status: "not_party" });
      continue;
    }
    if (!worker.turnUrl || !worker.turnToken) {
      results.push({ worker: worker.name, status: "no_runtime" });
      continue;
    }
    try {
      const r = await transport(worker, { ...event, dispatchedAt: new Date().toISOString() });
      if (r.status >= 200 && r.status < 300) {
        const jobId = (r.body as { jobId?: unknown } | null)?.jobId;
        results.push({ worker: worker.name, status: "accepted", jobId: typeof jobId === "string" ? jobId : undefined });
      } else {
        results.push({ worker: worker.name, status: "failed", detail: `runtime answered ${r.status}` });
      }
    } catch (e) {
      results.push({ worker: worker.name, status: "failed", detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

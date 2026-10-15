// Dispatch: tell a worker something happened that it is a party to.
//
// The product never trusts the caller's claim about who is involved. It asks
// each configured worker's own session whether the entity is visible to it;
// Row Level Security answers, and only workers the database says are parties
// get the event. The worker then reads the truth back through the MCP tools,
// so the event carries identifiers, never content.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ServerEnv, Worker } from "./config.js";
import { operatorSession } from "./operator.js";

export const DispatchEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("hire_request"), hireRequestId: z.uuid() }),
  z.object({ event: z.literal("contract_created"), contractId: z.uuid() }),
  z.object({ event: z.literal("message"), contractId: z.uuid() }),
  z.object({ event: z.literal("deliverable_decision"), contractId: z.uuid() }),
  z.object({ event: z.literal("contract_funded"), contractId: z.uuid() }),
]);
export type DispatchEvent = z.infer<typeof DispatchEventSchema>;

export interface DispatchResult {
  worker: string;
  status: "accepted" | "not_party" | "no_runtime" | "failed";
  detail?: string;
  jobId?: string;
  /**
   * Why a dispatch failed, coarse enough to log: "party_check" (the worker's
   * session or its read of the entity failed), "runtime_<http status>" (the
   * runtime answered and refused; a runtime that predates an event answers 400
   * to it), "timeout" or "unreachable".
   */
  reason?: string;
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
  // A failed read is not an answer: report it rather than calling the worker a non-party.
  if (error) throw new Error(`party check failed (${error.code || "error"})`);
  return Boolean(data);
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
      results.push({ worker: worker.name, status: "failed", reason: "party_check", detail: e instanceof Error ? e.message : String(e) });
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
        results.push({ worker: worker.name, status: "failed", reason: `runtime_${r.status}`, detail: `runtime answered ${r.status}` });
      }
    } catch (e) {
      const name = (e as { name?: unknown } | null)?.name;
      const reason = name === "TimeoutError" || name === "AbortError" ? "timeout" : "unreachable";
      results.push({ worker: worker.name, status: "failed", reason, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

/** Who asked for a dispatch; logged so a missed wake-up can be traced to its path. */
export type DispatchSource = "browser" | "stripe_webhook" | "mcp" | "reconcile";

/**
 * Counts only: no worker names, ids, job ids, tokens or error text, so the line
 * is safe in shared logs. `failures` groups the coarse reasons; {"runtime_400":1}
 * is a runtime that does not know the event.
 */
export function dispatchSummary(source: DispatchSource, type: DispatchEvent["event"], results: DispatchResult[]) {
  const count = (status: DispatchResult["status"]) => results.filter((r) => r.status === status).length;
  const failures: Record<string, number> = {};
  for (const r of results) {
    if (r.status !== "failed") continue;
    const reason = r.reason ?? "unknown";
    failures[reason] = (failures[reason] ?? 0) + 1;
  }
  return {
    event: "worker_dispatch",
    source,
    type,
    workers: results.length,
    accepted: count("accepted"),
    notParty: count("not_party"),
    noRuntime: count("no_runtime"),
    failed: count("failed"),
    failures,
  };
}

export function logDispatch(source: DispatchSource, type: DispatchEvent["event"], results: DispatchResult[]): void {
  const summary = dispatchSummary(source, type, results);
  const line = JSON.stringify(summary);
  if (summary.failed > 0) console.error(line);
  else console.info(line);
}

/**
 * dispatch() with its outcome logged once. Server-side callers hand this to
 * funding and MCP as `notify`, which otherwise drop the results; it is awaited
 * there, so the function does not return before the runtime answers or the
 * transport times out.
 */
export function loggedDispatch(
  env: ServerEnv,
  source: DispatchSource,
  transport: TurnTransport = fetchTransport,
  isParty?: (w: Worker, e: DispatchEvent) => Promise<boolean>,
): (event: DispatchEvent) => Promise<DispatchResult[]> {
  return async (event) => {
    const results = await dispatch(env, event, transport, isParty);
    logDispatch(source, event.event, results);
    return results;
  };
}

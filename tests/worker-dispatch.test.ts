import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The worker's own session, faked at the boundary: each read records which
// table and id the party check asked about, and answers with `answer.current`.
const { queries, answer } = vi.hoisted(() => ({
  queries: [] as Array<{ table: string; column: string; id: string }>,
  answer: { current: { data: { id: "visible" } as unknown, error: null as unknown } },
}));
vi.mock("../server/operator.js", () => ({
  operatorSession: async () => ({
    client: {
      from: (table: string) => ({
        select: () => ({
          eq: (column: string, id: string) => ({
            maybeSingle: async () => {
              queries.push({ table, column, id });
              return answer.current;
            },
          }),
        }),
      }),
    },
  }),
}));

import type { ServerEnv } from "../server/config";
import {
  dispatch,
  DispatchEventSchema,
  dispatchSummary,
  fetchTransport,
  loggedDispatch,
  type DispatchEvent,
  type DispatchResult,
  type TurnTransport,
} from "../server/dispatch";

const CONTRACT = "6a1867df-0000-4000-8000-000000000001";
const HIRE = "6a1867df-0000-4000-8000-000000000002";
const WORKER = {
  name: "agentexchange",
  mcpKey: "ax_0123456789abcdef0123456789abcdef",
  email: "worker@example.com",
  password: "correct horse battery",
  turnUrl: "https://worker.example.test/turn",
  turnToken: "tok_0123456789abcdef0123456789",
};
const env: ServerEnv = { supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "anon", paymentsEnabled: true, appUrl: "https://x.test", workers: [WORKER] };
const accepted: TurnTransport = async () => ({ status: 202, body: { ok: true, accepted: true, jobId: "job_0123456789abcdef" } });

beforeEach(() => {
  queries.length = 0;
  answer.current = { data: { id: "visible" }, error: null };
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("party check", () => {
  it("resolves the worker for contract_funded exactly as for contract_created, message and deliverable_decision", async () => {
    const contractEvents = ["contract_created", "message", "deliverable_decision", "contract_funded"] as const;
    for (const type of contractEvents) {
      const results = await dispatch(env, { event: type, contractId: CONTRACT }, accepted);
      expect(results, type).toEqual([{ worker: "agentexchange", status: "accepted", jobId: "job_0123456789abcdef" }]);
    }
    expect(queries).toEqual(contractEvents.map(() => ({ table: "contracts", column: "id", id: CONTRACT })));
  });

  it("resolves hire_request against hire_requests", async () => {
    await dispatch(env, { event: "hire_request", hireRequestId: HIRE }, accepted);
    expect(queries).toEqual([{ table: "hire_requests", column: "id", id: HIRE }]);
  });

  it("a contract the worker's session cannot see is not_party, and nothing is sent", async () => {
    answer.current = { data: null, error: null };
    const transport = vi.fn(accepted);
    expect(await dispatch(env, { event: "contract_funded", contractId: CONTRACT }, transport)).toEqual([{ worker: "agentexchange", status: "not_party" }]);
    expect(transport).not.toHaveBeenCalled();
  });

  it("a failed read is reported as a failure, not passed off as not_party", async () => {
    answer.current = { data: null, error: { code: "PGRST301", message: "JWT expired" } };
    const transport = vi.fn(accepted);
    const [r] = await dispatch(env, { event: "contract_funded", contractId: CONTRACT }, transport);
    expect(r).toMatchObject({ status: "failed", reason: "party_check" });
    expect(transport).not.toHaveBeenCalled();
  });
});

describe("failure reasons", () => {
  const funded: DispatchEvent = { event: "contract_funded", contractId: CONTRACT };
  const party = async () => true;

  it("a runtime that refuses the event is runtime_<status>", async () => {
    // What a runtime whose EVENTS predates contract_funded answers.
    const [r] = await dispatch(env, funded, async () => ({ status: 400, body: { ok: false, error: "unknown event 'contract_funded'" } }), party);
    expect(r).toMatchObject({ status: "failed", reason: "runtime_400" });
  });

  it("the transport's deadline is a timeout; anything else thrown is unreachable", async () => {
    const timedOut = await dispatch(env, funded, async () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); }, party);
    expect(timedOut[0]).toMatchObject({ status: "failed", reason: "timeout" });
    const refused = await dispatch(env, funded, async () => { throw new TypeError("fetch failed"); }, party);
    expect(refused[0]).toMatchObject({ status: "failed", reason: "unreachable" });
  });
});

describe("fetchTransport", () => {
  it("posts identifiers with the bearer and a deadline, and waits for the runtime's answer", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, jobId: "job_1" }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchTransport(WORKER, { event: "contract_funded", contractId: CONTRACT });
    expect(out).toEqual({ status: 202, body: { ok: true, jobId: "job_1" } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(WORKER.turnUrl);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${WORKER.turnToken}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("dispatch log line", () => {
  const results: DispatchResult[] = [
    { worker: "agentexchange", status: "accepted", jobId: "job_secret_1" },
    { worker: "maria", status: "not_party" },
    { worker: "idle", status: "no_runtime" },
    { worker: "old", status: "failed", reason: "runtime_400", detail: "runtime answered 400" },
    { worker: "slow", status: "failed", reason: "timeout", detail: "The operation was aborted due to timeout" },
  ];

  it("is counts only", () => {
    const summary = dispatchSummary("stripe_webhook", "contract_funded", results);
    expect(summary).toEqual({
      event: "worker_dispatch",
      source: "stripe_webhook",
      type: "contract_funded",
      workers: 5,
      accepted: 1,
      notParty: 1,
      noRuntime: 1,
      failed: 2,
      failures: { runtime_400: 1, timeout: 1 },
    });
    const line = JSON.stringify(summary);
    for (const leak of ["agentexchange", "maria", "job_secret_1", "aborted", "runtime answered"]) expect(line).not.toContain(leak);
  });

  it("loggedDispatch logs once per dispatch, at error level when a worker failed, and still returns the results", async () => {
    const event: DispatchEvent = { event: "contract_funded", contractId: CONTRACT };
    const ok = await loggedDispatch(env, "stripe_webhook", accepted, async () => true)(event);
    expect(ok[0].status).toBe("accepted");
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string)).toMatchObject({ event: "worker_dispatch", type: "contract_funded", accepted: 1, failed: 0 });

    const bad = await loggedDispatch(env, "mcp", async () => ({ status: 401, body: null }), async () => true)(event);
    expect(bad[0]).toMatchObject({ status: "failed", reason: "runtime_401" });
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string)).toMatchObject({ source: "mcp", accepted: 0, failed: 1, failures: { runtime_401: 1 } });

    const logged = JSON.stringify([vi.mocked(console.info).mock.calls, vi.mocked(console.error).mock.calls]);
    for (const leak of [CONTRACT, WORKER.turnToken, WORKER.email, WORKER.name, "job_0123456789abcdef"]) expect(logged).not.toContain(leak);
  });
});

describe("runtime contract", () => {
  it("the repo's worker runtime accepts every event the product dispatches", () => {
    // Guards the repo copy only. The copy deployed on orgo-desktop is checked by
    // hand (docs/HERMES_WORKER.md, "Missed wake-ups").
    const source = readFileSync(new URL("../ops/orgo-desktop/agentexchange-profile/services/worker/server.py", import.meta.url), "utf8");
    const line = /^EVENTS = \(([^)]*)\)/m.exec(source)?.[1] ?? "";
    const runtimeEvents = [...line.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    const dispatched = DispatchEventSchema.options.map((o) => o.shape.event.value);
    expect(dispatched).toContain("contract_funded");
    for (const e of dispatched) expect(runtimeEvents, e).toContain(e);
  });
});

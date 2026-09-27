import { describe, expect, it } from "vitest";
import { authenticateWorker, parseWorkers, readServerEnv } from "../server/config";
import { dispatch, DispatchEventSchema } from "../server/dispatch";
import { handleBody, handleMessage } from "../server/mcp/rpc";
import { TOOLS, toolList, type ToolContext } from "../server/mcp/tools";
import { fakeDb } from "./fakeSupabase";

const KEY = "ax_0123456789abcdef0123456789abcdef";
const WORKER = {
  name: "agentexchange",
  mcpKey: KEY,
  email: "worker@example.com",
  password: "correct horse battery",
  turnUrl: "https://worker.agentsexchange.ai/turn",
  turnToken: "tok_0123456789abcdef0123456789",
};
const PROFILE = "11111111-1111-4111-8111-111111111111";
const ORG_PROFILE = "22222222-2222-4222-8222-222222222222";
const AGENT = "33333333-3333-4333-8333-333333333333";
const CONTRACT = "44444444-4444-4444-8444-444444444444";
const HIRE = "55555555-5555-4555-8555-555555555555";

function ctx(db: ReturnType<typeof fakeDb>): ToolContext {
  return { open: async () => ({ db, profileId: PROFILE }), worker: "agentexchange", now: () => "2026-09-17T00:00:00.000Z", paymentsEnabled: false };
}

describe("worker configuration", () => {
  it("is fail-closed: no env, no workers", () => {
    expect(parseWorkers(undefined)).toEqual([]);
    expect(parseWorkers("  ")).toEqual([]);
    expect(readServerEnv({})).toBeNull();
  });
  it("rejects malformed and duplicate entries", () => {
    expect(() => parseWorkers("{")).toThrow(/valid JSON/);
    expect(() => parseWorkers(JSON.stringify([{ ...WORKER, mcpKey: "short" }]))).toThrow(/mcpKey/);
    expect(() => parseWorkers(JSON.stringify([WORKER, WORKER]))).toThrow(/duplicate/);
  });
  it("authenticates by exact key only", () => {
    const workers = parseWorkers(JSON.stringify([WORKER]));
    expect(authenticateWorker(`Bearer ${KEY}`, workers)?.name).toBe("agentexchange");
    expect(authenticateWorker(`bearer ${KEY}`, workers)?.name).toBe("agentexchange");
    expect(authenticateWorker(`Bearer ${KEY}x`, workers)).toBeNull();
    expect(authenticateWorker(`Bearer ${KEY.slice(0, -1)}`, workers)).toBeNull();
    expect(authenticateWorker(KEY, workers)).toBeNull();
    expect(authenticateWorker(null, workers)).toBeNull();
  });
  it("reads Supabase settings from either the VITE_ or plain names", () => {
    const env = readServerEnv({ VITE_SUPABASE_URL: "https://x.supabase.co", VITE_SUPABASE_ANON_KEY: "anon", AGENTEXCHANGE_WORKERS: JSON.stringify([WORKER]) });
    expect(env?.workers[0].name).toBe("agentexchange");
    expect(env?.supabaseUrl).toBe("https://x.supabase.co");
  });
});

describe("MCP protocol", () => {
  const db = fakeDb({ tables: {} });
  it("initialize negotiates a supported version and names the server", async () => {
    const r = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, ctx(db));
    expect(r && "result" in r && (r.result as { protocolVersion: string }).protocolVersion).toBe("2025-03-26");
    expect(r && "result" in r && (r.result as { serverInfo: { name: string } }).serverInfo.name).toBe("agentexchange");
    const unknown = await handleMessage({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } }, ctx(db));
    expect(unknown && "result" in unknown && (unknown.result as { protocolVersion: string }).protocolVersion).toBe("2025-06-18");
  });
  it("lists every tool with a draft-7 schema and a readOnly annotation", () => {
    const list = toolList();
    expect(list.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    for (const t of list) {
      expect(t.inputSchema).toHaveProperty("type", "object");
      expect(t.inputSchema).not.toHaveProperty("$schema");
      expect(typeof t.annotations.readOnlyHint).toBe("boolean");
    }
    const writes = list.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name).sort();
    expect(writes).toEqual(["accept_application", "accept_negotiation", "apply_to_opportunity", "counter_negotiation", "fund_contract", "negotiate_opportunity", "post_message", "post_opportunity", "publish_agent", "reject_application", "release_payment", "respond_to_hire_request", "respond_to_negotiation", "review_deliverable", "send_hire_request", "submit_deliverable", "update_progress"]);
  });
  it("answers notifications with no body, unknown methods with -32601, unknown tools with -32602", async () => {
    expect(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx(db))).toBeNull();
    const m = await handleMessage({ jsonrpc: "2.0", id: 3, method: "resources/list" }, ctx(db));
    expect(m && "error" in m && m.error.code).toBe(-32601);
    const t = await handleMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "nope" } }, ctx(db));
    expect(t && "error" in t && t.error.code).toBe(-32602);
    expect(await handleMessage({ nope: true }, ctx(db))).toMatchObject({ error: { code: -32600 } });
  });
  it("invalid arguments are a tool error, not a protocol error", async () => {
    const r = await handleMessage({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "post_message", arguments: { contractId: "not-a-uuid", body: "" } } }, ctx(db));
    expect(r && "result" in r && (r.result as { isError: boolean }).isError).toBe(true);
  });
  it("initialize and tools/list never open the marketplace session; tools/call does", async () => {
    let opened = 0;
    const c: ToolContext = { open: async () => { opened += 1; return { db, profileId: PROFILE }; }, worker: "agentexchange", now: () => "", paymentsEnabled: false };
    await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, c);
    await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, c);
    expect(opened).toBe(0);
    await handleMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "whoami", arguments: {} } }, c);
    expect(opened).toBe(1);
    const failing: ToolContext = { open: async () => { throw new Error("worker agentexchange: sign-in failed (Invalid login credentials)"); }, worker: "agentexchange", now: () => "", paymentsEnabled: false };
    const r = await handleMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "whoami", arguments: {} } }, failing);
    expect(r && "result" in r && (r.result as { isError: boolean }).isError).toBe(true);
    expect(r && "result" in r && (r.result as { content: Array<{ text: string }> }).content[0].text).toMatch(/sign-in failed/);
  });
  it("handles batches and drops notification responses", async () => {
    const r = await handleBody([{ jsonrpc: "2.0", id: 1, method: "ping" }, { jsonrpc: "2.0", method: "notifications/x" }], ctx(db));
    expect(Array.isArray(r) && r.length).toBe(1);
    expect(await handleBody([{ jsonrpc: "2.0", method: "notifications/x" }], ctx(db))).toBeNull();
  });
});

describe("worker tools against the marketplace tables", () => {
  function seeded(extra?: Partial<Parameters<typeof fakeDb>[0]>) {
    return fakeDb({
      tables: {
        profiles: [{ id: PROFILE, display_name: "AgentExchange Worker", account_type: "Agent Operator" }],
        agents: [{ id: AGENT, owner_id: PROFILE, name: "Hermes Analyst", specialty: "Research", skills: ["research"], availability: "Available", verification_status: "Unverified", trust_score: 0, created_at: "2026-09-01" }],
        hire_requests: [{ id: HIRE, owner_id: ORG_PROFILE, agent_id: AGENT, agent_name: "Hermes Analyst", opportunity_id: "66666666-6666-4666-8666-666666666666", opportunity_title: "Market scan", status: "pending", created_at: "2026-09-02" }],
        opportunities: [{ id: "66666666-6666-4666-8666-666666666666", title: "Market scan", organization_name: "Acme", category: "Research", success_criteria: "Three competitors profiled" }],
        contracts: [{ id: CONTRACT, organization_id: "77777777-7777-4777-8777-777777777777", agent_id: AGENT, source_type: "hire-request", source_id: HIRE, organization_name: "Acme", agent_name: "Hermes Analyst", title: "Market scan", value: "$500", status: "Active", progress: 5, created_at: "2026-09-03" }],
        contract_messages: [{ id: "m1", contract_id: CONTRACT, sender_type: "Organization", author: "Acme", body: "Please start with pricing.", created_at: "2026-09-03T01:00:00Z" }],
        contract_deliverables: [],
        contract_milestones: [],
      },
      ...extra,
    });
  }

  it("whoami reports the profile and owned agents", async () => {
    const r = (await TOOLS.find(t=>t.name==="whoami")!.run({}, ctx(seeded()))) as { worker: string; agents: unknown[]; profile: { displayName: string } };
    expect(r.worker).toBe("agentexchange");
    expect(r.agents).toHaveLength(1);
    expect(r.profile.displayName).toBe("AgentExchange Worker");
  });

  it("publish_agent inserts under the worker's own profile and is idempotent on name", async () => {
    const db = seeded();
    const publish = TOOLS.find((t) => t.name === "publish_agent")!;
    const first = (await publish.run({ name: "Hermes Analyst", specialty: "Research", skills: [], availability: "Available", toolAccess: [] } as never, ctx(db))) as { created: boolean };
    expect(first.created).toBe(false);
    const second = (await publish.run({ name: "Hermes Writer", specialty: "Copy", skills: ["copy"], availability: "Available", toolAccess: [] } as never, ctx(db))) as { created: boolean; agent: { owner_id: string } };
    expect(second.created).toBe(true);
    expect(second.agent.owner_id).toBe(PROFILE);
  });

  it("list_hire_requests joins the opportunity so the worker can judge scope", async () => {
    const r = (await TOOLS.find((t) => t.name === "list_hire_requests")!.run({ status: "pending" }, ctx(seeded()))) as { hireRequests: Array<{ opportunity: { success_criteria: string } }> };
    expect(r.hireRequests[0].opportunity.success_criteria).toBe("Three competitors profiled");
  });

  it("respond_to_hire_request accepts through the database RPC and returns the contract", async () => {
    let rpcCalled: unknown = null;
    const db = seeded({
      rpc: (name, args) => {
        rpcCalled = [name, args];
        return { data: { id: CONTRACT, title: "Market scan", organization_name: "Acme", agent_name: "Hermes Analyst", status: "Active", progress: 0 }, error: null };
      },
    });
    const r = (await TOOLS.find((t) => t.name === "respond_to_hire_request")!.run({ hireRequestId: HIRE, decision: "accept" }, ctx(db))) as { ok: boolean; contract: { id: string } };
    expect(r.ok).toBe(true);
    expect(r.contract.id).toBe(CONTRACT);
    expect(rpcCalled).toEqual(["materialize_hire_request_contract", { hire_request_uuid: HIRE }]);
    // A second acceptance finds nothing pending.
    const again = (await TOOLS.find((t) => t.name === "respond_to_hire_request")!.run({ hireRequestId: HIRE, decision: "accept" }, ctx(db))) as { ok: boolean };
    expect(again.ok).toBe(false);
  });

  it("get_contract returns the thread in order and the originating opportunity", async () => {
    const r = (await TOOLS.find((t) => t.name === "get_contract")!.run({ contractId: CONTRACT }, ctx(seeded()))) as { ok: boolean; messages: Array<{ from: string }>; opportunity: { title: string } };
    expect(r.ok).toBe(true);
    expect(r.messages[0].from).toBe("Organization");
    expect(r.opportunity.title).toBe("Market scan");
  });

  it("list_contracts flags contracts whose last word was the organization's", async () => {
    const r = (await TOOLS.find((t) => t.name === "list_contracts")!.run({ status: "Active" }, ctx(seeded()))) as { contracts: Array<{ awaitingReply: boolean; deliverables: number }> };
    expect(r.contracts[0].awaitingReply).toBe(true);
    expect(r.contracts[0].deliverables).toBe(0);
  });

  it("post_message writes as the Agent with the contract's agent name", async () => {
    const db = seeded();
    const r = (await TOOLS.find((t) => t.name === "post_message")!.run({ contractId: CONTRACT, body: "On it." }, ctx(db))) as { ok: boolean };
    expect(r.ok).toBe(true);
    const { data } = await db.from("contract_messages").select("*").eq("contract_id", CONTRACT);
    const rows = data as Array<{ sender_type: string; author: string }>;
    expect(rows.at(-1)).toMatchObject({ sender_type: "Agent", author: "Hermes Analyst" });
  });

  it("submit_deliverable lands as submitted with the work in notes", async () => {
    const db = seeded();
    const r = (await TOOLS.find((t) => t.name === "submit_deliverable")!.run({ contractId: CONTRACT, title: "Pricing scan", notes: "# Findings\n..." }, ctx(db))) as { ok: boolean; deliverable: { status: string } };
    expect(r.ok).toBe(true);
    expect(r.deliverable.status).toBe("submitted");
  });

  it("a database refusal is returned as ok=false and nothing is retried", async () => {
    const db = seeded({ refuseInsert: (table) => (table === "contract_deliverables" ? "new row violates row-level security policy" : null) });
    const r = (await TOOLS.find((t) => t.name === "submit_deliverable")!.run({ contractId: CONTRACT, title: "x", notes: "y" }, ctx(db))) as { ok: boolean; error: string };
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/row-level security/);
    const { data } = await db.from("contract_deliverables").select("*");
    expect(data).toEqual([]);
  });
});

describe("dispatch", () => {
  const env = { supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "anon", paymentsEnabled: false, appUrl: "https://x.test", workers: parseWorkers(JSON.stringify([WORKER, { ...WORKER, name: "idle", mcpKey: KEY + "2", turnUrl: undefined, turnToken: undefined }])) };
  const event = DispatchEventSchema.parse({ event: "contract_created", contractId: CONTRACT });

  it("only forwards to workers the database says are parties, and never sends content", async () => {
    const sent: Array<[string, Record<string, unknown>]> = [];
    const results = await dispatch(
      env,
      event,
      async (w, body) => {
        sent.push([w.name, body]);
        return { status: 202, body: { jobId: "job_1" } };
      },
      async (w) => w.name === "agentexchange",
    );
    expect(results).toEqual([
      { worker: "agentexchange", status: "accepted", jobId: "job_1" },
      { worker: "idle", status: "not_party" },
    ]);
    expect(sent).toHaveLength(1);
    expect(Object.keys(sent[0][1]).sort()).toEqual(["contractId", "dispatchedAt", "event"]);
  });

  it("a party without a runtime is reported, a failing runtime is reported, neither throws", async () => {
    const results = await dispatch(
      env,
      event,
      async () => ({ status: 500, body: null }),
      async () => true,
    );
    expect(results.map((r) => r.status)).toEqual(["failed", "no_runtime"]);
    const thrown = await dispatch(env, event, async () => { throw new Error("ECONNREFUSED"); }, async () => true);
    expect(thrown[0]).toMatchObject({ status: "failed", detail: "ECONNREFUSED" });
  });

  it("rejects events that are not one of the four shapes", () => {
    expect(DispatchEventSchema.safeParse({ event: "contract_created" }).success).toBe(false);
    expect(DispatchEventSchema.safeParse({ event: "delete_everything", contractId: CONTRACT }).success).toBe(false);
  });
});

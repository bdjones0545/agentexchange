import { describe, expect, it } from "vitest";
import { GATE_QUESTIONS, GATE_THRESHOLDS, decide, gateState, jevEvaluator, type GateAnswers } from "../server/gate/deliverableGate";
import { TOOLS, type ToolContext } from "../server/mcp/tools";
import { fakeDb } from "./fakeSupabase";

const PROFILE = "11111111-1111-4111-8111-111111111111";
const AGENT = "33333333-3333-4333-8333-333333333333";
const CONTRACT = "44444444-4444-4444-8444-444444444444";
const HIRE = "55555555-5555-4555-8555-555555555555";
const OPP = "66666666-6666-4666-8666-666666666666";
const NOW = "2026-09-20T00:00:00.000Z";

const good: GateAnswers = { satisfiesBrief: 0.97, complete: 0.95, unsupportedClaims: 0.1, quality: 2.6 };
const thin: GateAnswers = { satisfiesBrief: 0.55, complete: 0.4, unsupportedClaims: 0.2, quality: 1.1 };

function seeded(extra?: Partial<Parameters<typeof fakeDb>[0]>) {
  return fakeDb({
    tables: {
      profiles: [{ id: PROFILE, display_name: "AgentExchange Worker" }],
      agents: [{ id: AGENT, owner_id: PROFILE, name: "Hermes Analyst" }],
      hire_requests: [{ id: HIRE, agent_id: AGENT, opportunity_id: OPP, status: "accepted" }],
      opportunities: [{ id: OPP, title: "Market scan", category: "Research", description: "Profile the top youth strength programs.", success_criteria: "Three competitors profiled with pricing", required_skills: ["research"] }],
      contracts: [{ id: CONTRACT, agent_id: AGENT, source_type: "hire-request", source_id: HIRE, organization_name: "Acme", agent_name: "Hermes Analyst", title: "Market scan", status: "Active", progress: 5, created_at: "2026-09-03" }],
      contract_deliverables: [],
      deliverable_gate_events: [],
    },
    ...extra,
  });
}
const submit = TOOLS.find((t) => t.name === "submit_deliverable")!;
function ctx(db: ReturnType<typeof fakeDb>, gate: ToolContext["gate"], now = NOW): ToolContext {
  return { open: async () => ({ db, profileId: PROFILE }), worker: "agentexchange", now: () => now, paymentsEnabled: false, gate };
}
type Out = { ok: boolean; error?: string; gate: { verdict: string; attempt: number; flags: string[] }; deliverable?: { status: string } };

describe("gate decision rules", () => {
  it("passes when both brief-fit and completeness clear the threshold", () => {
    const r = decide(good, 0, () => NOW);
    expect(r.verdict).toBe("passed");
    expect(r.flags).toEqual([]);
    expect(r.attempt).toBe(1);
  });
  it("returns thin work with actionable flags", () => {
    const r = decide(thin, 0, () => NOW);
    expect(r.verdict).toBe("returned");
    expect(r.flags.join(" ")).toMatch(/satisfies the brief: 55%/);
    expect(r.flags.join(" ")).toMatch(/complete, self-contained work: 40%/);
  });
  it("moderately unsupported specifics are a flag on a pass, not a block", () => {
    const r = decide({ ...good, unsupportedClaims: 0.6 }, 0, () => NOW);
    expect(r.verdict).toBe("passed");
    expect(r.flags).toHaveLength(1);
    expect(r.flags[0]).toMatch(/unsupported specifics: 60%/);
  });
  it("invented figures block even when the work is otherwise complete (the calibration case)", () => {
    const r = decide({ satisfiesBrief: 0.9, complete: 0.79, unsupportedClaims: 0.94, quality: 2.02 }, 0, () => NOW);
    expect(r.verdict).toBe("returned");
    expect(r.flags).toHaveLength(1);
    expect(r.flags[0]).toMatch(/unsupported specifics: 94%.*needs below 85%/);
  });
  it("the calibration samples land where the thresholds say", () => {
    const v = (a: GateAnswers) => decide(a, 0, () => NOW).verdict;
    expect(v({ satisfiesBrief: 0.91, complete: 0.82, unsupportedClaims: 0.47, quality: 2.1 })).toBe("passed");
    expect(v({ satisfiesBrief: 0.04, complete: 0.06, unsupportedClaims: 0.63, quality: 0.94 })).toBe("returned");
    expect(v({ satisfiesBrief: 0.03, complete: 0.02, unsupportedClaims: 0.08, quality: 0.37 })).toBe("returned");
  });
  it(`accepts with flags after ${GATE_THRESHOLDS.maxReturns} returns so a contract can never get stuck`, () => {
    expect(decide(thin, GATE_THRESHOLDS.maxReturns - 1, () => NOW).verdict).toBe("returned");
    const r = decide(thin, GATE_THRESHOLDS.maxReturns, () => NOW);
    expect(r.verdict).toBe("accepted_with_flags");
    expect(r.attempt).toBe(GATE_THRESHOLDS.maxReturns + 1);
    expect(r.flags.length).toBeGreaterThan(0);
  });
  it("no answers means unavailable, which accepts", () => {
    expect(decide(null, 0, () => NOW)).toMatchObject({ verdict: "unavailable", answers: null });
  });
  it("exactly at threshold passes", () => {
    expect(decide({ ...good, satisfiesBrief: GATE_THRESHOLDS.pass, complete: GATE_THRESHOLDS.pass }, 0, () => NOW).verdict).toBe("passed");
  });
});

describe("submit_deliverable through the gate", () => {
  it("resubmits the sole rejected draft instead of leaving an unapprovable old version", async () => {
    const db=seeded();
    await db.from("contract_deliverables").insert({id:HIRE,contract_id:CONTRACT,status:"draft",notes:"old",decisions:[{status:"rejected",note:"shorten"}]});
    const r=await submit.run({contractId:CONTRACT,title:"Revision",notes:"Revised work"},ctx(db,async()=>good)) as Out;
    expect(r.ok).toBe(true);
    const {data}=await db.from("contract_deliverables").select("*");
    expect(data).toHaveLength(1);
    expect(data).toMatchObject([{id:HIRE,status:"submitted",notes:"Revised work",decisions:[{status:"rejected",note:"shorten"}]}]);
  });
  it("refuses to replace a submitted or approved deliverable", async () => {
    const db=seeded();
    await db.from("contract_deliverables").insert({id:HIRE,contract_id:CONTRACT,status:"approved",notes:"accepted"});
    const r=await submit.run({contractId:CONTRACT,deliverableId:HIRE,title:"Replacement",notes:"Changed"},ctx(db,async()=>good)) as Out;
    expect(r.ok).toBe(false);
  });
  it("a passing deliverable lands as submitted, stamped with its gate, and the event is recorded", async () => {
    const db = seeded();
    const seen: unknown[] = [];
    const r = (await submit.run({ contractId: CONTRACT, title: "Scan v1", notes: "# Three competitors\n..." }, ctx(db, async (i) => { seen.push(i); return good; }))) as Out;
    expect(r.ok).toBe(true);
    expect(r.deliverable?.status).toBe("submitted");
    expect(r.gate.verdict).toBe("passed");
    // The evaluator saw the brief the contract came from, not just the title.
    expect(seen[0]).toMatchObject({ brief: { contractTitle: "Market scan", successCriteria: "Three competitors profiled with pricing", requiredSkills: ["research"] }, title: "Scan v1" });
    const { data: rows } = await db.from("contract_deliverables").select("*");
    expect(rows).toHaveLength(1);
    expect((rows as Array<{ gate: { verdict: string } }>)[0].gate.verdict).toBe("passed");
    const { data: events } = await db.from("deliverable_gate_events").select("*");
    expect(events).toHaveLength(1);
    expect(events).toMatchObject([{ verdict: "passed", attempt: 1, contract_id: CONTRACT, worker_profile_id: PROFILE }]);
    const { data: c } = await db.from("contracts").select("status").eq("id", CONTRACT).single();
    expect(c).toMatchObject({ status: "In Review" });
  });

  it("thin work is returned: no deliverable row, contract untouched, the worker is told what to fix", async () => {
    const db = seeded();
    const r = (await submit.run({ contractId: CONTRACT, title: "Scan v1", notes: "Plan: I will profile three competitors next." }, ctx(db, async () => thin))) as Out;
    expect(r.ok).toBe(false);
    expect(r.gate.verdict).toBe("returned");
    expect(r.error).toMatch(/Quality gate returned this deliverable \(attempt 1; 2 more returns/);
    expect(r.error).toMatch(/Nothing was submitted/);
    expect((await db.from("contract_deliverables").select("*")).data).toEqual([]);
    expect((await db.from("contracts").select("status").eq("id", CONTRACT).single()).data).toMatchObject({ status: "Active" });
    expect((await db.from("deliverable_gate_events").select("*")).data).toMatchObject([{ verdict: "returned", attempt: 1 }]);
  });

  it("counts returns per contract and accepts with flags on the third try", async () => {
    const db = seeded();
    const t = (n: number) => `2026-09-20T00:0${n}:00.000Z`;
    const first = (await submit.run({ contractId: CONTRACT, title: "v1", notes: "thin" }, ctx(db, async () => thin, t(1)))) as Out;
    const second = (await submit.run({ contractId: CONTRACT, title: "v2", notes: "thin" }, ctx(db, async () => thin, t(2)))) as Out;
    const third = (await submit.run({ contractId: CONTRACT, title: "v3", notes: "thin" }, ctx(db, async () => thin, t(3)))) as Out;
    expect([first.gate, second.gate, third.gate].map((g) => [g.verdict, g.attempt])).toEqual([["returned", 1], ["returned", 2], ["accepted_with_flags", 3]]);
    expect(third.ok).toBe(true);
    expect(third.deliverable?.status).toBe("submitted");
    // A fresh submission after work landed starts counting again.
    const fourth = (await submit.run({ contractId: CONTRACT, title: "v4", notes: "thin" }, ctx(db, async () => thin, t(4)))) as Out;
    expect(fourth.gate).toMatchObject({ verdict: "returned", attempt: 1 });
  });

  it("no evaluator configured: accepted and stamped unavailable", async () => {
    const db = seeded();
    const r = (await submit.run({ contractId: CONTRACT, title: "v1", notes: "work" }, ctx(db, null))) as Out;
    expect(r.ok).toBe(true);
    expect(r.gate.verdict).toBe("unavailable");
  });

  it("evaluator failure is fail-open: accepted and stamped unavailable", async () => {
    const db = seeded();
    const r = (await submit.run({ contractId: CONTRACT, title: "v1", notes: "work" }, ctx(db, async () => { throw new Error("jev 503"); }))) as Out;
    expect(r.ok).toBe(true);
    expect(r.gate.verdict).toBe("unavailable");
  });

  it("gate column not yet migrated: the deliverable still lands", async () => {
    let attempts = 0;
    const db = seeded({ refuseInsert: (table, row) => (table === "contract_deliverables" && "gate" in row && attempts++ === 0 ? 'column "gate" of relation "contract_deliverables" does not exist' : null) });
    const r = (await submit.run({ contractId: CONTRACT, title: "v1", notes: "work" }, ctx(db, async () => good))) as Out;
    expect(r.ok).toBe(true);
    expect((await db.from("contract_deliverables").select("*")).data).toHaveLength(1);
  });

  it("an invisible contract is refused before any evaluation happens", async () => {
    const db = seeded();
    let called = 0;
    const r = (await submit.run({ contractId: "99999999-9999-4999-8999-999999999999", title: "v1", notes: "work" }, ctx(db, async () => { called++; return good; }))) as Out;
    expect(r.ok).toBe(false);
    expect(called).toBe(0);
  });
});

describe("jev evaluator wire format", () => {
  it("returns null without a key", () => {
    expect(jevEvaluator(undefined)).toBeNull();
    expect(jevEvaluator("  ")).toBeNull();
  });
  it("sends the gateway the documented headers, state and questions, and maps the answers", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), init: init! };
      return new Response(JSON.stringify({ answers: { satisfies_brief: { type: "boolean", probability: 0.93 }, complete: { type: "boolean", probability: 0.91 }, unsupported_claims: { type: "boolean", probability: 0.05 }, quality: { type: "score", score: 2.4 } } }), { status: 200 });
    }) as typeof fetch;
    const ev = jevEvaluator("vck_test", fetchImpl)!;
    const input = { brief: { contractTitle: "Market scan", successCriteria: "Three competitors" }, title: "v1", notes: "# body" };
    const a = await ev(input);
    expect(a).toEqual({ satisfiesBrief: 0.93, complete: 0.91, unsupportedClaims: 0.05, quality: 2.4 });
    const { url, init } = captured!;
    expect(url).toBe("https://ai-gateway.vercel.sh/v4/ai/evaluation-model");
    const h = init.headers as Record<string, string>;
    expect(h["ai-model-id"]).toBe("typesafe-ai/jev");
    expect(h["ai-gateway-protocol-version"]).toBe("0.0.1");
    expect(h["ai-evaluation-model-specification-version"]).toBe("4");
    expect(h.authorization).toBe("Bearer vck_test");
    const body = JSON.parse(String(init.body));
    expect(body.state).toEqual(gateState(input));
    expect(body.questions).toEqual(GATE_QUESTIONS);
    expect(Object.keys(body.questions).sort()).toEqual(["complete", "quality", "satisfies_brief", "unsupported_claims"]);
  });
  it("a non-2xx or malformed answer throws so the tool can fail open", async () => {
    const bad = jevEvaluator("k", (async () => new Response("nope", { status: 500 })) as typeof fetch)!;
    await expect(bad({ brief: { contractTitle: "x" }, title: "t", notes: "n" })).rejects.toThrow(/jev 500/);
    const partial = jevEvaluator("k", (async () => new Response(JSON.stringify({ answers: {} }), { status: 200 })) as typeof fetch)!;
    await expect(partial({ brief: { contractTitle: "x" }, title: "t", notes: "n" })).rejects.toThrow(/missing answer/);
  });
});

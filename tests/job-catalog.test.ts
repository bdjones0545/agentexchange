import { describe, expect, it } from "vitest";

import {
  JOB_CATEGORIES,
  JOB_KINDS,
  JOB_KIND_PATTERN,
  LIMITS,
  PLATFORM_RULES,
  briefTemplate,
  buyerVoice,
  cleanLimits,
  jobGuide,
  jobKind,
  jobKindsByCategory,
  limitRules,
  pricingOf,
} from "../src/lib/jobCatalog";
import { accessSteps } from "../src/lib/managedService";
import { GATE_QUESTIONS, decide, gateQuestions, type Brief } from "../server/gate/deliverableGate";
import { TOOLS, type ToolContext } from "../server/mcp/tools";
import { fakeDb } from "./fakeSupabase";

describe("the job catalog", () => {
  it("gives every kind a unique, database-safe id and a complete definition", () => {
    const ids = JOB_KINDS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const kind of JOB_KINDS) {
      expect(kind.id, kind.id).toMatch(JOB_KIND_PATTERN);
      expect(JOB_CATEGORIES as readonly string[], kind.id).toContain(kind.category);
      expect(kind.label.length, kind.id).toBeGreaterThan(2);
      expect(kind.inputs.length, kind.id).toBeGreaterThan(0);
      expect(kind.steps.length, kind.id).toBeGreaterThan(0);
      expect(kind.deliverable.length, kind.id).toBeGreaterThan(10);
      expect(kind.evidence.length, kind.id).toBeGreaterThan(0);
      for (const limit of kind.limits) expect(Object.keys(LIMITS), kind.id).toContain(limit);
    }
  });

  it("covers one-off and weekly work across the marketplace", () => {
    expect(JOB_KINDS.filter((k) => k.family === "deliverable").length).toBeGreaterThanOrEqual(10);
    expect(JOB_KINDS.filter((k) => k.family === "managed_service").length).toBeGreaterThanOrEqual(10);
    for (const id of ["customer_support", "sales_outreach", "paid_ads", "software_task", "bookkeeping"]) expect(jobKind(id), id).not.toBeNull();
    expect(jobKindsByCategory("managed_service").every((g) => g.kinds.every((k) => k.family === "managed_service"))).toBe(true);
  });

  it("keeps weekly checklists within the database's bounds (10 items, 6000 bytes)", () => {
    for (const kind of JOB_KINDS.filter((k) => k.family === "managed_service")) {
      expect(kind.steps.length, kind.id).toBeLessThanOrEqual(10);
      expect(new TextEncoder().encode(JSON.stringify(kind.steps)).length, kind.id).toBeLessThanOrEqual(6000);
      expect(kind.steps[0].notes, kind.id).toMatch(/Nothing .* until you approve it|submits/);
    }
  });

  it("has real access steps for every platform it names", () => {
    const fallback = (p: string) => `Invite the agent's operator through ${p}'s own user or partner settings, with the least access the work needs.`;
    for (const platform of new Set(JOB_KINDS.flatMap((k) => k.platforms))) {
      expect(accessSteps(platform), platform).not.toBe(fallback(platform));
    }
  });

  it("prices one-off work as fixed and managed services weekly, and tells the agent how it is paid", () => {
    const report = jobKind("research_report")!;
    const support = jobKind("customer_support")!;
    expect(pricingOf(report)).toBe("fixed");
    expect(pricingOf(support)).toBe("weekly");
    const guide = jobGuide(support);
    expect(guide.rules.slice(0, PLATFORM_RULES.length)).toEqual(PLATFORM_RULES);
    expect(guide.rules.join(" ")).toMatch(/AI assistant/);
    expect(guide.limits).toEqual([{ key: "refundLimitCents", label: "Refund or credit limit per customer" }]);
    expect(guide.howYouArePaid).toMatch(/15% platform fee/);
    expect(jobGuide(report).howYouArePaid).toMatch(/One fixed price/);
  });

  it("reads briefs saved before the catalog", () => {
    expect(jobKind("other")?.id).toBe("other_managed");
    expect(jobKind("nope")).toBeNull();
    expect(jobKind(null)).toBeNull();
  });

  it("addresses the buyer directly on their own screens", () => {
    expect(buyerVoice(jobKind("customer_support")!.summary)).toBe("Answer your customers by email, chat or phone, in your own helpdesk.");
  });

  it("builds a brief template and cleans limits to what the job allows", () => {
    expect(briefTemplate(jobKind("lead_list")!)).toMatch(/^Ideal customer profile/);
    expect(cleanLimits(jobKind("customer_support")!, { refundLimitCents: 2500, adSpendCapCents: 9000, dailySendCap: -1 })).toEqual({ refundLimitCents: 2500 });
    expect(limitRules({ refundLimitCents: 2500, dailySendCap: 40 })).toEqual([
      "Never refund, credit or discount more than $25 for one customer; escalate anything larger.",
      "Send at most 40 messages a day.",
    ]);
  });
});

// ---- Agent tools and the gate on catalog jobs ---------------------------------

describe("agent tools on the job catalog", () => {
  const PROFILE = "11111111-1111-4111-8111-111111111111";
  const AGENT = "33333333-3333-4333-8333-333333333333";
  const OTHER_AGENT = "34343434-3434-4434-8434-343434343434";
  const CONTRACT = "44444444-4444-4444-8444-444444444444";
  const now = () => "2026-10-15T00:00:00.000Z";
  const run = (name: string, input: unknown, ctx: ToolContext) => TOOLS.find((t) => t.name === name)!.run(input as never, ctx) as Promise<Record<string, any>>;

  function db() {
    return fakeDb({
      tables: {
        agents: [
          { id: AGENT, owner_id: PROFILE, name: "Maria", job_kinds: [] },
          { id: OTHER_AGENT, owner_id: "99999999-9999-4999-8999-999999999999", name: "Someone else", job_kinds: [] },
        ],
        organizations: [],
        opportunities: [
          { id: "o1", title: "Support our store", status: "open", work_type: "managed_service", job_kind: "customer_support", service_kind: "customer_support", service_platforms: ["Gorgias"], service_weeks: 4, service_limits: { refundLimitCents: 2500 }, created_at: "2026-10-02" },
          { id: "o2", title: "Competitor scan", status: "open", work_type: "deliverable", job_kind: "research_report", created_at: "2026-10-01" },
        ],
        contracts: [{ id: CONTRACT, agent_id: AGENT, source_type: "application", source_id: "a1", title: "Competitor scan", status: "Active", currency: "USD", job_kind: "research_report", service_terms: null }],
        contract_messages: [],
        contract_deliverables: [],
        contract_milestones: [],
        deliverable_gate_events: [],
      },
    });
  }
  function ctx(database: ReturnType<typeof fakeDb>, gate?: ToolContext["gate"]): ToolContext {
    return { open: async () => ({ db: database, profileId: PROFILE }), worker: "agentexchange", now, paymentsEnabled: false, gate };
  }

  it("list_job_kinds and get_job_guide tell an agent what the work is and how it is paid", async () => {
    const weekly = await run("list_job_kinds", { family: "managed_service" }, ctx(db()));
    expect(weekly.jobKinds.every((k: { pricing: string }) => k.pricing === "weekly")).toBe(true);
    expect(weekly.jobKinds.map((k: { id: string }) => k.id)).toContain("customer_support");
    const guide = await run("get_job_guide", { jobKind: "customer_support" }, ctx(db()));
    expect(guide.guide.accessSteps[0]).toEqual({ platform: "Zendesk", howBuyersShare: expect.stringMatching(/agent seat/) });
    expect(guide.guide.howYouArePaid).toMatch(/15% platform fee/);
    expect(await run("get_job_guide", { jobKind: "nope" }, ctx(db()))).toEqual({ ok: false, error: "Unknown job kind. See list_job_kinds." });
  });

  it("publish_agent and set_agent_job_kinds record the jobs an agent takes, only for your own agents", async () => {
    const database = db();
    expect(await run("publish_agent", { name: "New", specialty: "Ops", jobKinds: ["bogus"] }, ctx(database))).toMatchObject({ ok: false, error: expect.stringMatching(/Unknown job kinds: bogus/) });
    const created = await run("publish_agent", { name: "Support bot", specialty: "Support", skills: [], availability: "Available", toolAccess: [], jobKinds: ["customer_support", "customer_support"] }, ctx(database));
    expect(created.agent.job_kinds).toEqual(["customer_support"]);
    const set = await run("set_agent_job_kinds", { agentId: AGENT, jobKinds: ["paid_ads", "seo"] }, ctx(database));
    expect(set.agent.job_kinds).toEqual(["paid_ads", "seo"]);
    expect(await run("set_agent_job_kinds", { agentId: OTHER_AGENT, jobKinds: ["seo"] }, ctx(database))).toEqual({ ok: false, error: "Not one of your agents." });
  });

  it("search_opportunities filters by job kind and labels each brief", async () => {
    const r = await run("search_opportunities", { jobKind: "customer_support", limit: 10 }, ctx(db()));
    expect(r.opportunities).toHaveLength(1);
    expect(r.opportunities[0].job).toMatchObject({ id: "customer_support", pricing: "weekly", guide: 'get_job_guide("customer_support")' });
    expect(r.opportunities[0].service.summary).toBe("Customer support · Gorgias · 4 weeks · refunds up to $25 each");
  });

  it("post_opportunity names the job kind, and refuses a weekly kind without its service terms", async () => {
    const database = db();
    const base = { organization: "Acme", title: "Write our launch post", category: "Writing", budgetMinCents: 10000, budgetMaxCents: 20000, duration: "3 days", requiredSkills: [], description: "A launch post for our new product line.", successCriteria: "1200 words, approved voice" };
    expect((await run("post_opportunity", { ...base, jobKind: "content_writing" }, ctx(database))).ok).toBe(true);
    const stored = (await database.from("opportunities").select("*").eq("title", "Write our launch post").maybeSingle()).data as Record<string, unknown>;
    expect(stored).toMatchObject({ work_type: "deliverable", job_kind: "content_writing" });
    expect(await run("post_opportunity", { ...base, title: "Run support", jobKind: "customer_support" }, ctx(database))).toMatchObject({ ok: false, error: expect.stringMatching(/one-off job kind/) });
  });

  it("get_contract and the gate use the contract's job kind", async () => {
    const r = await run("get_contract", { contractId: CONTRACT }, ctx(db()));
    expect(r.job).toMatchObject({ id: "research_report", pricing: "fixed", evidence: expect.arrayContaining(["A source for every figure, price or named fact"]) });
    let seen: Brief | null = null;
    await run("submit_deliverable", { contractId: CONTRACT, title: "Scan", notes: "Findings…" }, ctx(db(), async ({ brief }) => {
      seen = brief;
      return { satisfiesBrief: 0.9, complete: 0.9, unsupportedClaims: 0.1, quality: 2, evidencePresent: 0.2 };
    }));
    expect(seen).toMatchObject({ job: { label: "Research report" } });
  });
});

describe("the gate on catalog jobs", () => {
  const now = () => "2026-10-15T00:00:00.000Z";
  it("adds the evidence check without changing the calibrated questions", () => {
    const q = gateQuestions({ contractTitle: "Scan", job: { label: "Research report", deliverable: "d", evidence: ["sources"] } });
    expect(q).toHaveProperty("evidence_present");
    expect(q.satisfies_brief).toBe(GATE_QUESTIONS.satisfies_brief);
    expect(q.complete).toBe(GATE_QUESTIONS.complete);
  });

  it("flags missing evidence to the organization but does not return the work for it", () => {
    const r = decide({ satisfiesBrief: 0.9, complete: 0.9, unsupportedClaims: 0.1, quality: 2, evidencePresent: 0.2 }, 0, now);
    expect(r.verdict).toBe("passed");
    expect(r.flags).toEqual(["missing evidence: 20% — include what this kind of job is checked for (get_job_guide lists it)"]);
  });
});

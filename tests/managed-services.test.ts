import { describe, expect, it } from "vitest";

import {
  GATE_QUESTIONS,
  SERVICE_GATE_QUESTIONS,
  decide,
  gateQuestions,
  gateState,
  type Brief,
  type GateAnswers,
} from "../server/gate/deliverableGate";
import { TOOLS, type ToolContext } from "../server/mcp/tools";
import {
  accessSteps,
  agentRules,
  buyerStages,
  renewalCheck,
  serviceBriefColumns,
  serviceBriefFromRow,
  serviceSummary,
  serviceTermsFromJson,
  validateServiceBrief,
  weekStages,
  type ServiceTerms,
} from "../src/lib/managedService";
import { fakeDb } from "./fakeSupabase";

const ads: ServiceTerms = {
  kind: "paid_ads",
  platforms: ["Meta Ads", "Google Ads"],
  adSpendCapCents: 50000,
  weeks: 4,
  week: 1,
  opportunityId: "66666666-6666-4666-8666-666666666666",
  renewedFrom: null,
  checklist: [],
  limits: { adSpendCapCents: 50000 },
};
const now = () => "2026-10-15T00:00:00.000Z";

describe("managed-service terms", () => {
  it("reads a brief row and ignores deliverable or malformed rows", () => {
    expect(
      serviceBriefFromRow({ work_type: "managed_service", service_kind: "seo", service_platforms: ["WordPress", 3], ad_spend_cap_cents: null, service_weeks: 6 }),
    ).toEqual({ kind: "seo", platforms: ["WordPress"], adSpendCapCents: null, weeks: 6, limits: {} });
    expect(serviceBriefFromRow({ work_type: "deliverable", service_kind: "seo", service_weeks: 6 })).toBeNull();
    expect(serviceBriefFromRow({ work_type: "managed_service", service_kind: "crypto", service_weeks: 6 })).toBeNull();
    expect(serviceBriefFromRow({ work_type: "managed_service", service_kind: "seo" })).toBeNull();
  });

  it("reads the terms the database froze on a contract", () => {
    expect(serviceTermsFromJson({ kind: "paid_ads", platforms: ["Meta Ads"], adSpendCapCents: 50000, weeks: 4, week: 2, opportunityId: "o1", renewedFrom: "c1" })).toEqual({
      kind: "paid_ads", platforms: ["Meta Ads"], adSpendCapCents: 50000, weeks: 4, week: 2, opportunityId: "o1", renewedFrom: "c1",
      checklist: [], limits: { adSpendCapCents: 50000 },
    });
    expect(
      serviceTermsFromJson({ kind: "customer_support", platforms: ["Zendesk"], weeks: 4, week: 1, limits: { refundLimitCents: 2500, junk: 1 }, checklist: [{ title: "Playbook approved", notes: "n" }, { notes: "untitled" }] }),
    ).toMatchObject({ adSpendCapCents: null, limits: { refundLimitCents: 2500 }, checklist: [{ title: "Playbook approved", notes: "n" }] });
    expect(serviceTermsFromJson(null)).toBeNull();
    expect(serviceTermsFromJson([1, 2])).toBeNull();
    expect(serviceTermsFromJson({ kind: "paid_ads" })).toBeNull();
  });

  it("writes brief columns, dropping a spend cap the kind cannot have", () => {
    expect(serviceBriefColumns(null)).toEqual({ work_type: "deliverable" });
    expect(serviceBriefColumns({ kind: "seo", platforms: ["Shopify"], adSpendCapCents: 9000, weeks: 3 })).toMatchObject({
      work_type: "managed_service", job_kind: "seo", service_kind: "seo", service_platforms: ["Shopify"], ad_spend_cap_cents: null, service_weeks: 3, service_limits: {},
    });
    expect(serviceBriefColumns(null, "research_report")).toEqual({ work_type: "deliverable", job_kind: "research_report" });
    const support = serviceBriefColumns({ kind: "customer_support", platforms: ["Zendesk"], adSpendCapCents: 5000, weeks: 4, limits: { refundLimitCents: 2500, dailySendCap: 9 } });
    expect(support).toMatchObject({ ad_spend_cap_cents: null, service_limits: { refundLimitCents: 2500 } });
    expect((support as { service_checklist: Array<{ title: string }> }).service_checklist.map((s) => s.title)).toEqual(["Playbook approved", "Go-live reviewed"]);
  });

  it("validates the brief form", () => {
    expect(validateServiceBrief({ kind: "paid_ads", platforms: ["Meta Ads"], adSpendCapCents: 50000, weeks: 4 })).toEqual([]);
    expect(validateServiceBrief({ kind: "paid_ads", platforms: [], adSpendCapCents: null, weeks: 0 })).toEqual([
      "Choose between 1 and 52 weeks.",
      "Pick at least one platform you will share access to.",
      "Set a weekly ad-spend cap.",
    ]);
    expect(validateServiceBrief({ kind: "other", platforms: [], adSpendCapCents: null, weeks: 2 })).toEqual([]);
  });

  it("summarises the service in one line", () => {
    expect(serviceSummary(ads)).toBe("Paid ads · Meta Ads, Google Ads · 4 weeks · ad spend up to $500 a week");
    expect(serviceSummary({ kind: "seo", platforms: [], adSpendCapCents: null, weeks: 1 })).toBe("SEO · 1 week");
  });

  it("gives platform access steps, with a safe default for unknown platforms", () => {
    expect(accessSteps("Meta Ads")).toMatch(/Partner/);
    expect(accessSteps("Acme CRM")).toBe("Invite the agent's operator through Acme CRM's own user or partner settings, with the least access the work needs.");
  });

  it("lays out week 1 as access → plan → launch → report, and later weeks as the report", () => {
    expect(weekStages(ads)).toHaveLength(4);
    expect(weekStages(ads)[1]).toMatch(/nothing goes live/);
    expect(weekStages({ ...ads, week: 3 })).toEqual(["submit the week 3 of 4 report: spend, results and next steps, with links the buyer can check"]);
    expect(buyerStages(ads)[0]).toMatch(/Share access/);
    expect(buyerStages({ ...ads, week: 2 })).toHaveLength(1);
  });

  it("tells the agent the spend cap only when there is one", () => {
    expect(agentRules(ads).join(" ")).toMatch(/at or under \$500 a week/);
    expect(agentRules({ ...ads, kind: "seo", adSpendCapCents: null }).join(" ")).not.toMatch(/Ad spend/);
  });

  it("mirrors the database's renewal rule", () => {
    expect(renewalCheck({ serviceTerms: null })).toEqual({ ok: false, reason: "Only a managed service renews week by week." });
    expect(renewalCheck({ serviceTerms: ads, paymentStatus: "unfunded", status: "Active" })).toEqual({ ok: false, reason: "Fund this week before starting the next one." });
    expect(renewalCheck({ serviceTerms: ads, paymentStatus: "authorized", status: "Disputed" })).toMatchObject({ ok: false });
    expect(renewalCheck({ serviceTerms: { ...ads, week: 4 }, paymentStatus: "paid_out", status: "Completed" })).toEqual({ ok: false, reason: "This was the last of the 4 agreed weeks." });
    expect(renewalCheck({ serviceTerms: ads, paymentStatus: "captured", status: "Completed" })).toEqual({ ok: true, nextWeek: 2 });
  });
});

describe("the quality gate on a managed service", () => {
  const brief: Brief = { contractTitle: "Run our Meta ads", title: "Run our Meta ads", successCriteria: "CPA under $40", service: ads };
  const good: GateAnswers = { satisfiesBrief: 0.9, complete: 0.85, unsupportedClaims: 0.1, quality: 2.4 };

  it("keeps the calibrated questions for document briefs", () => {
    expect(gateQuestions({ contractTitle: "Memo" })).toBe(GATE_QUESTIONS);
    expect(gateState({ brief: { contractTitle: "Memo" }, title: "t", notes: "n" }).brief).not.toHaveProperty("service");
  });

  it("asks stage-aware questions, plus the limits check only when there are limits", () => {
    const withCap = gateQuestions(brief);
    expect(withCap).toHaveProperty("exceeds_limits");
    expect(withCap.complete).toBe(SERVICE_GATE_QUESTIONS.complete);
    expect(gateQuestions({ ...brief, service: { ...ads, adSpendCapCents: null, limits: {} } })).toBe(SERVICE_GATE_QUESTIONS);
    expect(gateQuestions({ ...brief, service: { ...ads, kind: "customer_support", adSpendCapCents: null, limits: { refundLimitCents: 2500 } } })).toHaveProperty("exceeds_limits");
    expect(gateState({ brief, title: "Plan", notes: "..." }).brief).toMatchObject({
      service: { kind: "Paid ads", weeklyAdSpendCap: "$500 a week", week: 1, stagesThisWeek: ["plan to approve", "launch record", "weekly report"] },
    });
  });

  it("returns work that goes over a limit", () => {
    const r = decide({ ...good, exceedsLimits: 0.9 }, 0, now, { service: true });
    expect(r.verdict).toBe("returned");
    expect(r.flags.join(" ")).toMatch(/over a limit/);
    expect(decide({ ...good, exceedsLimits: 0.2 }, 0, now, { service: true }).verdict).toBe("passed");
  });

  it("does not tell a managed-service agent that a plan is not work", () => {
    const r = decide({ ...good, complete: 0.3 }, 0, now, { service: true });
    expect(r.flags.join(" ")).toMatch(/plan ready to approve/);
    expect(decide({ ...good, complete: 0.3 }, 0, now).flags.join(" ")).toMatch(/not a plan/);
  });
});

describe("agent tools on a managed-service week", () => {
  const PROFILE = "11111111-1111-4111-8111-111111111111";
  const AGENT = "33333333-3333-4333-8333-333333333333";
  const WEEK1 = "44444444-4444-4444-8444-444444444444";
  const WEEK2 = "45454545-4545-4545-8545-454545454545";
  const OPP = "66666666-6666-4666-8666-666666666666";

  function db() {
    return fakeDb({
      tables: {
        agents: [{ id: AGENT, owner_id: PROFILE, name: "Maria" }],
        opportunities: [{ id: OPP, title: "Run our Meta ads", category: "Marketing", success_criteria: "CPA under $40", work_type: "managed_service", service_kind: "paid_ads", service_platforms: ["Meta Ads"], ad_spend_cap_cents: 50000, service_weeks: 4, status: "open", created_at: "2026-10-01" }],
        contracts: [
          { id: WEEK1, agent_id: AGENT, source_type: "application", source_id: "a1", title: "Run our Meta ads", status: "Completed", currency: "USD", service_terms: { ...ads, week: 1 } },
          { id: WEEK2, agent_id: AGENT, source_type: "renewal", source_id: WEEK1, title: "Run our Meta ads · week 2", status: "Active", currency: "USD", service_terms: { ...ads, week: 2, renewedFrom: WEEK1 } },
        ],
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

  it("get_contract gives a renewal week its brief, this week's steps and the rules", async () => {
    const r = (await TOOLS.find((t) => t.name === "get_contract")!.run({ contractId: WEEK2 }, ctx(db()))) as {
      ok: boolean;
      opportunity: { title: string; service: { summary: string } };
      contract: { service: { week: number; thisWeek: string[]; rules: string[] } };
    };
    expect(r.ok).toBe(true);
    expect(r.opportunity.title).toBe("Run our Meta ads");
    expect(r.opportunity.service.summary).toBe("Paid ads · Meta Ads · 4 weeks · ad spend up to $500 a week");
    expect(r.contract.service.week).toBe(2);
    expect(r.contract.service.thisWeek).toEqual(["submit the week 2 of 4 report: spend, results and next steps, with links the buyer can check"]);
    expect(r.contract.service.rules.join(" ")).toMatch(/Never ask for a password/);
  });

  it("post_opportunity stores a valid managed service and refuses an incomplete one", async () => {
    const database = db();
    const post = TOOLS.find((t) => t.name === "post_opportunity")!;
    const base = { organization: "Acme", title: "Run our Google ads", category: "Marketing", budgetMinCents: 30000, budgetMaxCents: 60000, duration: "4 weeks", requiredSkills: [], description: "Manage our Google Ads search campaigns.", successCriteria: "CPA under $40 by week 4" };
    const bad = (await post.run({ ...base, service: { kind: "paid_ads", platforms: [], adSpendCapCents: null, weeks: 4 } } as never, ctx(database))) as { ok: boolean; error: string };
    expect(bad).toEqual({ ok: false, error: "Pick at least one platform you will share access to. Set a weekly ad-spend cap." });
    const good = (await post.run({ ...base, service: { kind: "paid_ads", platforms: ["Google Ads"], adSpendCapCents: 70000, weeks: 4 } } as never, ctx(database))) as { ok: boolean };
    expect(good.ok).toBe(true);
    const stored = (await database.from("opportunities").select("*").eq("title", "Run our Google ads").maybeSingle()).data as Record<string, unknown>;
    expect(stored).toMatchObject({ work_type: "managed_service", service_kind: "paid_ads", service_platforms: ["Google Ads"], ad_spend_cap_cents: 70000, service_weeks: 4 });
  });

  it("search_opportunities marks managed-service briefs", async () => {
    const r = (await TOOLS.find((t) => t.name === "search_opportunities")!.run({ limit: 5 }, ctx(db()))) as { opportunities: Array<{ service: { kind: string } | null }> };
    expect(r.opportunities[0].service?.kind).toBe("paid_ads");
  });

  it("submit_deliverable gates a renewal week against its brief and the service", async () => {
    let seen: Brief | null = null;
    const gate: ToolContext["gate"] = async ({ brief }) => {
      seen = brief;
      return { satisfiesBrief: 0.9, complete: 0.2, unsupportedClaims: 0.1, quality: 1 };
    };
    const r = (await TOOLS.find((t) => t.name === "submit_deliverable")!.run(
      { contractId: WEEK2, title: "Week 2 report", notes: "Spend $480, 14 leads." },
      ctx(db(), gate),
    )) as { ok: boolean; gate: { verdict: string; flags: string[] } };
    expect(seen).toMatchObject({ title: "Run our Meta ads", successCriteria: "CPA under $40", service: { week: 2, adSpendCapCents: 50000 } });
    expect(r.ok).toBe(false);
    expect(r.gate.verdict).toBe("returned");
    expect(r.gate.flags.join(" ")).toMatch(/complete for its stage/);
  });
});

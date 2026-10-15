import { describe, expect, it } from "vitest";

import {
  GATE_QUESTIONS,
  SERVICE_GATE_QUESTIONS,
  SUPPORT_GATE_QUESTIONS,
  decide,
  gateQuestions,
  gateState,
  jevEvaluator,
  type Brief,
  type GateAnswers,
} from "../server/gate/deliverableGate";
import { TOOLS, type ToolContext } from "../server/mcp/tools";
import {
  SERVICE_KINDS,
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
};
const now = () => "2026-10-15T00:00:00.000Z";

describe("managed-service terms", () => {
  it("reads a brief row and ignores deliverable or malformed rows", () => {
    expect(
      serviceBriefFromRow({ work_type: "managed_service", service_kind: "seo", service_platforms: ["WordPress", 3], ad_spend_cap_cents: null, service_weeks: 6 }),
    ).toEqual({ kind: "seo", platforms: ["WordPress"], adSpendCapCents: null, weeks: 6 });
    expect(serviceBriefFromRow({ work_type: "deliverable", service_kind: "seo", service_weeks: 6 })).toBeNull();
    expect(serviceBriefFromRow({ work_type: "managed_service", service_kind: "crypto", service_weeks: 6 })).toBeNull();
    expect(serviceBriefFromRow({ work_type: "managed_service", service_kind: "seo" })).toBeNull();
  });

  it("reads the terms the database froze on a contract", () => {
    expect(serviceTermsFromJson({ kind: "paid_ads", platforms: ["Meta Ads"], adSpendCapCents: 50000, weeks: 4, week: 2, opportunityId: "o1", renewedFrom: "c1" })).toEqual({
      kind: "paid_ads", platforms: ["Meta Ads"], adSpendCapCents: 50000, weeks: 4, week: 2, opportunityId: "o1", renewedFrom: "c1",
    });
    expect(serviceTermsFromJson(null)).toBeNull();
    expect(serviceTermsFromJson([1, 2])).toBeNull();
    expect(serviceTermsFromJson({ kind: "paid_ads" })).toBeNull();
  });

  it("writes brief columns, dropping a spend cap the kind cannot have", () => {
    expect(serviceBriefColumns(null)).toEqual({ work_type: "deliverable" });
    expect(serviceBriefColumns({ kind: "seo", platforms: ["Shopify"], adSpendCapCents: 9000, weeks: 3 })).toEqual({
      work_type: "managed_service", service_kind: "seo", service_platforms: ["Shopify"], ad_spend_cap_cents: null, service_weeks: 3,
    });
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

  it("asks stage-aware questions, plus the spend check only when there is a cap", () => {
    const withCap = gateQuestions(brief);
    expect(withCap).toHaveProperty("exceeds_spend_cap");
    expect(withCap.complete).toBe(SERVICE_GATE_QUESTIONS.complete);
    expect(gateQuestions({ ...brief, service: { ...ads, adSpendCapCents: null } })).toBe(SERVICE_GATE_QUESTIONS);
    expect(gateState({ brief, title: "Plan", notes: "..." }).brief).toMatchObject({
      service: { kind: "Paid ads", weeklyAdSpendCap: "$500 a week", week: 1, stagesThisWeek: ["plan to approve", "launch record", "weekly report"] },
    });
  });

  it("returns work that goes over the weekly ad-spend cap", () => {
    const r = decide({ ...good, exceedsSpendCap: 0.9 }, 0, now, { service: true });
    expect(r.verdict).toBe("returned");
    expect(r.flags.join(" ")).toMatch(/over the ad-spend cap/);
    expect(decide({ ...good, exceedsSpendCap: 0.2 }, 0, now, { service: true }).verdict).toBe("passed");
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

const support: ServiceTerms = {
  kind: "support",
  platforms: ["Gorgias", "Aircall"],
  adSpendCapCents: null,
  weeks: 4,
  week: 1,
  opportunityId: "77777777-7777-4777-8777-777777777777",
  renewedFrom: null,
  support: { channels: ["email", "phone"], hours: "Mon–Fri 9am–6pm ET", weeklyVolume: 300, refundLimitCents: 5000, escalationContact: "Sam Lee, support@acme.test" },
};
const supportRow = {
  work_type: "managed_service",
  service_kind: "support",
  service_platforms: ["Gorgias", "Aircall"],
  ad_spend_cap_cents: null,
  service_weeks: 4,
  support_channels: ["email", "phone", "fax", "email"],
  support_hours: " Mon–Fri 9am–6pm ET ",
  support_weekly_volume: 300,
  refund_limit_cents: 5000,
  escalation_contact: "Sam Lee, support@acme.test",
};

describe("customer support terms", () => {
  it("reads support terms from a brief row and from frozen contract terms", () => {
    expect(serviceBriefFromRow(supportRow)).toEqual({
      kind: "support",
      platforms: ["Gorgias", "Aircall"],
      adSpendCapCents: null,
      weeks: 4,
      support: { channels: ["email", "phone"], hours: "Mon–Fri 9am–6pm ET", weeklyVolume: 300, refundLimitCents: 5000, escalationContact: "Sam Lee, support@acme.test" },
    });
    expect(serviceTermsFromJson({ ...support, support: { ...support.support, refundLimitCents: -5 } })?.support?.refundLimitCents).toBeNull();
    expect(serviceTermsFromJson(support)).toEqual(support);
    // Other kinds never carry support terms, even if the row has some.
    expect(serviceBriefFromRow({ ...supportRow, service_kind: "email" })).not.toHaveProperty("support");
  });

  it("writes support columns only for the support kind, deduplicating channels", () => {
    expect(serviceBriefColumns({ ...support, support: { ...support.support!, channels: ["chat", "chat"], hours: "  24/7 ", escalationContact: " ops@acme.test " } })).toEqual({
      work_type: "managed_service",
      service_kind: "support",
      service_platforms: ["Gorgias", "Aircall"],
      ad_spend_cap_cents: null,
      service_weeks: 4,
      support_channels: ["chat"],
      support_hours: "24/7",
      support_weekly_volume: 300,
      refund_limit_cents: 5000,
      escalation_contact: "ops@acme.test",
    });
    expect(serviceBriefColumns({ kind: "email", platforms: ["Klaviyo"], adSpendCapCents: null, weeks: 2, support: support.support })).not.toHaveProperty("refund_limit_cents");
  });

  it("validates the support brief, accepting a $0 limit", () => {
    expect(validateServiceBrief(support)).toEqual([]);
    expect(validateServiceBrief({ ...support, support: { ...support.support!, refundLimitCents: 0 } })).toEqual([]);
    expect(validateServiceBrief({ kind: "support", platforms: ["Zendesk"], adSpendCapCents: null, weeks: 4 })).toEqual([
      "Pick at least one channel the agent will answer.",
      "Say when the agent answers, for example Mon–Fri 9am–6pm ET.",
      "Estimate how many conversations a week the agent will handle.",
      "Set the most the agent may refund or credit one customer ($0 if it may not).",
      "Name who the agent escalates to.",
    ]);
    expect(validateServiceBrief({ ...support, support: { ...support.support!, hours: "x".repeat(161), escalationContact: "y".repeat(201) } })).toEqual([
      "Keep the coverage hours to 160 characters.",
      "Keep the escalation contact to 200 characters.",
    ]);
  });

  it("summarises channels and the authority limit", () => {
    expect(serviceSummary(support)).toBe("Customer support · Gorgias, Aircall · 4 weeks · email and phone · refunds or credits up to $50 per customer");
    expect(serviceSummary({ ...support, platforms: [], support: { ...support.support!, channels: ["email", "chat", "phone"], refundLimitCents: 0 } })).toBe(
      "Customer support · 4 weeks · email, chat and phone · no refunds or credits",
    );
  });

  it("gives least-privilege access steps for every support platform, never a password", () => {
    for (const platform of SERVICE_KINDS.support.platforms) {
      const steps = accessSteps(platform);
      expect(steps, platform).not.toMatch(/^Invite the agent's operator through/);
      expect(steps, platform).not.toMatch(/\b(share|send|give)( (us|them|the operator))? (your|the) password\b/i);
    }
    expect(accessSteps("Zendesk")).toMatch(/not an admin/);
    expect(accessSteps("Gmail")).toMatch(/delegate/);
    for (const phone of ["Aircall", "RingCentral", "Twilio"]) expect(accessSteps(phone)).toMatch(/^Forward/);
    expect(accessSteps("Twilio")).toMatch(/never share your auth token/);
  });

  it("lays out week 1 as access → playbook → go-live review → report", () => {
    const stages = weekStages(support);
    expect(stages).toHaveLength(4);
    expect(stages[1]).toMatch(/playbook/);
    expect(stages[2]).toMatch(/Go-live/);
    expect(stages[3]).toMatch(/volume, response time, resolution rate, CSAT, escalations, refunds and credits, and sample transcripts/);
    expect(weekStages({ ...support, week: 2 })).toHaveLength(1);
    expect(buyerStages(support)[1]).toMatch(/playbook/);
    expect(buyerStages(support)[2]).toMatch(/tick Go-live/);
  });

  it("tells the agent the authority limit, who to escalate to, and the phone rules", () => {
    const rules = agentRules(support).join("\n");
    expect(rules).toMatch(/customer support service on email and phone, covering Mon–Fri 9am–6pm ET/);
    expect(rules).toMatch(/Never refund, credit or discount more than \$50 to any one customer/);
    expect(rules).toMatch(/Escalate anything the approved playbook does not cover to Sam Lee, support@acme.test/);
    expect(rules).toMatch(/Answer no real customers until the buyer approves the playbook/);
    expect(rules).toMatch(/you are an AI assistant/);
    expect(rules).toMatch(/call-recording consent/);
    expect(rules).toMatch(/Hand the call to a person as soon as the caller asks/);
    expect(rules).toMatch(/Never take a card number or other payment details by voice/);
    expect(rules).not.toMatch(/Ad spend/);
  });

  it("keeps the phone rules off email and chat, and reads a $0 or missing limit as no refunds", () => {
    const chat = agentRules({ ...support, support: { ...support.support!, channels: ["chat"], refundLimitCents: 0 } }).join("\n");
    expect(chat).not.toMatch(/AI assistant|by voice/);
    expect(chat).toMatch(/Never refund, credit or discount anything/);
    expect(agentRules({ ...support, support: undefined }).join("\n")).toMatch(/Never refund, credit or discount anything. Send every request for one to the buyer/);
  });
});

describe("the quality gate on customer support", () => {
  const brief: Brief = { contractTitle: "Answer our inbox", title: "Answer our inbox", successCriteria: "First response under 2 hours", service: support };
  const good: GateAnswers = { satisfiesBrief: 0.9, complete: 0.85, unsupportedClaims: 0.1, quality: 2.4 };

  it("asks the support stage questions and the refund-limit check, never the spend check", () => {
    const q = gateQuestions(brief);
    expect(q).toHaveProperty("exceeds_refund_limit");
    expect(q).not.toHaveProperty("exceeds_spend_cap");
    expect(q.complete).toBe(SUPPORT_GATE_QUESTIONS.complete);
    expect(q.complete).not.toBe(SERVICE_GATE_QUESTIONS.complete);
    // Other kinds keep their questions.
    expect(gateQuestions({ ...brief, service: ads })).not.toHaveProperty("exceeds_refund_limit");
  });

  it("shows Jev the stages, channels, limit and contact", () => {
    expect(gateState({ brief, title: "Playbook", notes: "..." }).brief).toMatchObject({
      service: {
        kind: "Customer support",
        stagesThisWeek: ["playbook to approve", "test conversations for the go-live review", "weekly report"],
        channels: ["email", "phone"],
        coverageHours: "Mon–Fri 9am–6pm ET",
        weeklyVolume: 300,
        refundLimitPerCustomer: "$50",
        escalationContact: "Sam Lee, support@acme.test",
      },
    });
    expect(gateState({ brief: { ...brief, service: { ...support, week: 3 } }, title: "Report", notes: "..." }).brief).toMatchObject({ service: { stagesThisWeek: ["weekly report"] } });
    expect(gateState({ brief: { ...brief, service: ads }, title: "Plan", notes: "..." }).brief.service).not.toHaveProperty("refundLimitPerCustomer");
  });

  it("returns work that refunds or credits above the authority limit", () => {
    const r = decide({ ...good, exceedsRefundLimit: 0.9 }, 0, now, { service: true, support: true });
    expect(r.verdict).toBe("returned");
    expect(r.flags.join(" ")).toMatch(/over the refund limit/);
    expect(decide({ ...good, exceedsRefundLimit: 0.2 }, 0, now, { service: true, support: true }).verdict).toBe("passed");
  });

  it("tells a support agent what each stage's finished work is", () => {
    expect(decide({ ...good, complete: 0.3 }, 0, now, { service: true, support: true }).flags.join(" ")).toMatch(/playbook ready to approve, test conversations/);
  });

  it("maps Jev's refund-limit answer", async () => {
    let body: { questions: Record<string, unknown> } | null = null;
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init!.body));
      return new Response(
        JSON.stringify({
          answers: {
            satisfies_brief: { type: "boolean", probability: 0.9 },
            complete: { type: "boolean", probability: 0.9 },
            unsupported_claims: { type: "boolean", probability: 0.1 },
            quality: { type: "score", score: 2 },
            exceeds_refund_limit: { type: "boolean", probability: 0.95 },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const a = await jevEvaluator("k", fetchImpl)!({ brief, title: "Week 1 report", notes: "Refunded $120 to one customer." });
    expect(a.exceedsRefundLimit).toBe(0.95);
    expect(Object.keys(body!.questions)).toContain("exceeds_refund_limit");
  });
});

describe("agent tools on a customer support week", () => {
  const PROFILE = "11111111-1111-4111-8111-111111111111";
  const AGENT = "33333333-3333-4333-8333-333333333333";
  const WEEK1 = "48484848-4848-4848-8848-484848484848";
  const OPP = "77777777-7777-4777-8777-777777777777";

  function db() {
    return fakeDb({
      tables: {
        agents: [{ id: AGENT, owner_id: PROFILE, name: "Sasha" }],
        opportunities: [{ id: OPP, title: "Answer our inbox", category: "Enterprise automation", success_criteria: "First response under 2 hours", status: "open", created_at: "2026-10-01", ...supportRow }],
        contracts: [{ id: WEEK1, agent_id: AGENT, source_type: "application", source_id: "a1", title: "Answer our inbox", status: "Active", currency: "USD", service_terms: support }],
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

  it("get_contract gives the support week its steps and rules, and the brief its support terms", async () => {
    const r = (await TOOLS.find((t) => t.name === "get_contract")!.run({ contractId: WEEK1 }, ctx(db()))) as {
      ok: boolean;
      opportunity: { service: { support: { refundLimitCents: number } } };
      contract: { service: { thisWeek: string[]; rules: string[] } };
    };
    expect(r.ok).toBe(true);
    expect(r.opportunity.service.support.refundLimitCents).toBe(5000);
    expect(r.contract.service.thisWeek[1]).toMatch(/playbook/);
    expect(r.contract.service.rules.join(" ")).toMatch(/more than \$50 to any one customer/);
  });

  it("post_opportunity stores a support brief and refuses one without an authority limit", async () => {
    const database = db();
    const post = TOOLS.find((t) => t.name === "post_opportunity")!;
    const base = { organization: "Acme", title: "Answer our chat", category: "Enterprise automation", budgetMinCents: 20000, budgetMaxCents: 40000, duration: "4 weeks", requiredSkills: [], description: "Answer customer chats in Intercom.", successCriteria: "Median first response under 5 minutes" };
    const terms = { channels: ["chat"], hours: "Weekends", weeklyVolume: 120, refundLimitCents: null, escalationContact: "support@acme.test" };
    const bad = (await post.run({ ...base, service: { kind: "support", platforms: ["Intercom"], adSpendCapCents: null, weeks: 4, support: terms } } as never, ctx(database))) as { ok: boolean; error: string };
    expect(bad).toEqual({ ok: false, error: "Set the most the agent may refund or credit one customer ($0 if it may not)." });
    const good = (await post.run({ ...base, service: { kind: "support", platforms: ["Intercom"], adSpendCapCents: null, weeks: 4, support: { ...terms, refundLimitCents: 0 } } } as never, ctx(database))) as { ok: boolean };
    expect(good.ok).toBe(true);
    const stored = (await database.from("opportunities").select("*").eq("title", "Answer our chat").maybeSingle()).data as Record<string, unknown>;
    expect(stored).toMatchObject({ service_kind: "support", support_channels: ["chat"], support_hours: "Weekends", support_weekly_volume: 120, refund_limit_cents: 0, escalation_contact: "support@acme.test" });
  });

  it("submit_deliverable gates a support week with the refund check and returns it over the limit", async () => {
    let seen: Brief | null = null;
    const gate: ToolContext["gate"] = async ({ brief }) => {
      seen = brief;
      return { satisfiesBrief: 0.9, complete: 0.9, unsupportedClaims: 0.1, quality: 2, exceedsRefundLimit: 0.92 };
    };
    const r = (await TOOLS.find((t) => t.name === "submit_deliverable")!.run(
      { contractId: WEEK1, title: "Week 1 report", notes: "312 conversations. Refunded $120 to one customer." },
      ctx(db(), gate),
    )) as { ok: boolean; gate: { verdict: string; flags: string[] } };
    expect(seen).toMatchObject({ service: { kind: "support", support: { refundLimitCents: 5000 } } });
    expect(r.ok).toBe(false);
    expect(r.gate.verdict).toBe("returned");
    expect(r.gate.flags.join(" ")).toMatch(/over the refund limit/);
  });
});

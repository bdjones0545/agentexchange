import { describe, expect, it, vi, beforeEach } from "vitest";
import { TOOLS, type ToolContext } from "../server/mcp/tools";
import { quoteContract, PLATFORM_FEE_BPS } from "../server/pricing";
import { budgetRangeCents, operatorNetCents } from "../src/lib/budgetLabel";
import { isPayoutCountry, PAYOUT_COUNTRIES, unsupportedCountryMessage } from "../src/lib/payoutCountries";
import { fakeDb } from "./fakeSupabase";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const AGENT = "22222222-2222-4222-8222-222222222222";
const THEIR_AGENT = "55555555-5555-4555-8555-555555555555";
const APP = "66666666-6666-4666-8666-666666666666";
const CONTRACT = "44444444-4444-4444-8444-444444444444";

describe("payout countries", () => {
  it("covers the US, Canada, the UK, Switzerland and the EEA except Iceland", () => {
    for (const code of ["US", "CA", "GB", "CH", "PT", "FR", "DE", "NO", "LI"]) expect(isPayoutCountry(code)).toBe(true);
    for (const code of ["IS", "BR", "PK", "ME", "IN", "NG", "AU", "MX"]) expect(isPayoutCountry(code)).toBe(false);
    expect(isPayoutCountry(" pt ")).toBe(true);
    expect(PAYOUT_COUNTRIES).toHaveLength(33);
    expect(new Set(PAYOUT_COUNTRIES.map((c) => c.code)).size).toBe(33);
  });
  it("tells an unsupported operator why, by country name, with no retry", () => {
    const m = unsupportedCountryMessage("BR");
    expect(m).toContain("Brazil");
    expect(m).toContain("Stripe Connect");
    expect(m).not.toMatch(/retry|try again/i);
  });
});

describe("what an operator takes home", () => {
  it("matches the server's quote, including the $5 minimum fee", () => {
    for (const cents of [5000, 20000, 35000, 75000, 100000, 3300]) {
      const expected = cents < 5000 ? cents - 500 : quoteContract(cents, PLATFORM_FEE_BPS).operatorNetCents;
      expect(operatorNetCents(cents)).toBe(expected);
    }
  });
  it("reads fixed and ranged brief budgets", () => {
    expect(budgetRangeCents("$750-$1,000")).toEqual({ min: 75000, max: 100000 });
    expect(budgetRangeCents("$350")).toEqual({ min: 35000, max: 35000 });
    expect(budgetRangeCents("$1.5k – $2k")).toEqual({ min: 150000, max: 200000 });
    expect(budgetRangeCents("Custom budget")).toBeNull();
    expect(budgetRangeCents("$900-$300")).toBeNull();
  });
});

function seeded() {
  return fakeDb({
    tables: {
      agents: [
        { id: AGENT, owner_id: ME, name: "Analyst", created_at: "2026-11-01" },
        { id: THEIR_AGENT, owner_id: OTHER, name: "Theirs", created_at: "2026-11-01" },
      ],
      applications: [
        { id: APP, agent_id: AGENT, status: "pending" },
        { id: "a-accepted", agent_id: AGENT, status: "accepted" },
        { id: "a-theirs", agent_id: THEIR_AGENT, status: "pending" },
      ],
      contracts: [
        { id: CONTRACT, agent_id: AGENT, agent_name: "Analyst", status: "Active", payment_status: "unfunded" },
        { id: "c-funded", agent_id: AGENT, agent_name: "Analyst", status: "Active", payment_status: "authorized" },
        { id: "c-delivered", agent_id: AGENT, agent_name: "Analyst", status: "Active", payment_status: "unfunded" },
        { id: "c-theirs", agent_id: THEIR_AGENT, agent_name: "Theirs", status: "Active", payment_status: "unfunded" },
      ],
      contract_deliverables: [{ id: "d1", contract_id: "c-delivered", status: "submitted" }],
      contract_messages: [],
    },
  });
}
const ctx = (db: ReturnType<typeof fakeDb>): ToolContext => ({ open: async () => ({ db, profileId: ME }), worker: "test", now: () => "2026-11-26T00:00:00.000Z", paymentsEnabled: false });
const run = (name: string, input: unknown, db = seeded()) => TOOLS.find((t) => t.name === name)!.run(input as never, ctx(db)) as Promise<Record<string, unknown>>;
const rows = async (db: ReturnType<typeof fakeDb>, table: string) => ((await db.from(table).select("*")) as unknown as { data: Record<string, unknown>[] }).data;

describe("withdraw_application", () => {
  it("withdraws your own pending application", async () => {
    const db = seeded();
    expect(await run("withdraw_application", { applicationId: APP }, db)).toEqual({ ok: true, applicationId: APP, status: "withdrawn" });
    expect((await rows(db, "applications")).find((a) => a.id === APP)?.status).toBe("withdrawn");
  });
  it("refuses someone else's application and a decided one", async () => {
    const db = seeded();
    expect((await run("withdraw_application", { applicationId: "a-theirs" }, db)).ok).toBe(false);
    expect((await run("withdraw_application", { applicationId: "a-accepted" }, db)).error).toMatch(/accepted/);
    expect((await rows(db, "applications")).find((a) => a.id === "a-theirs")?.status).toBe("pending");
  });
});

describe("decline_contract", () => {
  it("cancels your unfunded contract and leaves a note in the thread", async () => {
    const db = seeded();
    expect(await run("decline_contract", { contractId: CONTRACT, note: "The price is below my rate." }, db)).toEqual({ ok: true, contractId: CONTRACT, status: "Cancelled" });
    expect((await rows(db, "contracts")).find((c) => c.id === CONTRACT)?.status).toBe("Cancelled");
    const [message] = await rows(db, "contract_messages");
    expect(message).toMatchObject({ contract_id: CONTRACT, sender_type: "Agent", author: "Analyst" });
    expect(String(message.body)).toContain("The price is below my rate.");
  });
  it("refuses funded, delivered and other people's contracts and changes nothing", async () => {
    const db = seeded();
    expect((await run("decline_contract", { contractId: "c-funded" }, db)).error).toMatch(/authorized/);
    expect((await run("decline_contract", { contractId: "c-delivered" }, db)).error).toMatch(/delivered/);
    expect((await run("decline_contract", { contractId: "c-theirs" }, db)).error).toMatch(/agent's side/);
    expect((await rows(db, "contracts")).every((c) => c.status === "Active")).toBe(true);
    expect(await rows(db, "contract_messages")).toHaveLength(0);
  });
});

describe("POST /api/seller", () => {
  const onboardSeller = vi.fn(async () => ({ url: "https://connect.stripe.test/onboarding" }));
  let existing: { stripe_account_id: string } | null = null;
  beforeEach(() => {
    vi.resetModules();
    onboardSeller.mockClear();
    existing = null;
    vi.doMock("../server/config.js", () => ({ readServerEnv: () => ({ paymentsEnabled: true, appUrl: "https://www.agentsexchange.ai" }) }));
    vi.doMock("../server/caller.js", () => ({ bearerToken: () => "token", callerProfile: async () => ({ profileId: ME, userId: "u1", email: "op@example.test" }) }));
    vi.doMock("../server/connect.js", () => ({ onboardSeller, sellerGateway: () => ({}) }));
    vi.doMock("../server/moneyOperations.js", () => ({ operationStore: () => ({}) }));
    vi.doMock("../server/service.js", () => ({
      serviceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }) }) }),
    }));
  });
  const post = async (body: unknown) => {
    const { POST } = await import("../api/seller");
    const res = await POST(new Request("https://x.test/api/seller", { method: "POST", body: JSON.stringify(body) }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  it("refuses an unsupported country before Stripe is called, saying why", async () => {
    const r = await post({ country: "BR" });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ ok: false, code: "unsupported_country" });
    expect(String(r.body.error)).toContain("Brazil");
    expect(onboardSeller).not.toHaveBeenCalled();
  });
  it("starts setup for a supported country", async () => {
    const r = await post({ country: "pt" });
    expect(r).toEqual({ status: 200, body: { ok: true, url: "https://connect.stripe.test/onboarding" } });
    expect(onboardSeller).toHaveBeenCalledOnce();
  });
  it("lets an operator who already started continue without choosing a country again", async () => {
    existing = { stripe_account_id: "acct_123" };
    const r = await post({});
    expect(r.status).toBe(200);
    expect(onboardSeller).toHaveBeenCalledOnce();
  });
  it("asks for a country when there is no account yet", async () => {
    const r = await post({});
    expect(r.status).toBe(400);
    expect(onboardSeller).not.toHaveBeenCalled();
  });
});

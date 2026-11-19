// Agent buying: an owner can grant it, status reports it truthfully, the MCP
// tools explain a refusal before money moves, workers hear about agent hires,
// and a key's last use is recorded. Production's database refuses an agent's
// hold unless the key lists the action AND the contract's organization; these
// tests pin the app to that rule.
import { describe, expect, it, vi } from "vitest";
import {
  hasPaymentAuthority,
  parseGrantRequest,
  paymentGrant,
  paymentRefusal,
  PAYMENT_ACTIONS,
  SELLER_ACTIONS,
  updateKeyAuthority,
} from "../server/agentAuthority";
import { setupStatus } from "../server/agentSetup";
import { mintKey, resolveAgentKey } from "../server/agentKeys";
import { TOOLS, type ToolContext } from "../server/mcp/tools";
import { fakeDb } from "./fakeSupabase";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const KEY = "33333333-3333-4333-8333-333333333333";
const ORG = "44444444-4444-4444-8444-444444444444";
const ORG_2 = "55555555-5555-4555-8555-555555555555";
const FOREIGN_ORG = "66666666-6666-4666-8666-666666666666";
const CONTRACT = "77777777-7777-4777-8777-777777777777";
const AGENT = "88888888-8888-4888-8888-888888888888";
const OPP = "99999999-9999-4999-8999-999999999999";

const sellerKey = { can_spend: true, allowed_actions: [...SELLER_ACTIONS], organization_ids: [] as string[] };
const buyerKey = { can_spend: true, allowed_actions: [...SELLER_ACTIONS, ...PAYMENT_ACTIONS], organization_ids: [ORG] };

describe("payment authority mirrors the database rule", () => {
  it("needs the switch, both money actions and the contract's organization", () => {
    expect(paymentRefusal(buyerKey, "fund_contract", ORG)).toBeNull();
    expect(paymentRefusal(buyerKey, "release_payment", ORG)).toBeNull();
    expect(paymentRefusal({ ...buyerKey, can_spend: false }, "fund_contract", ORG)).toMatch(/no payment permission/);
    expect(paymentRefusal(sellerKey, "fund_contract", ORG)).toMatch(/not allowed to fund contracts/);
    expect(paymentRefusal({ ...buyerKey, allowed_actions: [...SELLER_ACTIONS, "fund_contract"] }, "release_payment", ORG)).toMatch(/not allowed to release payments/);
    expect(paymentRefusal(buyerKey, "fund_contract", ORG_2)).toMatch(/may not pay for this contract's organization/);
    expect(paymentRefusal({ ...buyerKey, paused_at: "2026-11-19" }, "fund_contract", ORG)).toMatch(/paused/);
    expect(paymentRefusal({ ...buyerKey, revoked_at: "2026-11-19" }, "fund_contract", ORG)).toMatch(/revoked/);
  });

  it("a key with only the payment switch on is not ready to pay (the 2026-11-19 live-test 409)", () => {
    expect(hasPaymentAuthority(sellerKey)).toBe(false);
    expect(hasPaymentAuthority({ ...buyerKey, organization_ids: [] })).toBe(false);
    expect(hasPaymentAuthority(buyerKey)).toBe(true);
  });

  it("switching on adds both money actions and, only when none are set, every owned organization", () => {
    const on = paymentGrant(sellerKey, true, [ORG, ORG_2]);
    expect(on.can_spend).toBe(true);
    expect(on.allowed_actions).toEqual(expect.arrayContaining([...SELLER_ACTIONS, ...PAYMENT_ACTIONS]));
    expect(on.organization_ids).toEqual([ORG, ORG_2]);
    expect(paymentGrant({ ...sellerKey, organization_ids: [ORG_2] }, true, [ORG, ORG_2]).organization_ids).toEqual([ORG_2]);
  });

  it("switching off removes the money actions but keeps the organizations for later", () => {
    const off = paymentGrant(buyerKey, false, [ORG]);
    expect(off.can_spend).toBe(false);
    expect(off.allowed_actions).toEqual([...SELLER_ACTIONS]);
    expect(off.organization_ids).toEqual([ORG]);
  });

  it("accepts only a well-formed owner request", () => {
    expect(parseGrantRequest({ id: KEY, canSpend: true })).toEqual({ id: KEY, canSpend: true, organizationIds: undefined });
    expect(parseGrantRequest({ id: KEY, organizationIds: [ORG] })).toEqual({ id: KEY, canSpend: undefined, organizationIds: [ORG] });
    expect(parseGrantRequest({ id: KEY })).toBeNull();
    expect(parseGrantRequest({ id: "not-a-uuid", canSpend: true })).toBeNull();
    expect(parseGrantRequest({ id: KEY, canSpend: "yes" })).toBeNull();
    expect(parseGrantRequest({ id: KEY, organizationIds: ["nope"] })).toBeNull();
    expect(parseGrantRequest([KEY])).toBeNull();
  });
});

function ownerDb(key: Record<string, unknown> = { ...sellerKey, can_spend: false }) {
  return fakeDb({
    tables: {
      agent_api_keys: [{ id: KEY, profile_id: OWNER, name: "workforcio", revoked_at: null, paused_at: null, ...key }],
      organizations: [
        { id: ORG, owner_id: OWNER, name: "AgentExchange Google Account Test" },
        { id: ORG_2, owner_id: OWNER, name: "Efficiency Strength Training" },
        { id: FOREIGN_ORG, owner_id: OTHER, name: "Someone else" },
      ],
    },
  });
}

describe("owner grants buying (PATCH /api/agent-keys)", () => {
  it("allowing payments covers every organization the owner has, and nobody else's", async () => {
    const db = ownerDb();
    const key = await updateKeyAuthority(db, OWNER, { id: KEY, canSpend: true });
    expect(key.can_spend).toBe(true);
    expect(key.allowed_actions).toEqual(expect.arrayContaining(["fund_contract", "release_payment"]));
    expect(key.organization_ids).toEqual([ORG, ORG_2]);
    expect(hasPaymentAuthority(key)).toBe(true);
  });

  it("the owner can narrow the scope, but not name another owner's organization", async () => {
    const db = ownerDb(buyerKey);
    expect((await updateKeyAuthority(db, OWNER, { id: KEY, organizationIds: [ORG_2] })).organization_ids).toEqual([ORG_2]);
    await expect(updateKeyAuthority(db, OWNER, { id: KEY, organizationIds: [ORG, FOREIGN_ORG] })).rejects.toThrow(/organizations you own/);
  });

  it("an explicitly empty scope stays empty, so the key is not ready", async () => {
    const key = await updateKeyAuthority(ownerDb(), OWNER, { id: KEY, canSpend: true, organizationIds: [] });
    expect(key.organization_ids).toEqual([]);
    expect(hasPaymentAuthority(key)).toBe(false);
  });

  it("refuses another operator's key", async () => {
    await expect(updateKeyAuthority(ownerDb(), OTHER, { id: KEY, canSpend: true })).rejects.toThrow(/not found/);
  });
});

describe("setup status tells the agent the truth", () => {
  const ready = async () => ({ transfers: true, payouts: true });
  function statusDb(key: Record<string, unknown>) {
    const db = ownerDb(key);
    void db.from("billing_accounts").insert({ profile_id: OWNER, default_payment_method_id: "pm_x", agent_daily_cap_cents: 6000, agent_per_contract_cap_cents: 6000 }).then(() => undefined);
    return db;
  }

  it("payment switch alone: canPay false, and the owner sees which organizations are not covered", async () => {
    const s = await setupStatus(statusDb(sellerKey), OWNER, KEY, true, ready);
    expect(s.canPay).toBe(false);
    expect(s.paymentSwitchOn).toBe(true);
    expect(s.organizations.map((o) => o.covered)).toEqual([false, false]);
  });

  it("switch, money actions and an organization: canPay true, scoped per organization", async () => {
    const s = await setupStatus(statusDb(buyerKey), OWNER, KEY, true, ready);
    expect(s.canPay).toBe(true);
    expect(s.organizations).toEqual([
      { id: ORG, name: "AgentExchange Google Account Test", covered: true, canPayFor: true },
      { id: ORG_2, name: "Efficiency Strength Training", covered: false, canPayFor: false },
    ]);
  });
});

function toolCtx(db: ReturnType<typeof fakeDb>, notify?: ToolContext["notify"]): ToolContext {
  return { open: async () => ({ db, profileId: OWNER }), worker: "agent:axk_test", agentKeyId: KEY, paymentsAllowed: true, paymentsEnabled: true, now: () => "2026-11-19T02:00:00.000Z", notify };
}
const tool = (name: string) => TOOLS.find((t) => t.name === name)!;

describe("money tools explain a refusal before any money operation", () => {
  function contractDb(key: Record<string, unknown>) {
    const db = ownerDb(key);
    void db.from("contracts").insert({ id: CONTRACT, organization_id: ORG, organization_name: "AgentExchange Google Account Test", payment_status: "unfunded" }).then(() => undefined);
    return db;
  }

  it.each(["fund_contract", "release_payment"])("%s without buying rights: plain refusal with the owner's setup link, nothing charged", async (name) => {
    const r = (await tool(name).run({ contractId: CONTRACT, action: "capture" } as never, toolCtx(contractDb(sellerKey)))) as { ok: boolean; error: string; ownerSetupUrl: string };
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not allowed to (fund contracts|release payments)/);
    expect(r.error).toMatch(/Nothing was charged/);
    expect(r.ownerSetupUrl).toBe(`https://www.agentsexchange.ai/account?agentSetup=${KEY}`);
  });

  it("fund_contract for an organization outside the key's scope is refused the same way", async () => {
    const r = (await tool("fund_contract").run({ contractId: CONTRACT } as never, toolCtx(contractDb({ ...buyerKey, organization_ids: [ORG_2] })))) as { ok: boolean; error: string; organizationId: string };
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/may not pay for this contract's organization/);
    expect(r.organizationId).toBe(ORG);
  });

  it("a fully scoped key passes the check and reaches the money path", async () => {
    const r = (await tool("fund_contract").run({ contractId: CONTRACT } as never, toolCtx(contractDb(buyerKey)))) as { ok: boolean; error?: string; ownerSetupUrl?: string };
    expect(r.ownerSetupUrl).toBeUndefined();
    expect(r.error ?? "").not.toMatch(/not allowed|may not pay/);
  });
});

describe("workers hear about what agents do over MCP", () => {
  function hireDb() {
    return fakeDb({
      tables: {
        agents: [{ id: AGENT, name: "Research and Writing Analyst", owner_id: OTHER }],
        opportunities: [{ id: OPP, title: "[test] Live payment check", organization_id: ORG, organization_name: "Org" }],
        applications: [{ id: "app-1", opportunity_id: OPP, agent_id: AGENT, agent_name: "Research and Writing Analyst", status: "pending" }],
      },
    });
  }

  it("send_hire_request wakes the hired agent's worker (it waited 25 minutes for a sweep before)", async () => {
    const notify = vi.fn(async () => []);
    const r = (await tool("send_hire_request").run({ agentId: AGENT, opportunityId: OPP, amountCents: 5000 }, toolCtx(hireDb(), notify))) as { ok: boolean; hireRequest: { id: string } };
    expect(r.ok).toBe(true);
    expect(notify).toHaveBeenCalledWith({ event: "hire_request", hireRequestId: r.hireRequest.id });
  });

  it("a notifier failure never fails the hire that was already saved", async () => {
    const notify = vi.fn(async () => { throw new Error("runtime down"); });
    const r = (await tool("send_hire_request").run({ agentId: AGENT, opportunityId: OPP, amountCents: 5000 }, toolCtx(hireDb(), notify))) as { ok: boolean };
    expect(r.ok).toBe(true);
  });

  it("accept_application tells the worker a contract exists", async () => {
    const notify = vi.fn(async () => []);
    const r = (await tool("accept_application").run({ applicationId: "app-1", amountCents: 5000 } as never, toolCtx(hireDb(), notify))) as { ok: boolean; contract: { id: string } };
    expect(r.ok).toBe(true);
    expect(notify).toHaveBeenCalledWith({ event: "contract_created", contractId: r.contract.id });
  });
});

describe("a key's last use is recorded", () => {
  function keyDb(lastUsed: string | null) {
    const minted = mintKey();
    const db = fakeDb({
      tables: { agent_api_keys: [{ id: KEY, profile_id: OWNER, can_spend: false, revoked_at: null, last_used_at: lastUsed }] },
      rpc: (name) => (name === "resolve_agent_api_key" ? { data: [{ key_id: KEY, profile_id: OWNER, user_id: "user-1" }], error: null } : { data: null, error: { message: "no" } }),
    });
    return { db, raw: minted.raw };
  }
  const stamp = async (db: ReturnType<typeof fakeDb>) => ((await db.from("agent_api_keys").select("last_used_at").eq("id", KEY).single()).data as { last_used_at: string | null }).last_used_at;

  it("stamps a never-used key (it used to stay \"never used\" forever)", async () => {
    const { db, raw } = keyDb(null);
    expect(await resolveAgentKey(raw, db)).toMatchObject({ keyId: KEY, profileId: OWNER });
    expect(await stamp(db)).not.toBeNull();
  });

  it("does not rewrite the stamp on every call within a minute", async () => {
    const recent = new Date(Date.now() - 10_000).toISOString();
    const { db, raw } = keyDb(recent);
    await resolveAgentKey(raw, db);
    expect(await stamp(db)).toBe(recent);
  });
});

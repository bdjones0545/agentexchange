import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { onboardSeller, SELLER_PRODUCT_DESCRIPTION, sellerProfile, type SellerGateway } from "../server/connect";
import { failureLabel, runMoneyOperation, type OperationStore } from "../server/moneyOperations";
import { fakeDb } from "./fakeSupabase";

const ME = "11111111-1111-4111-8111-111111111111";
const APP = "https://www.agentsexchange.ai";

describe("money operation failure reasons", () => {
  it("records Stripe's type, code, parameter and status", () => {
    const e = Object.assign(new Error("Country BR is not supported for jane@example.com"), {
      type: "StripeInvalidRequestError", code: "country_unsupported", param: "identity.country", statusCode: 400,
    });
    expect(failureLabel(e)).toBe("StripeInvalidRequestError:country_unsupported param=identity.country http=400");
  });
  it("never records the free-text message, and drops odd-looking fields", () => {
    const e = Object.assign(new Error("card 4242 4242 4242 4242 for jane@example.com"), { code: "has spaces and @ signs", param: "x".repeat(200) });
    const label = failureLabel(e);
    expect(label).toBe("Error");
    expect(label).not.toMatch(/4242|example\.com/);
    expect(failureLabel("not an error")).toBe("operation_failed");
  });
  it("is what a failed operation stores", async () => {
    const fail = vi.fn();
    const store: OperationStore = { begin: async () => ({ state: "acquired" as const, token: "t" }), finish: vi.fn(), fail };
    const stripeError = Object.assign(new Error("secret text"), { type: "StripeInvalidRequestError", code: "url_invalid", statusCode: 400 });
    await expect(runMoneyOperation(store, { key: "seller:x", kind: "seller", profileId: ME, request: {} } as never, async () => { throw stripeError; })).rejects.toThrow();
    expect(fail).toHaveBeenCalledWith("seller:x", "t", "StripeInvalidRequestError:url_invalid http=400");
  });
});

function gateway(overrides: Partial<SellerGateway> = {}): SellerGateway & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = { createAccount: [], ensureProfile: [] };
  return {
    calls,
    createAccount: async (...args) => { calls.createAccount.push(args); return "acct_new"; },
    ensureProfile: async (...args) => { calls.ensureProfile.push(args); },
    onboarding: async (id) => `https://connect.stripe.test/${id}`,
    readiness: async () => ({ transfers: false, payouts: false }),
    transfer: async () => "tr_1",
    retrieveTransfer: async () => ({ reversed: 0, amount: 0 }),
    reverseTransfer: async () => {},
    ...overrides,
  };
}
const operations: OperationStore = { begin: async () => ({ state: "acquired" as const, token: "t" }), finish: async () => {}, fail: async () => {} };
const agents = [
  { id: "a-pending", owner_id: ME, name: "Draft", moderation_status: "pending", listed: true, created_at: "2026-11-01" },
  { id: "a-live", owner_id: ME, name: "Analyst Co", moderation_status: "approved", listed: true, created_at: "2026-11-02" },
  { id: "a-later", owner_id: ME, name: "Second", moderation_status: "approved", listed: true, created_at: "2026-11-03" },
];

describe("seller payout setup tells Stripe who the seller is", () => {
  it("uses the seller's oldest approved, listed listing as their website", async () => {
    expect(await sellerProfile(fakeDb({ tables: { agents } }), ME, APP)).toEqual({ businessUrl: `${APP}/agents/a-live`, name: "Analyst Co" });
    expect(await sellerProfile(fakeDb({ tables: { agents: [agents[0]] } }), ME, APP)).toEqual({});
  });

  it("prefills a new account", async () => {
    const g = gateway();
    const base = fakeDb({ tables: { agents, seller_accounts: [] } });
    const saved: unknown[] = [];
    const db = { ...base, from: (t: string) => Object.assign(base.from(t), { upsert: (row: unknown) => { saved.push(row); return Promise.resolve({ error: null }); } }) } as unknown as typeof base;
    expect(await onboardSeller(db, operations, g, ME, APP, "me@example.test", "US")).toEqual({ url: "https://connect.stripe.test/acct_new" });
    expect(saved).toEqual([{ profile_id: ME, stripe_account_id: "acct_new" }]);
    expect(g.calls.createAccount[0]).toEqual([ME, "me@example.test", "US", { businessUrl: `${APP}/agents/a-live`, name: "Analyst Co" }]);
    expect(g.calls.ensureProfile).toHaveLength(0);
  });

  it("fills in an existing account, and a Stripe failure there doesn't block setup", async () => {
    const g = gateway({ ensureProfile: async () => { throw new Error("stripe down"); } });
    const db = fakeDb({ tables: { agents, seller_accounts: [{ profile_id: ME, stripe_account_id: "acct_old" }] } });
    expect(await onboardSeller(db, operations, g, ME, APP, "me@example.test", "")).toEqual({ url: "https://connect.stripe.test/acct_old" });
  });

  it("describes the business without promising anything", () => {
    expect(SELLER_PRODUCT_DESCRIPTION).toContain("AgentExchange marketplace");
    expect(SELLER_PRODUCT_DESCRIPTION.length).toBeLessThan(500);
  });
});

describe("security headers", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
  const all = config.headers.find((h) => h.source === "/(.*)");
  const get = (key: string) => all?.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;
  it("stop other sites framing the app and browsers sniffing content types", () => {
    expect(get("Content-Security-Policy")).toBe("frame-ancestors 'self'");
    expect(get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(get("X-Content-Type-Options")).toBe("nosniff");
    expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fakeDb } from "./fakeSupabase";
import {
  isPlatformOwner,
  loadLiveRevenue,
  revenueLine,
  safeTimeZone,
  summarizeRevenue,
  type PaymentLedgerRow,
  type PayoutLedgerRow,
} from "../server/revenue";
import { revenueResult, revenueStatusLabel } from "../src/lib/ownerRevenue";

const OWNER = "6f1c2a4e-0b7d-4c1e-9a55-3d2b8e7f9a10";
const STRANGER = "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";
const C1 = "11111111-1111-4111-8111-111111111111";

// A $100 contract: 3% buyer fee on top, 15% platform fee out of the price.
function payout(patch: Partial<PayoutLedgerRow> = {}): PayoutLedgerRow {
  return {
    contract_id: C1,
    gross_cents: 10_000,
    fee_cents: 1_500,
    net_cents: 8_500,
    currency: "USD",
    status: "pending",
    reversed_cents: 0,
    payment_intent_id: "pi_live_1",
    provider_ref: null,
    created_at: "2026-10-15T15:00:00.000Z",
    ...patch,
  };
}
const charge = (patch: Partial<PaymentLedgerRow> = {}): PaymentLedgerRow => ({
  contract_id: C1, kind: "charge", status: "captured", amount_cents: 10_300, provider_ref: "pi_live_1", ...patch,
});
const refund = (amount: number): PaymentLedgerRow => ({
  contract_id: C1, kind: "refund", status: "refunded", amount_cents: amount, provider_ref: "pi_live_1:refund-total",
});
const contract = { id: C1, title: "Lead list", payment_status: "captured" };

describe("platform owner gate", () => {
  it("is closed when PLATFORM_OWNER_USER_IDS is unset or empty", () => {
    expect(isPlatformOwner(OWNER, {})).toBe(false);
    expect(isPlatformOwner(OWNER, { PLATFORM_OWNER_USER_IDS: "" })).toBe(false);
    expect(isPlatformOwner("", { PLATFORM_OWNER_USER_IDS: "" })).toBe(false);
  });
  it("admits only listed auth user ids", () => {
    const env = { PLATFORM_OWNER_USER_IDS: ` ${OWNER.toUpperCase()} , not-a-uuid,*` };
    expect(isPlatformOwner(OWNER, env)).toBe(true);
    expect(isPlatformOwner(STRANGER, env)).toBe(false);
    expect(isPlatformOwner("*", env)).toBe(false);
    expect(isPlatformOwner("not-a-uuid", env)).toBe(false);
  });
});

describe("revenue per contract", () => {
  it("is the buyer fee plus the platform fee", () => {
    const line = revenueLine(payout(), contract, [charge()]);
    expect(line).toMatchObject({
      title: "Lead list", priceCents: 10_000, buyerFeeCents: 300, buyerFeeFromCharge: true, platformFeeCents: 1_500,
      operatorNetCents: 8_500, revenueCents: 1_800, refundedCents: 0, refundCostCents: 0, netRevenueCents: 1_800,
    });
  });
  it("takes the buyer fee from the captured charge, not the rate", () => {
    expect(revenueLine(payout(), contract, [charge({ amount_cents: 10_250 })]).buyerFeeCents).toBe(250);
  });
  it("falls back to the published rate, and says so, when no charge matches the payout", () => {
    const line = revenueLine(payout(), contract, [charge({ provider_ref: "pi_other" })]);
    expect(line.buyerFeeCents).toBe(300);
    expect(line.buyerFeeFromCharge).toBe(false);
  });
  it("loses all of it on a full refund once the operator's transfer is reversed", () => {
    const line = revenueLine(payout({ provider_ref: "tr_1", status: "reversed", reversed_cents: 8_500 }), { ...contract, payment_status: "refunded" }, [charge(), refund(10_300)]);
    expect(line).toMatchObject({ refundedCents: 10_300, refundCostCents: 1_800, netRevenueCents: 0 });
  });
  it("keeps its share of a partial refund after the proportional reversal", () => {
    // connect.ts reverses floor(8500 * 5150 / 10300) = 4250 of the transfer.
    const line = revenueLine(payout({ provider_ref: "tr_1", status: "reversed", reversed_cents: 4_250 }), contract, [charge(), refund(5_150)]);
    expect(line).toMatchObject({ refundCostCents: 900, netRevenueCents: 900 });
  });
  it("withholds the operator's share of a refund that lands before the transfer", () => {
    const line = revenueLine(payout(), { ...contract, payment_status: "refunded" }, [charge(), refund(10_300)]);
    expect(line).toMatchObject({ refundCostCents: 1_800, netRevenueCents: 0 });
  });
  it("carries the whole refund until a transferred payout's reversal lands", () => {
    const line = revenueLine(payout({ provider_ref: "tr_1", status: "transferred", reversed_cents: 0 }), contract, [charge(), refund(10_300)]);
    expect(line.refundCostCents).toBe(10_300);
    expect(line.netRevenueCents).toBe(-8_500);
  });
  it("ignores another contract's refunds", () => {
    expect(revenueLine(payout(), contract, [charge(), { ...refund(10_300), contract_id: "other" }]).refundedCents).toBe(0);
  });
});

describe("revenue totals", () => {
  const at = (id: string, created_at: string, patch: Partial<PayoutLedgerRow> = {}) => payout({ contract_id: id, created_at, payment_intent_id: `pi_${id}`, ...patch });
  const ledger = {
    payouts: [
      at("today", "2026-10-15T01:00:00.000Z"), // 21:00 on Oct 14 in New York
      at("month", "2026-10-02T12:00:00.000Z"),
      at("edge", "2026-10-01T02:00:00.000Z"), // Sep 30 in New York, Oct 1 in UTC
      at("old", "2026-09-12T12:00:00.000Z"),
      at("eur", "2026-10-14T12:00:00.000Z", { currency: "EUR" }),
    ],
    payments: ["today", "month", "edge", "old", "eur"].map((id) => charge({ contract_id: id, provider_ref: `pi_${id}` })),
    contracts: [{ id: "today", title: "Today's job", payment_status: "captured" }],
  };
  const now = new Date("2026-10-15T03:30:00.000Z"); // 23:30 on Oct 14 in New York

  it("groups by release date in the viewer's time zone", () => {
    const s = summarizeRevenue(ledger, { now, timeZone: "America/New_York" });
    expect(s.today).toMatchObject({ contracts: 1, revenueCents: 1_800, buyerFeeCents: 300, platformFeeCents: 1_500, priceCents: 10_000 });
    expect(s.month.contracts).toBe(2);
    expect(s.allTime).toMatchObject({ contracts: 4, revenueCents: 7_200, netRevenueCents: 7_200 });
  });
  it("uses the UTC calendar when asked", () => {
    const s = summarizeRevenue(ledger, { now, timeZone: "UTC" });
    expect(s.today.contracts).toBe(1);
    expect(s.month.contracts).toBe(3);
  });
  it("lists every contract newest first but keeps a non-USD row out of the dollar totals", () => {
    const s = summarizeRevenue(ledger, { now, timeZone: "UTC" });
    expect(s.lines.map((l) => l.contractId)).toEqual(["today", "eur", "month", "edge", "old"]);
    expect(s.lines[0].title).toBe("Today's job");
    expect(s.lines[2].title).toBe("Untitled contract");
    expect(s.allTime.contracts).toBe(4);
  });
  it("is zero, not missing, with no released contracts", () => {
    const s = summarizeRevenue({ payouts: [], payments: [], contracts: [] }, { now, timeZone: "UTC" });
    expect(s.allTime).toEqual({ contracts: 0, priceCents: 0, buyerFeeCents: 0, platformFeeCents: 0, revenueCents: 0, refundCostCents: 0, netRevenueCents: 0 });
    expect(s.lines).toEqual([]);
  });
  it("falls back to UTC for an unknown or oversized time zone", () => {
    expect(safeTimeZone("America/Chicago")).toBe("America/Chicago");
    expect(safeTimeZone("Mars/Olympus")).toBe("UTC");
    expect(safeTimeZone("x".repeat(100))).toBe("UTC");
    expect(safeTimeZone(null)).toBe("UTC");
  });
});

describe("reading the ledger", () => {
  const live = (row: Record<string, unknown>) => ({ ...row, provider_mode: "live" });
  const test = (row: Record<string, unknown>) => ({ ...row, provider_mode: "test" });

  it("counts live rows only", async () => {
    const db = fakeDb({
      tables: {
        payouts: [live({ id: "p1", ...payout() }), test({ id: "p0", ...payout({ contract_id: "pilot", payment_intent_id: "pi_test" }) })],
        payments: [
          live({ id: "a", created_at: "1", ...charge() }),
          // A test-mode row on a live contract is never counted.
          test({ id: "b", created_at: "2", ...refund(10_300) }),
          test({ id: "c", created_at: "3", ...charge({ contract_id: "pilot", provider_ref: "pi_test" }) }),
        ],
        contracts: [contract, { id: "pilot", title: "Pilot", payment_status: "captured" }],
      },
    });
    const ledger = await loadLiveRevenue(db);
    expect(ledger.payouts.map((p) => p.contract_id)).toEqual([C1]);
    expect(ledger.payments.map((p) => p.amount_cents)).toEqual([10_300]);
    const s = summarizeRevenue(ledger, { now: new Date("2026-10-15T18:00:00Z"), timeZone: "UTC" });
    expect(s.allTime).toMatchObject({ contracts: 1, revenueCents: 1_800, refundCostCents: 0 });
  });

  it("reads past the server's row cap", async () => {
    const rows = Array.from({ length: 1_205 }, (_, i) => live({ id: `p${String(i).padStart(5, "0")}`, ...payout({ contract_id: `c${i}`, created_at: "2026-10-15T15:00:00.000Z" }) }));
    const db = fakeDb({ tables: { payouts: rows, payments: [], contracts: [] } });
    // Imitate a PostgREST max-rows setting lower than the page size asked for.
    const capped = {
      from(table: string) {
        const builder = db.from(table) as unknown as { range: (from: number, to: number) => unknown };
        const range = builder.range.bind(builder);
        builder.range = (from, to) => range(from, Math.min(to, from + 399));
        return builder;
      },
    } as unknown as SupabaseClient;
    const ledger = await loadLiveRevenue(capped);
    expect(ledger.payouts).toHaveLength(1_205);
    expect(new Set(ledger.payouts.map((p) => p.contract_id)).size).toBe(1_205);
  });

  it("fails rather than reporting a partial ledger", async () => {
    const db = fakeDb({ tables: { payouts: [live({ id: "p1", ...payout() })], payments: [], contracts: [] } });
    const broken = { from: (t: string) => (t === "contracts" ? { select: () => ({ in: async () => ({ data: null, error: { message: "boom" } }) }) } : db.from(t)) } as unknown as SupabaseClient;
    await expect(loadLiveRevenue(broken)).rejects.toThrow(/contracts/);
  });
});

describe("browser outcome", () => {
  it("names each response", () => {
    expect(revenueResult(200, { ok: true, lines: [] }).state).toBe("ok");
    expect(revenueResult(401, {}).state).toBe("signed-out");
    expect(revenueResult(404, { ok: false }).state).toBe("not-owner");
    expect(revenueResult(500, { ok: false, error: "Could not read the ledger" })).toEqual({ state: "error", message: "Could not read the ledger" });
    expect(revenueResult(502, null)).toEqual({ state: "error", message: "Request failed (502)" });
  });
  it("labels the status a person reads", () => {
    expect(revenueStatusLabel({ payoutStatus: "pending", paymentStatus: "captured", refundedCents: 0 })).toBe("Operator payout pending");
    expect(revenueStatusLabel({ payoutStatus: "transferred", paymentStatus: "captured", refundedCents: 0 })).toBe("Paid to operator");
    expect(revenueStatusLabel({ payoutStatus: "transferred", paymentStatus: "captured", refundedCents: 100 })).toBe("Partly refunded");
    expect(revenueStatusLabel({ payoutStatus: "reversed", paymentStatus: "captured", refundedCents: 100 })).toBe("Transfer reversed");
    expect(revenueStatusLabel({ payoutStatus: "reversed", paymentStatus: "refunded", refundedCents: 10_300 })).toBe("Refunded");
  });
});

// ── The route ────────────────────────────────────────────────────────────────

const { callerProfile, state } = vi.hoisted(() => ({
  callerProfile: vi.fn(),
  state: { db: null as unknown, serviceRole: true },
}));
vi.mock("../server/config.js", () => ({ readServerEnv: () => ({ supabaseUrl: "https://db.example.test", supabaseAnonKey: "anon", workers: [], paymentsEnabled: true, appUrl: "https://example.test" }) }));
vi.mock("../server/caller.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("../server/caller")>()), callerProfile }));
vi.mock("../server/service.js", () => ({ serviceClient: () => state.db, serviceRoleConfigured: () => state.serviceRole }));
import { GET } from "../api/owner-revenue";

describe("GET /api/owner-revenue", () => {
  const request = (token?: string, query = "") =>
    new Request(`https://example.test/api/owner-revenue${query}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const readFrom = vi.fn();

  beforeEach(() => {
    vi.stubEnv("PLATFORM_OWNER_USER_IDS", OWNER);
    vi.spyOn(console, "error").mockImplementation(() => {});
    callerProfile.mockReset();
    readFrom.mockReset();
    state.serviceRole = true;
    const db = fakeDb({
      tables: {
        payouts: [{ id: "p1", provider_mode: "live", ...payout({ created_at: new Date().toISOString() }) }, { id: "p0", provider_mode: "test", ...payout({ contract_id: "pilot" }) }],
        payments: [{ id: "a", created_at: "1", provider_mode: "live", ...charge() }],
        contracts: [contract],
      },
    });
    state.db = { from: (t: string) => { readFrom(t); return db.from(t); } };
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("asks for a session first", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(callerProfile).not.toHaveBeenCalled();
  });
  it("rejects a token Supabase does not accept", async () => {
    callerProfile.mockResolvedValue(null);
    expect((await GET(request("bad"))).status).toBe(401);
    expect(readFrom).not.toHaveBeenCalled();
  });
  it("answers 404 to a signed-in user who is not the owner, without reading the ledger", async () => {
    callerProfile.mockResolvedValue({ profileId: "prof", userId: STRANGER, email: null });
    const response = await GET(request("token"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "Not found" });
    expect(readFrom).not.toHaveBeenCalled();
  });
  it("answers 404 to everyone while the owner list is unset", async () => {
    vi.stubEnv("PLATFORM_OWNER_USER_IDS", "");
    callerProfile.mockResolvedValue({ profileId: "prof", userId: OWNER, email: null });
    expect((await GET(request("token"))).status).toBe(404);
    expect(readFrom).not.toHaveBeenCalled();
  });
  it("gives the owner live revenue, uncached", async () => {
    callerProfile.mockResolvedValue({ profileId: "prof", userId: OWNER, email: null });
    const response = await GET(request("token", "?tz=Mars%2FOlympus"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, currency: "USD", timeZone: "UTC" });
    expect(body.allTime).toMatchObject({ contracts: 1, revenueCents: 1_800 });
    expect(body.lines).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("pi_live_1");
  });
  it("does not leak database errors", async () => {
    callerProfile.mockResolvedValue({ profileId: "prof", userId: OWNER, email: null });
    state.db = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ order: () => ({ range: async () => ({ data: null, error: { message: "secret-detail" } }) }) }) }) }) }) };
    const response = await GET(request("token"));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret-detail");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret-detail");
  });
  it("refuses without the service role", async () => {
    state.serviceRole = false;
    callerProfile.mockResolvedValue({ profileId: "prof", userId: OWNER, email: null });
    expect((await GET(request("token"))).status).toBe(503);
  });
});

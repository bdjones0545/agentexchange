import { describe, expect, it } from "vitest";
import { createFunding, FundingError, handleStripeEvent, releaseFunds } from "../server/funding";
import type { ContractMoneyRow, Ledger, PaymentStatus } from "../server/ledger";
import { quoteContract } from "../server/pricing";
import { realStripe, signTestEvent, type StripeGateway } from "../server/stripe";

const ORG_OWNER = "org-profile";
const OPERATOR = "operator-profile";
const CONTRACT = "5c2da035-d87b-4a09-8e9e-ff0578abdcd3";

function fakeLedger(overrides: Partial<ContractMoneyRow> = {}) {
  const contract: ContractMoneyRow = {
    id: CONTRACT, organization_id: "org", agent_id: "agent", title: "One-pager", amount_cents: 18000, currency: "USD",
    payment_status: "unfunded", platform_fee_bps: 1500, status: "In Review", ...overrides,
  };
  const payments: Array<{ contract_id: string; provider_ref: string; kind: string; amount_cents: number; status: string; metadata: unknown }> = [];
  const payouts: Array<Record<string, unknown>> = [];
  const events = new Map<string, { type: string; outcome?: string }>();
  let deliverables = { total: 1, approved: 1, submitted: 0 };
  const ledger: Ledger = {
    async getContract(id) { return id === contract.id ? { ...contract } : null; },
    async setPaymentStatus(_id, status: PaymentStatus) { contract.payment_status = status; },
    async recordPayment(p) { payments.push({ contract_id: p.contractId, provider_ref: p.providerRef, kind: p.kind, amount_cents: p.amountCents, status: p.status, metadata: p.metadata ?? {} }); },
    async updatePayment(ref, patch) { const p = payments.find((x) => x.provider_ref === ref); if (!p) return; if (patch.status) p.status = patch.status; if (patch.providerRef) p.provider_ref = patch.providerRef; },
    async findPaymentByRef(ref) { const p = payments.find((x) => x.provider_ref === ref); return p ? { contract_id: p.contract_id, status: p.status } : null; },
    async recordPayout(p) { payouts.push({ ...p, netCents: p.grossCents - p.feeCents }); },
    async claimEvent(id, type) { if (events.has(id)) return false; events.set(id, { type }); return true; },
    async finishEvent(id, outcome) { const e = events.get(id); if (e) e.outcome = outcome; },
    async operatorProfileForAgent() { return OPERATOR; },
    async organizationOwner() { return ORG_OWNER; },
    async authorizedPaymentRef(id) { const p = payments.find((x) => x.contract_id === id && x.kind === "charge" && x.status === "authorized"); return p?.provider_ref ?? null; },
    async deliverableSummary() { return deliverables; },
  };
  return { ledger, contract, payments, payouts, events, setDeliverables: (d: typeof deliverables) => { deliverables = d; } };
}

function fakeStripe(log: string[] = []): StripeGateway & { log: string[] } {
  return {
    log,
    async createCheckoutSession(input) { log.push(`checkout ${input.amountCents}+${input.buyerFeeCents} ${input.currency} ${input.successUrl}`); return { id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" }; },
    async capturePaymentIntent(id) { log.push(`capture ${id}`); return { id, status: "succeeded", amountReceived: 18540 }; },
    async cancelPaymentIntent(id) { log.push(`cancel ${id}`); return { id, status: "canceled" }; },
    async refundPaymentIntent(id) { log.push(`refund ${id}`); return { id: "re_1", status: "succeeded" }; },
    constructEvent() { throw new Error("not used"); },
  };
}

const deps = (ledger: Ledger, stripe: StripeGateway, notify?: (e: { event: string; contractId: string }) => Promise<unknown>) => ({ ledger, stripe, appUrl: "https://www.agentsexchange.ai", notify });

describe("pricing", () => {
  it("quotes 3% on top for the buyer and 15% out of the price for the platform", () => {
    expect(quoteContract(18000, 1500)).toEqual({ amountCents: 18000, buyerFeeCents: 540, totalCents: 18540, platformFeeCents: 2700, operatorNetCents: 15300, currency: "USD" });
    expect(quoteContract(6000, 1500).platformFeeCents).toBe(900);
    // Minimum platform fee applies below $33.34 at 15%; minimum contract is $50.
    expect(() => quoteContract(4999, 1500)).toThrow(/at least/);
    expect(quoteContract(5000, 0).platformFeeCents).toBe(500);
  });
});

describe("createFunding", () => {
  it("creates a manual-capture checkout for price + fee and records a pending payment", async () => {
    const f = fakeLedger();
    const s = fakeStripe();
    const r = await createFunding(deps(f.ledger, s), { contractId: CONTRACT, callerProfileId: ORG_OWNER });
    expect(r.url).toBe("https://checkout.stripe.test/cs_test_1");
    expect(r.quote.totalCents).toBe(18540);
    expect(s.log[0]).toBe(`checkout 18000+540 USD https://www.agentsexchange.ai/contracts/${CONTRACT}?funding=complete`);
    expect(f.payments).toEqual([expect.objectContaining({ provider_ref: "cs_test_1", status: "pending", amount_cents: 18540, kind: "charge" })]);
    // Funding is not authorized until Stripe says so.
    expect(f.contract.payment_status).toBe("unfunded");
  });
  it("refuses the agent side, an unpriced contract, and a contract that is not unfunded", async () => {
    await expect(createFunding(deps(fakeLedger().ledger, fakeStripe()), { contractId: CONTRACT, callerProfileId: OPERATOR })).rejects.toMatchObject({ status: 403 });
    await expect(createFunding(deps(fakeLedger({ amount_cents: null }).ledger, fakeStripe()), { contractId: CONTRACT, callerProfileId: ORG_OWNER })).rejects.toMatchObject({ status: 409 });
    await expect(createFunding(deps(fakeLedger({ payment_status: "authorized" }).ledger, fakeStripe()), { contractId: CONTRACT, callerProfileId: ORG_OWNER })).rejects.toMatchObject({ status: 409 });
    await expect(createFunding(deps(fakeLedger().ledger, fakeStripe()), { contractId: "00000000-0000-4000-8000-000000000000", callerProfileId: ORG_OWNER })).rejects.toBeInstanceOf(FundingError);
  });
});

describe("webhook", () => {
  it("checkout.session.completed authorizes the hold, rekeys the payment, and pokes the worker once", async () => {
    const f = fakeLedger();
    const s = fakeStripe();
    await createFunding(deps(f.ledger, s), { contractId: CONTRACT, callerProfileId: ORG_OWNER });
    const notified: string[] = [];
    const d = deps(f.ledger, s, async (e) => { notified.push(e.event); });
    const event = { id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_test_1", payment_intent: "pi_1", metadata: { contractId: CONTRACT } } } };
    expect(await handleStripeEvent(d, event)).toEqual({ outcome: "authorized", contractId: CONTRACT });
    expect(f.contract.payment_status).toBe("authorized");
    expect(f.payments[0]).toMatchObject({ provider_ref: "pi_1", status: "authorized" });
    expect(notified).toEqual(["contract_funded"]);
    // Redelivery: claimed once, nothing repeats.
    expect(await handleStripeEvent(d, event)).toEqual({ outcome: "duplicate", contractId: CONTRACT });
    expect(notified).toEqual(["contract_funded"]);
  });
  it("a canceled hold returns the contract to unfunded; a refund marks it refunded", async () => {
    const f = fakeLedger({ payment_status: "authorized" });
    f.payments.push({ contract_id: CONTRACT, provider_ref: "pi_1", kind: "charge", amount_cents: 18540, status: "authorized", metadata: {} });
    const d = deps(f.ledger, fakeStripe());
    expect((await handleStripeEvent(d, { id: "evt_2", type: "payment_intent.canceled", data: { object: { id: "pi_1" } } })).outcome).toBe("hold released");
    expect(f.contract.payment_status).toBe("unfunded");
    f.contract.payment_status = "captured";
    f.payments[0].status = "captured";
    expect((await handleStripeEvent(d, { id: "evt_3", type: "charge.refunded", data: { object: { payment_intent: "pi_1", amount_refunded: 18540, currency: "usd" } } })).outcome).toBe("refunded");
    expect(f.contract.payment_status).toBe("refunded");
    expect(f.payments[1]).toMatchObject({ kind: "refund", amount_cents: 18540, status: "refunded" });
  });
  it("unknown events are recorded and ignored, never an error", async () => {
    const f = fakeLedger();
    expect((await handleStripeEvent(deps(f.ledger, fakeStripe()), { id: "evt_x", type: "customer.created", data: { object: {} } })).outcome).toBe("ignored: customer.created");
    expect(f.events.get("evt_x")?.outcome).toBe("ignored: customer.created");
  });
  it("verifies signatures with the real SDK and rejects a tampered body", () => {
    const stripe = realStripe("sk_test_dummy");
    const secret = "whsec_test_secret";
    const payload = JSON.stringify({ id: "evt_sig", object: "event", type: "checkout.session.completed", data: { object: { id: "cs_1" } } });
    const header = signTestEvent(payload, secret);
    expect(stripe.constructEvent(payload, header, secret).id).toBe("evt_sig");
    expect(() => stripe.constructEvent(payload.replace("cs_1", "cs_2"), header, secret)).toThrow();
    expect(() => stripe.constructEvent(payload, header, "whsec_other")).toThrow();
  });
});

describe("releaseFunds", () => {
  it("captures only when every deliverable is approved, then records the payout split", async () => {
    const f = fakeLedger({ payment_status: "authorized" });
    f.payments.push({ contract_id: CONTRACT, provider_ref: "pi_1", kind: "charge", amount_cents: 18540, status: "authorized", metadata: {} });
    const s = fakeStripe();
    f.setDeliverables({ total: 1, approved: 0, submitted: 1 });
    await expect(releaseFunds(deps(f.ledger, s), { contractId: CONTRACT, callerProfileId: ORG_OWNER, action: "capture" })).rejects.toMatchObject({ status: 409 });
    expect(s.log).toEqual([]);
    f.setDeliverables({ total: 1, approved: 1, submitted: 0 });
    const r = await releaseFunds(deps(f.ledger, s), { contractId: CONTRACT, callerProfileId: ORG_OWNER, action: "capture" });
    expect(r.paymentStatus).toBe("captured");
    expect(s.log).toEqual(["capture pi_1"]);
    expect(f.contract.payment_status).toBe("captured");
    expect(f.payouts).toEqual([expect.objectContaining({ contractId: CONTRACT, operatorProfileId: OPERATOR, grossCents: 18000, feeCents: 2700, netCents: 15300 })]);
  });
  it("the agent side cannot release, and nothing is captured on an unfunded contract", async () => {
    const f = fakeLedger({ payment_status: "authorized" });
    await expect(releaseFunds(deps(f.ledger, fakeStripe()), { contractId: CONTRACT, callerProfileId: OPERATOR, action: "capture" })).rejects.toMatchObject({ status: 403 });
    const g = fakeLedger();
    await expect(releaseFunds(deps(g.ledger, fakeStripe()), { contractId: CONTRACT, callerProfileId: ORG_OWNER, action: "capture" })).rejects.toMatchObject({ status: 409 });
  });
  it("cancel releases the hold and returns the contract to unfunded", async () => {
    const f = fakeLedger({ payment_status: "authorized" });
    f.payments.push({ contract_id: CONTRACT, provider_ref: "pi_1", kind: "charge", amount_cents: 18540, status: "authorized", metadata: {} });
    const s = fakeStripe();
    expect((await releaseFunds(deps(f.ledger, s), { contractId: CONTRACT, callerProfileId: ORG_OWNER, action: "cancel" })).paymentStatus).toBe("unfunded");
    expect(s.log).toEqual(["cancel pi_1"]);
    expect(f.payments[0].status).toBe("failed");
  });
});

import { memoryOperations } from "./money-operation-store";
import { MoneyOperationError } from "../server/moneyOperations";
import { describe, expect, it } from "vitest";
import { createCardSetup, createFunding, FundingError, fundWithSavedCard, handleStripeEvent, releaseFunds } from "../server/funding";
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
  let billing: { profile_id: string; stripe_customer_id: string | null; default_payment_method_id: string | null; card_brand: string | null; card_last4: string | null; agent_daily_cap_cents: number; agent_per_contract_cap_cents?: number } | null = null;
  let agentSpent = 0;
  const ledger: Ledger = {
    async getBillingAccount(profileId) { return billing && billing.profile_id === profileId ? { ...billing, agent_per_contract_cap_cents: billing.agent_per_contract_cap_cents ?? 100000 } : null; },
    async upsertBillingAccount(profileId, patch) { billing = { profile_id: profileId, stripe_customer_id: null, default_payment_method_id: null, card_brand: null, card_last4: null, agent_daily_cap_cents: 100000, ...(billing ?? {}), ...patch } as typeof billing; },
    async agentSpendLast24h() { return agentSpent; },
    async getContract(id) { return id === contract.id ? { ...contract } : null; },
    async setPaymentStatus(_id, status: PaymentStatus) { contract.payment_status = status; },
    async recordPayment(p) { if(payments.some(x=>x.provider_ref===p.providerRef))return; payments.push({ contract_id: p.contractId, provider_ref: p.providerRef, kind: p.kind, amount_cents: p.amountCents, status: p.status, metadata: p.metadata ?? {} }); },
    async updatePayment(ref, patch) { const p = payments.find((x) => x.provider_ref === ref); if (!p) return; if (patch.status) p.status = patch.status; if (patch.providerRef) p.provider_ref = patch.providerRef; },
    async findPaymentByRef(ref) { const p = payments.find((x) => x.provider_ref === ref); return p ? { contract_id: p.contract_id, status: p.status } : null; },
    async recordPayout(p) { if(payouts.some(x=>x.contractId===p.contractId))return; payouts.push({ ...p, netCents: p.grossCents - p.feeCents }); },
    async claimEvent(id, type) { if (events.has(id)) return false; events.set(id, { type }); return true; },
    async finishEvent(id, outcome) { const e = events.get(id); if (e) e.outcome = outcome; },
    async operatorProfileForAgent() { return OPERATOR; },
    async organizationOwner() { return ORG_OWNER; },
    async authorizedPaymentRef(id) { const p = payments.find((x) => x.contract_id === id && x.kind === "charge" && ["authorized","captured"].includes(x.status)); return p?.provider_ref ?? null; },
    async deliverableSummary() { return deliverables; },
  };
  return { ledger, contract, payments, payouts, events, setDeliverables: (d: typeof deliverables) => { deliverables = d; }, setBilling: (b: typeof billing) => { billing = b; }, setAgentSpent: (c: number) => { agentSpent = c; } };
}

function fakeStripe(log: string[] = [], holdStatus = "requires_capture"): StripeGateway & { log: string[] } {
  return {
    log,
    async createCustomer(input) { log.push(`customer ${input.profileId}`); return { id: "cus_1" }; },
    async createSetupSession(input) { log.push(`setup ${input.customerId}`); return { id: "cs_setup_1", url: "https://checkout.stripe.test/setup" }; },
    async retrieveSetupIntentPaymentMethod(id) { log.push(`setupintent ${id}`); return "pm_1"; },
    async retrievePaymentMethod(id) { return { id, brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 }; },
    async retrievePaymentIntent(id) { return {id,status:'requires_capture',amount:18540,amountReceived:0,currency:'USD',contractId:CONTRACT,chargeId:'ch_1',captureBefore:Math.floor(Date.now()/1000)+3600,refunded:0,disputed:false}; },
    async createOffSessionHold(input) { log.push(`hold ${input.amountCents} ${input.customerId} ${input.paymentMethodId}`); return { id: "pi_agent_1", status: holdStatus }; },
    async createCheckoutSession(input) { log.push(`checkout ${input.amountCents}+${input.buyerFeeCents} ${input.currency} ${input.successUrl}`); return { id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" }; },
    async capturePaymentIntent(id) { log.push(`capture ${id}`); return { id, status: "succeeded", amountReceived: 18540 }; },
    async cancelPaymentIntent(id) { log.push(`cancel ${id}`); return { id, status: "canceled" }; },
    async refundPaymentIntent(id) { log.push(`refund ${id}`); return { id: "re_1", status: "succeeded" }; },
    constructEvent() { throw new Error("not used"); },
  };
}

const stores = new WeakMap<Ledger, ReturnType<typeof memoryOperations>>();
const deps = (ledger: Ledger, stripe: StripeGateway, notify?: (e: { event: string; contractId: string }) => Promise<unknown>) => {
  let operations=stores.get(ledger);
  if(!operations) {
    operations=memoryOperations(async op=>{
      if(op.kind==='fund_agent') {
        const b=await ledger.getBillingAccount(op.profileId!);
        if(b && (await ledger.agentSpendLast24h(op.profileId!))+(op.amountCents ?? 0)>b.agent_daily_cap_cents) throw new MoneyOperationError(429,'agent spend cap');
      }
    }); stores.set(ledger,operations);
  }
  return {ledger,stripe,operations,appUrl:'https://www.agentsexchange.ai',notify};
};

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
    expect(await handleStripeEvent(d, event)).toEqual({ outcome: "authorized", contractId: CONTRACT });
    expect(notified).toEqual(["contract_funded"]);
  });
  it("a canceled hold returns the contract to unfunded; a refund marks it refunded", async () => {
    const f = fakeLedger({ payment_status: "authorized" });
    f.payments.push({ contract_id: CONTRACT, provider_ref: "pi_1", kind: "charge", amount_cents: 18540, status: "authorized", metadata: {} });
    const d = deps(f.ledger, fakeStripe());
    expect((await handleStripeEvent(d, { id: "evt_2", type: "payment_intent.canceled", data: { object: { id: "pi_1" } } })).outcome).toBe("hold released");
    expect(f.contract.payment_status).toBe("unfunded");
    d.stripe.retrievePaymentIntent=async id=>({id,status:"succeeded",amount:18540,amountReceived:18540,currency:"USD",contractId:CONTRACT,chargeId:"ch_1",captureBefore:null,refunded:18540,disputed:false});
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

describe("agent card", () => {
  it("card setup creates the customer once and returns the Stripe page", async () => {
    const f = fakeLedger();
    const s = fakeStripe();
    const r = await createCardSetup(deps(f.ledger, s), { profileId: ORG_OWNER, email: "org@test" });
    expect(r.url).toBe("https://checkout.stripe.test/setup");
    await createCardSetup(deps(f.ledger, s), { profileId: ORG_OWNER });
    expect(s.log.filter((l) => l.startsWith("customer"))).toHaveLength(1);
  });

  it("the setup webhook saves the payment method for the operator", async () => {
    const f = fakeLedger();
    const s = fakeStripe();
    f.setBilling({ profile_id: ORG_OWNER, stripe_customer_id: "cus_1", default_payment_method_id: null, card_brand: null, card_last4: null, agent_daily_cap_cents: 100000 });
    const r = await handleStripeEvent(deps(f.ledger, s), { id: "evt_setup", type: "checkout.session.completed", data: { object: { id: "cs_setup_1", mode: "setup", customer:"cus_1", setup_intent: "seti_1", metadata: { profileId: ORG_OWNER, purpose: "agent_card" } } } });
    expect(r.outcome).toBe("card saved");
    expect(await f.ledger.getBillingAccount(ORG_OWNER)).toMatchObject({ default_payment_method_id: "pm_1", card_brand: "visa", card_last4: "4242" });
  });

  it("an agent funds a contract off-session within the cap; the ledger marks it authorized_by agent", async () => {
    const f = fakeLedger();
    const s = fakeStripe();
    const notified: string[] = [];
    f.setBilling({ profile_id: ORG_OWNER, stripe_customer_id: "cus_1", default_payment_method_id: "pm_1", card_brand: "visa", card_last4: "4242", agent_daily_cap_cents: 100000 });
    const r = await fundWithSavedCard(deps(f.ledger, s, async (e) => { notified.push(e.event); }), { contractId: CONTRACT, callerProfileId: ORG_OWNER });
    expect(r.paymentStatus).toBe("authorized");
    expect(r.quote.totalCents).toBe(18540);
    expect(s.log).toEqual(["hold 18540 cus_1 pm_1"]);
    expect(f.contract.payment_status).toBe("authorized");
    expect(f.payments[0]).toMatchObject({ provider_ref: "pi_agent_1", status: "authorized", amount_cents: 18540 });
    expect(notified).toEqual(["contract_funded"]);
  });

  it("refuses without a saved card, over the cap, from the agent side, and when the hold is declined", async () => {
    const noCard = fakeLedger();
    await expect(fundWithSavedCard(deps(noCard.ledger, fakeStripe()), { contractId: CONTRACT, callerProfileId: ORG_OWNER })).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/no saved card/) });

    const capped = fakeLedger();
    capped.setBilling({ profile_id: ORG_OWNER, stripe_customer_id: "cus_1", default_payment_method_id: "pm_1", card_brand: "visa", card_last4: "4242", agent_daily_cap_cents: 20000 });
    capped.setAgentSpent(5000);
    const s = fakeStripe();
    await expect(fundWithSavedCard(deps(capped.ledger, s), { contractId: CONTRACT, callerProfileId: ORG_OWNER })).rejects.toMatchObject({ status: 429 });
    expect(s.log).toEqual([]);
    expect(capped.contract.payment_status).toBe("unfunded");

    const wrongSide = fakeLedger();
    wrongSide.setBilling({ profile_id: OPERATOR, stripe_customer_id: "cus_2", default_payment_method_id: "pm_2", card_brand: "visa", card_last4: "1111", agent_daily_cap_cents: 100000 });
    await expect(fundWithSavedCard(deps(wrongSide.ledger, fakeStripe()), { contractId: CONTRACT, callerProfileId: OPERATOR })).rejects.toMatchObject({ status: 403 });

    const declined = fakeLedger();
    declined.setBilling({ profile_id: ORG_OWNER, stripe_customer_id: "cus_1", default_payment_method_id: "pm_1", card_brand: "visa", card_last4: "4242", agent_daily_cap_cents: 100000 });
    await expect(fundWithSavedCard(deps(declined.ledger, fakeStripe([], "requires_payment_method")), { contractId: CONTRACT, callerProfileId: ORG_OWNER })).rejects.toMatchObject({ status: 409 });
    expect(declined.contract.payment_status).toBe("unfunded");
    expect(declined.payments).toEqual([]);
  });
});

describe('dedicated agent cards',()=>{
 function ready(){const f=fakeLedger();f.setBilling({profile_id:ORG_OWNER,stripe_customer_id:'cus_1',default_payment_method_id:'pm_shared',card_brand:'visa',card_last4:'4242',agent_daily_cap_cents:100000});return f;}
 it('funds from the dedicated card and binds the choice to the operation',async()=>{const f=ready();f.ledger.getAgentCard=async()=>({mode:'dedicated',payment_method_id:'pm_dedicated'});const s=fakeStripe();await fundWithSavedCard(deps(f.ledger,s),{contractId:CONTRACT,callerProfileId:ORG_OWNER,agentKeyId:'key'});expect(s.log).toContain('hold 18540 cus_1 pm_dedicated');expect(s.log.join()).not.toContain('pm_shared');});
 it('never falls back when dedicated setup is incomplete',async()=>{const f=ready();f.ledger.getAgentCard=async()=>({mode:'dedicated',payment_method_id:null});const s=fakeStripe();await expect(fundWithSavedCard(deps(f.ledger,s),{contractId:CONTRACT,callerProfileId:ORG_OWNER,agentKeyId:'key'})).rejects.toThrow('incomplete');expect(s.log).toEqual([]);});
 it('stops recovery when the selected card changed',async()=>{const f=ready();f.ledger.getAgentCard=async()=>({mode:'dedicated',payment_method_id:'pm_new'});const s=fakeStripe();await expect(fundWithSavedCard(deps(f.ledger,s),{contractId:CONTRACT,callerProfileId:ORG_OWNER,agentKeyId:'key',selectedPaymentMethod:'pm_old'})).rejects.toThrow('Card changed');expect(s.log).toEqual([]);});
 it('dedicated setup webhook leaves the owner shared card unchanged',async()=>{const f=ready();let saved:unknown;f.ledger.saveAgentCard=async(...args)=>{saved=args;return true;};await handleStripeEvent(deps(f.ledger,fakeStripe()),{id:'evt_dedicated',type:'checkout.session.completed',data:{object:{id:'cs',mode:'setup',customer:'cus_1',setup_intent:'si',metadata:{purpose:'agent_card',profileId:ORG_OWNER,agentKeyId:'key',setupToken:'nonce'}}}});expect(saved).toMatchObject([ORG_OWNER,'key','nonce',{id:'pm_1'}]);expect((await f.ledger.getBillingAccount(ORG_OWNER))?.default_payment_method_id).toBe('pm_shared');});
 it('ignores superseded dedicated setup without changing the shared card',async()=>{const f=ready();f.ledger.saveAgentCard=async()=>false;await handleStripeEvent(deps(f.ledger,fakeStripe()),{id:'evt_stale',type:'checkout.session.completed',data:{object:{id:'cs',mode:'setup',customer:'cus_1',setup_intent:'si',metadata:{purpose:'agent_card',profileId:ORG_OWNER,agentKeyId:'key',setupToken:'old'}}}});expect(f.events.get('evt_stale')?.outcome).toMatch(/superseded/);expect((await f.ledger.getBillingAccount(ORG_OWNER))?.default_payment_method_id).toBe('pm_shared');});
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The 2026-10-15 run: checkout.session.completed is processed and funding calls
// notify({event: "contract_funded"}). Everything up to the worker's /turn is real
// dispatch code; the ledger, Stripe and the funding core are stubbed.
const CONTRACT = "6a1867df-a217-452b-85e0-43ca6147e3fa";
const WORKER = {
  name: "agentexchange",
  mcpKey: "ax_0123456789abcdef0123456789abcdef",
  email: "worker@example.com",
  password: "correct horse battery",
  turnUrl: "https://worker.example.test/turn",
  turnToken: "tok_0123456789abcdef0123456789",
};
vi.mock("../server/config.js", () => ({
  readServerEnv: () => ({ supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "anon", paymentsEnabled: true, appUrl: "https://x.test", workers: [WORKER] }),
}));
vi.mock("../server/stripe.js", () => ({
  realStripe: () => ({ constructEvent: () => ({ id: "evt_1", type: "checkout.session.completed", data: { object: { metadata: { contractId: CONTRACT } } } }) }),
}));
vi.mock("../server/ledger.js", () => ({ supabaseLedger: () => ({}) }));
vi.mock("../server/moneyOperations.js", () => ({ operationStore: () => ({}) }));
vi.mock("../server/funding.js", () => ({
  handleStripeEvent: async (deps: { notify: (e: { event: "contract_funded"; contractId: string }) => Promise<unknown> }) => {
    await deps.notify({ event: "contract_funded", contractId: CONTRACT });
    return { outcome: "authorized", contractId: CONTRACT };
  },
}));
// The worker's session can see the contract: it is a party.
vi.mock("../server/operator.js", () => ({
  operatorSession: async () => ({
    client: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: CONTRACT }, error: null }) }) }) }) },
  }),
}));
import { POST } from "../api/stripe-webhook";

const request = () => new Request("https://x.test/api/stripe-webhook", { method: "POST", headers: { "stripe-signature": "t=1,v1=x" }, body: "{}" });

describe("stripe webhook → worker dispatch", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("an accepted contract_funded dispatch is logged as one counts-only line", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, accepted: true, jobId: "job_0123456789abcdef" }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(WORKER.turnUrl);
    expect(JSON.parse(init.body as string)).toMatchObject({ event: "contract_funded", contractId: CONTRACT });
    expect(console.error).not.toHaveBeenCalled();
    expect(vi.mocked(console.info).mock.calls.map((c) => JSON.parse(c[0] as string))).toEqual([
      { event: "worker_dispatch", source: "stripe_webhook", type: "contract_funded", workers: 1, accepted: 1, notParty: 0, noRuntime: 0, failed: 0, failures: {} },
    ]);
  });

  it("a runtime that does not know contract_funded no longer fails silently", async () => {
    // The answer from a server.py whose EVENTS predates contract_funded.
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "unknown event 'contract_funded'" }), { status: 400 })));
    const res = await POST(request());
    // Dispatch is best-effort: the money side still succeeds and Stripe is not asked to retry.
    expect(res.status).toBe(200);
    expect(vi.mocked(console.error).mock.calls.map((c) => JSON.parse(c[0] as string))).toEqual([
      { event: "worker_dispatch", source: "stripe_webhook", type: "contract_funded", workers: 1, accepted: 0, notParty: 0, noRuntime: 0, failed: 1, failures: { runtime_400: 1 } },
    ]);
    const logged = JSON.stringify([vi.mocked(console.info).mock.calls, vi.mocked(console.error).mock.calls]);
    for (const leak of [CONTRACT, WORKER.turnToken, WORKER.email, WORKER.name, "unknown event"]) expect(logged).not.toContain(leak);
  });

  it("does not answer Stripe before the runtime has answered", async () => {
    let answered = false;
    vi.stubGlobal("fetch", vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 30));
      answered = true;
      return new Response(JSON.stringify({ ok: true, jobId: "job_1" }), { status: 202 });
    }));
    await POST(request());
    expect(answered).toBe(true);
  });
});

// The "order accepted, please fund" email: the buyer hears when the seller's
// move creates their contract, once, and never when they made the final move.
import { afterEach, describe, expect, it, vi } from "vitest";
import { contractAcceptedNotifier, notifierFromEnv, resendSender, type EmailMessage, type NotifierDeps } from "../server/notifications";
import { TOOLS, type ToolContext } from "../server/mcp/tools";
import { fakeDb } from "./fakeSupabase";

const OWNER = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const HIRE = "33333333-3333-4333-8333-333333333333";
const CONTRACT = "44444444-4444-4444-8444-444444444444";
const NEGOTIATION = "55555555-5555-4555-8555-555555555555";
const APPLICATION = "66666666-6666-4666-8666-666666666666";
const NOW = Date.parse("2026-11-27T12:00:00.000Z");
const BUYER_NOTE = "BUYER-PRIVATE-NOTE: our launch is on the 3rd, keep it quiet";
const BRIEF_TEXT = "BRIEF-TEXT: full description of what the buyer needs";

type Row = Record<string, unknown>;

function world(contract: Row = {}, negotiation: Row = {}) {
  const tables: Record<string, Row[]> = {
    profiles: [{ id: OWNER, email: "buyer@acme.test", user_id: "u-1" }],
    organizations: [{ id: ORG, owner_id: OWNER, name: "Acme" }],
    opportunities: [{ id: "o-1", title: "Competitor pricing scan", description: BRIEF_TEXT }],
    hire_requests: [{ id: HIRE, status: "accepted", note: BUYER_NOTE, amount_cents: 25000 }],
    negotiations: [{ id: NEGOTIATION, status: "accepted", accepted_by: "agent", ...negotiation }],
    contracts: [
      {
        id: CONTRACT,
        organization_id: ORG,
        title: "Competitor pricing scan",
        agent_name: "Hermes Analyst",
        source_type: "hire-request",
        source_id: HIRE,
        status: "Active",
        payment_status: "unfunded",
        amount_cents: 25000,
        currency: "USD",
        created_at: new Date(NOW - 60_000).toISOString(),
        ...contract,
      },
    ],
    email_notifications: [],
  };
  const db = fakeDb({
    tables,
    rpc: (name, args) => {
      if (name !== "organization_owner_email") return { data: null, error: { message: `Could not find the function public.${name}`, code: "PGRST202" } };
      const org = tables.organizations.find((o) => o.id === args.org_id);
      return { data: (tables.profiles.find((p) => p.id === org?.owner_id)?.email as string | undefined) ?? null, error: null };
    },
    refuseInsert: (table, row) =>
      table === "email_notifications" && tables.email_notifications.some((r) => r.key === row.key) ? { message: "duplicate key value", code: "23505" } : null,
  });
  return { db, tables };
}

function notifier(db: ReturnType<typeof fakeDb>, extra: Partial<NotifierDeps> = {}) {
  const log = vi.fn();
  const requests: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    requests.push({ url, headers: init.headers as Record<string, string>, body: String(init.body) });
    return new Response(JSON.stringify({ id: "re_456" }), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  const notify = contractAcceptedNotifier(
    {
      apiKey: "re_test_key",
      appUrl: "https://www.agentsexchange.ai",
      paymentsEnabled: true,
      db: () => db,
      send: resendSender("re_test_key", "AgentExchange <notifications@agentsexchange.ai>", fetchImpl),
      log,
      ...extra,
    },
    () => NOW,
  );
  return { notify, log, requests };
}

describe("order accepted email", () => {
  it("emails the buyer once when the seller accepts their hire request, however many times it is triggered", async () => {
    const { db, tables } = world();
    const { notify, requests } = notifier(db);

    expect(await notify(CONTRACT, "mcp")).toEqual({ status: "sent", key: `contract-accepted/${CONTRACT}` });
    expect(await notify(CONTRACT, "browser")).toEqual({ status: "skipped", reason: "already_sent" });
    expect(await notify(CONTRACT, "mcp")).toEqual({ status: "skipped", reason: "already_sent" });

    expect(requests).toHaveLength(1);
    expect(tables.email_notifications).toHaveLength(1);
    expect(tables.email_notifications[0]).toMatchObject({ kind: "contract_accepted", contract_id: CONTRACT, provider_id: "re_456" });
    expect(tables.email_notifications[0].sent_at).toEqual(expect.any(String));
  });

  it("emails the buyer once when the agent accepts the buyer's counter", async () => {
    const { db } = world({ source_type: "negotiation", source_id: NEGOTIATION }, { accepted_by: "agent" });
    const { notify, requests } = notifier(db);
    expect(await notify(CONTRACT, "mcp")).toEqual({ status: "sent", key: `contract-accepted/${CONTRACT}` });
    expect(await notify(CONTRACT, "mcp")).toEqual({ status: "skipped", reason: "already_sent" });
    expect(requests).toHaveLength(1);
  });

  it("says who accepted, what, at what price, how funding works, and links to the contract; nothing from the note or brief", async () => {
    const { db } = world();
    const { notify, requests } = notifier(db);
    await notify(CONTRACT, "mcp");

    const [req] = requests;
    expect(req.url).toBe("https://api.resend.com/emails");
    expect(req.headers["idempotency-key"]).toBe(`contract-accepted/${CONTRACT}`);
    const payload = JSON.parse(req.body) as { to: string[]; subject: string; text: string; html: string };
    expect(payload.to).toEqual(["buyer@acme.test"]);
    expect(payload.subject).toBe("Hermes Analyst accepted your request for Competitor pricing scan");
    expect(payload.text).toContain("Hermes Analyst accepted your request for Competitor pricing scan at $250.");
    expect(payload.text).toContain("Funding places a hold on your card");
    expect(payload.text).toContain("about seven days");
    expect(payload.text).toContain(`https://www.agentsexchange.ai/contracts/${CONTRACT}`);
    expect(payload.html).toContain(`https://www.agentsexchange.ai/contracts/${CONTRACT}`);
    expect(payload.html).toContain("Fund the contract");
    expect(JSON.stringify(req)).not.toContain("BUYER-PRIVATE-NOTE");
    expect(JSON.stringify(req)).not.toContain("BRIEF-TEXT");
  });

  it("says 'your order' instead of repeating the name when the listing is named for what it sells", async () => {
    const { contractAcceptedEmail } = await import("../server/notifications");
    const email = contractAcceptedEmail({
      to: "buyer@acme.test",
      key: "k",
      contractTitle: "Local Partner List: 60 verified organizations near you",
      agentName: "Local Partner List: 60 verified organizations near you",
      price: "$550",
      contractUrl: "https://www.agentsexchange.ai/contracts/x",
    });
    expect(email.subject).toBe("Your order for Local Partner List: 60 verified organizations near you was accepted — fund it to start");
    expect(email.text).toContain("Your order for Local Partner List: 60 verified organizations near you was accepted at $550.");
    expect(email.text).not.toMatch(/near you accepted your request/);
    expect(email.html).toContain("Your order for Local Partner List");
  });

  it("sends nothing when the buyer made the final move", async () => {
    for (const [contract, negotiation] of [
      [{ source_type: "application", source_id: APPLICATION }, {}],
      [{ source_type: "negotiation", source_id: NEGOTIATION }, { accepted_by: "organization" }],
      [{ source_type: "negotiation", source_id: NEGOTIATION }, { accepted_by: null }],
      [{ source_type: "renewal", source_id: CONTRACT }, {}],
    ] as Array<[Row, Row]>) {
      const { db, tables } = world(contract, negotiation);
      const { notify, requests } = notifier(db);
      expect(await notify(CONTRACT, "browser"), JSON.stringify(contract)).toEqual({ status: "skipped", reason: "buyer_accepted" });
      expect(requests).toHaveLength(0);
      expect(tables.email_notifications).toHaveLength(0);
    }
  });

  it("sends nothing for a contract that no longer waits for funding, or an old one", async () => {
    for (const contract of [{ status: "Cancelled" }, { payment_status: "authorized" }, { amount_cents: null }]) {
      const { db } = world(contract);
      const { notify, requests } = notifier(db);
      expect(await notify(CONTRACT, "mcp"), JSON.stringify(contract)).toEqual({ status: "skipped", reason: "not_awaiting_funding" });
      expect(requests).toHaveLength(0);
    }
    const { db } = world({ created_at: new Date(NOW - 25 * 60 * 60 * 1000).toISOString() });
    const { notify, requests } = notifier(db);
    expect(await notify(CONTRACT, "mcp")).toEqual({ status: "skipped", reason: "stale" });
    expect(requests).toHaveLength(0);
  });

  it("is a no-op without RESEND_API_KEY, and without payments, saying so once", async () => {
    const { db, tables } = world();
    const log = vi.fn();
    const send = vi.fn<(m: EmailMessage) => Promise<{ id: string | null }>>();
    const deps = { ...notifierFromEnv({ APP_URL: "https://www.agentsexchange.ai", STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh", SUPABASE_SERVICE_ROLE_KEY: "sr" }), db: () => db, log };
    expect(deps.apiKey).toBeUndefined();
    expect(deps.paymentsEnabled).toBe(true);
    const notify = contractAcceptedNotifier(deps, () => NOW);
    expect(await notify(CONTRACT, "mcp")).toEqual({ status: "skipped", reason: "no_api_key" });
    expect(await notify(CONTRACT, "browser")).toEqual({ status: "skipped", reason: "no_api_key" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/RESEND_API_KEY is not set/);

    const paymentsOff = notifier(db, { paymentsEnabled: false, send });
    expect(await paymentsOff.notify(CONTRACT, "mcp")).toEqual({ status: "skipped", reason: "payments_off" });
    expect(await paymentsOff.notify(CONTRACT, "mcp")).toEqual({ status: "skipped", reason: "payments_off" });
    expect(paymentsOff.log).toHaveBeenCalledTimes(1);
    expect(notifierFromEnv({}).paymentsEnabled).toBe(false);

    expect(send).not.toHaveBeenCalled();
    expect(tables.email_notifications).toHaveLength(0);
  });

  it("retries a failed send under the same key", async () => {
    const { db, tables } = world();
    let calls = 0;
    const send = vi.fn(async (m: EmailMessage) => {
      calls += 1;
      if (calls === 1) throw new Error("network down");
      return { id: `re_${m.idempotencyKey.length}` };
    });
    const { notify } = notifier(db, { send });
    expect(await notify(CONTRACT, "mcp")).toEqual({ status: "failed", reason: "unreachable" });
    expect(await notify(CONTRACT, "mcp")).toEqual({ status: "sent", key: `contract-accepted/${CONTRACT}` });
    expect(send.mock.calls.map(([m]) => m.idempotencyKey)).toEqual([`contract-accepted/${CONTRACT}`, `contract-accepted/${CONTRACT}`]);
    expect(tables.email_notifications).toHaveLength(1);
  });

  it("logs outcomes without ids, titles or addresses", async () => {
    const { db } = world();
    const { notify, log } = notifier(db);
    await notify(CONTRACT, "mcp");
    await notify(CONTRACT, "browser");
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain("contract_accepted_email");
    for (const secret of [CONTRACT, HIRE, ORG, "buyer@acme.test", "Competitor pricing scan", "Hermes Analyst"]) expect(logged).not.toContain(secret);
  });

  it("escapes names and titles in the HTML body", async () => {
    const { db } = world({ title: `<img src=x onerror="alert(1)">` });
    const { notify, requests } = notifier(db);
    await notify(CONTRACT, "mcp");
    const payload = JSON.parse(requests[0].body) as { html: string };
    expect(payload.html).not.toContain("<img");
    expect(payload.html).toContain("&lt;img");
  });
});

describe("the seller's accepting tools trigger the buyer email; the buyer's do not", () => {
  const PROFILE = "99999999-9999-4999-8999-999999999999";
  type Run = (input: Row, ctx: ToolContext) => Promise<unknown>;
  const run = (name: string) => TOOLS.find((t) => t.name === name)!.run as unknown as Run;
  const created = { id: CONTRACT, title: "Competitor pricing scan", organization_name: "Acme", agent_name: "Hermes Analyst" };

  function ctxWith(db: ReturnType<typeof fakeDb>, contractAccepted: ToolContext["contractAccepted"]): ToolContext {
    return { open: async () => ({ db, profileId: PROFILE }), worker: "agentexchange", now: () => "2026-11-27T12:00:00.000Z", paymentsEnabled: true, gate: null, contractAccepted };
  }
  const seeded = () =>
    fakeDb({
      tables: {
        hire_requests: [{ id: HIRE, status: "pending" }],
        negotiations: [{ id: NEGOTIATION, status: "countered", counter_amount_cents: 25000, amount_cents: 30000 }],
      },
      rpc: (name) =>
        name === "materialize_hire_request_contract" || name === "materialize_negotiation_contract"
          ? { data: created, error: null }
          : { data: null, error: { message: `no ${name}` } },
    });

  it("respond_to_hire_request accept passes the new contract's id", async () => {
    const hook = vi.fn(async () => ({ status: "sent" }));
    const out = (await run("respond_to_hire_request")({ hireRequestId: HIRE, decision: "accept" }, ctxWith(seeded(), hook))) as { ok: boolean };
    expect(out.ok).toBe(true);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith(CONTRACT);
  });

  it("respond_to_hire_request decline sends nothing", async () => {
    const hook = vi.fn(async () => ({}));
    const out = (await run("respond_to_hire_request")({ hireRequestId: HIRE, decision: "decline" }, ctxWith(seeded(), hook))) as { ok: boolean };
    expect(out.ok).toBe(true);
    expect(hook).not.toHaveBeenCalled();
  });

  it("respond_to_negotiation accept passes the new contract's id", async () => {
    const hook = vi.fn(async () => ({ status: "sent" }));
    const out = (await run("respond_to_negotiation")({ negotiationId: NEGOTIATION, decision: "accept" }, ctxWith(seeded(), hook))) as { ok: boolean };
    expect(out.ok).toBe(true);
    expect(hook).toHaveBeenCalledWith(CONTRACT);
  });

  it("a failing notifier never fails the acceptance", async () => {
    const boom = async () => {
      throw new Error("resend down");
    };
    expect(((await run("respond_to_hire_request")({ hireRequestId: HIRE, decision: "accept" }, ctxWith(seeded(), boom))) as { ok: boolean }).ok).toBe(true);
    expect(((await run("respond_to_negotiation")({ negotiationId: NEGOTIATION, decision: "accept" }, ctxWith(seeded(), boom))) as { ok: boolean }).ok).toBe(true);
  });

  it("the buyer's accept_negotiation sends nothing", async () => {
    const hook = vi.fn(async () => ({}));
    const db = seeded();
    await db.from("negotiations").update({ status: "pending" }).eq("id", NEGOTIATION);
    const out = (await run("accept_negotiation")({ negotiationId: NEGOTIATION }, ctxWith(db, hook))) as { ok: boolean };
    expect(out.ok).toBe(true);
    expect(hook).not.toHaveBeenCalled();
  });
});

describe("POST /api/notifications with contract_accepted", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../server/config.js");
    vi.doUnmock("../server/notifications.js");
    vi.doUnmock("../server/caller.js");
  });

  async function route(canSee: boolean, signedIn = true) {
    const notify = vi.fn(async () => ({ status: "sent", key: "k" }));
    const deliverable = vi.fn(async () => ({ status: "sent", key: "k" }));
    vi.doMock("../server/config.js", () => ({ readServerEnv: () => ({ supabaseUrl: "https://db.test", supabaseAnonKey: "anon", workers: [], paymentsEnabled: true, appUrl: "https://example.test" }) }));
    vi.doMock("../server/notifications.js", () => ({
      callerCanSeeContract: async () => canSee,
      callerCanSeeDeliverable: async () => false,
      notifyContractAccepted: notify,
      notifyDeliverableSubmitted: deliverable,
    }));
    vi.doMock("../server/caller.js", async (importActual) => ({ ...(await importActual<typeof import("../server/caller.js")>()), callerProfile: async () => (signedIn ? { profileId: "p" } : null) }));
    const { POST } = await import("../api/notifications");
    return { POST, notify, deliverable };
  }
  const req = (body: unknown, auth = "Bearer user-token") =>
    new Request("https://example.test/api/notifications", { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(body) });

  it("hands a visible contract to the acceptance notifier", async () => {
    const { POST, notify, deliverable } = await route(true);
    const res = await POST(req({ event: "contract_accepted", contractId: CONTRACT }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "sent" });
    expect(notify).toHaveBeenCalledWith(CONTRACT, "browser");
    expect(deliverable).not.toHaveBeenCalled();
  });

  it("refuses a contract the caller cannot see, and a bad sign-in with 401", async () => {
    const hidden = await route(false);
    expect((await hidden.POST(req({ event: "contract_accepted", contractId: CONTRACT }))).status).toBe(403);
    expect(hidden.notify).not.toHaveBeenCalled();
    vi.resetModules();
    const badToken = await route(false, false);
    expect((await badToken.POST(req({ event: "contract_accepted", contractId: CONTRACT }, "Bearer expired"))).status).toBe(401);
    expect(badToken.notify).not.toHaveBeenCalled();
  });

  it("rejects a contract event without a contract id", async () => {
    const { POST, notify } = await route(true);
    expect((await POST(req({ event: "contract_accepted", deliverableId: CONTRACT }))).status).toBe(400);
    expect((await POST(req({ event: "contract_accepted", contractId: "not-a-uuid" }))).status).toBe(400);
    expect(notify).not.toHaveBeenCalled();
  });
});

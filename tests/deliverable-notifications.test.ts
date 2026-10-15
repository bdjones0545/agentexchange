import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverableNotifier, notifierFromEnv, resendSender, type EmailMessage, type NotifierDeps } from "../server/notifications";
import { TOOLS, type ToolContext } from "../server/mcp/tools";
import { fakeDb } from "./fakeSupabase";

const OWNER = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const CONTRACT = "44444444-4444-4444-8444-444444444444";
const DELIVERABLE = "77777777-7777-4777-8777-777777777777";
const BODY = "CONFIDENTIAL-WORK-PRODUCT: the full memo the organization is paying for";

type Row = Record<string, unknown>;

function world(opts: { status?: string; decisions?: unknown[]; withLedger?: boolean } = {}) {
  const tables: Record<string, Row[]> = {
    profiles: [{ id: OWNER, email: "owner@acme.test", user_id: "u-1" }],
    organizations: [{ id: ORG, owner_id: OWNER, name: "Acme" }],
    contracts: [{ id: CONTRACT, organization_id: ORG, title: "Competitor pricing scan", agent_name: "Hermes Analyst", status: "In Review" }],
    contract_deliverables: [
      { id: DELIVERABLE, contract_id: CONTRACT, title: "Pricing memo", notes: BODY, status: opts.status ?? "submitted", decisions: opts.decisions ?? [] },
    ],
  };
  if (opts.withLedger !== false) tables.email_notifications = [];
  const db = fakeDb({
    tables,
    refuseInsert: (table, row) => {
      if (table !== "email_notifications") return null;
      if (opts.withLedger === false) return { message: 'relation "email_notifications" does not exist', code: "42P01" };
      return tables.email_notifications.some((r) => r.key === row.key) ? { message: "duplicate key value", code: "23505" } : null;
    },
  });
  return { db, tables };
}

/** A fake fetch standing in for api.resend.com; records every request it receives. */
function fakeResend(status = 200, body: Row = { id: "re_123" }) {
  const requests: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    requests.push({ url, headers: init.headers as Record<string, string>, body: String(init.body) });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetchImpl, requests };
}

function notifier(db: ReturnType<typeof fakeDb>, extra: Partial<NotifierDeps> = {}) {
  const log = vi.fn();
  const resend = fakeResend();
  const notify = deliverableNotifier({
    apiKey: "re_test_key",
    appUrl: "https://www.agentsexchange.ai",
    db: () => db,
    send: resendSender("re_test_key", "AgentExchange <notifications@agentsexchange.ai>", resend.fetchImpl),
    log,
    ...extra,
  });
  return { notify, log, requests: resend.requests };
}

describe("deliverable submitted email", () => {
  it("emails the organization owner once, however many times it is triggered", async () => {
    const { db, tables } = world();
    const { notify, requests } = notifier(db);

    expect(await notify(DELIVERABLE, "mcp")).toEqual({ status: "sent", key: `deliverable-submitted/${DELIVERABLE}/0` });
    expect(await notify(DELIVERABLE, "browser")).toEqual({ status: "skipped", reason: "already_sent" });
    expect(await notify(DELIVERABLE, "browser")).toEqual({ status: "skipped", reason: "already_sent" });

    expect(requests).toHaveLength(1);
    expect(tables.email_notifications).toHaveLength(1);
    expect(tables.email_notifications[0]).toMatchObject({ kind: "deliverable_submitted", deliverable_id: DELIVERABLE, provider_id: "re_123" });
    expect(tables.email_notifications[0].sent_at).toEqual(expect.any(String));
  });

  it("sends the contract, the deliverable title and the link — never the deliverable body", async () => {
    const { db } = world();
    const { notify, requests } = notifier(db);
    await notify(DELIVERABLE, "mcp");

    const [req] = requests;
    expect(req.url).toBe("https://api.resend.com/emails");
    expect(req.headers.authorization).toBe("Bearer re_test_key");
    expect(req.headers["idempotency-key"]).toBe(`deliverable-submitted/${DELIVERABLE}/0`);
    const payload = JSON.parse(req.body) as { to: string[]; from: string; subject: string; text: string; html: string };
    expect(payload.to).toEqual(["owner@acme.test"]);
    expect(payload.subject).toContain("Pricing memo");
    expect(payload.subject).toContain("Competitor pricing scan");
    expect(payload.text).toContain(`https://www.agentsexchange.ai/contracts/${CONTRACT}`);
    expect(payload.html).toContain(`https://www.agentsexchange.ai/contracts/${CONTRACT}`);
    // The whole request, headers included, carries nothing of the work product.
    expect(JSON.stringify(req)).not.toContain("CONFIDENTIAL-WORK-PRODUCT");
    expect(JSON.stringify(req)).not.toContain(BODY);
  });

  it("is a no-op without RESEND_API_KEY and says so once, not on every submit", async () => {
    const { db, tables } = world();
    const send = vi.fn<(m: EmailMessage) => Promise<{ id: string | null }>>();
    const log = vi.fn();
    const deps = { ...notifierFromEnv({ APP_URL: "https://www.agentsexchange.ai" }), db: () => db, log };
    expect(deps.apiKey).toBeUndefined();
    const notify = deliverableNotifier(deps);

    expect(await notify(DELIVERABLE, "mcp")).toEqual({ status: "skipped", reason: "no_api_key" });
    expect(await notify(DELIVERABLE, "browser")).toEqual({ status: "skipped", reason: "no_api_key" });
    expect(send).not.toHaveBeenCalled();
    expect(tables.email_notifications).toHaveLength(0);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/RESEND_API_KEY is not set/);
  });

  it("does not email about drafts or unknown deliverables", async () => {
    const { db } = world({ status: "draft" });
    const { notify, requests } = notifier(db);
    expect(await notify(DELIVERABLE, "browser")).toEqual({ status: "skipped", reason: "not_submitted" });
    expect(await notify("99999999-9999-4999-8999-999999999999", "browser")).toEqual({ status: "skipped", reason: "not_found" });
    expect(requests).toHaveLength(0);
  });

  it("a revision resubmitted after a rejection is a new email; a retry of it is not", async () => {
    const { db, tables } = world();
    const { notify, requests } = notifier(db);
    await notify(DELIVERABLE, "mcp");
    // The organization rejects (a decision is recorded) and the agent resubmits.
    tables.contract_deliverables[0].decisions = [{ id: "d1", status: "rejected", note: "Add sources", decidedAt: "2026-10-14T00:00:00Z" }];
    expect(await notify(DELIVERABLE, "mcp")).toEqual({ status: "sent", key: `deliverable-submitted/${DELIVERABLE}/1` });
    expect(await notify(DELIVERABLE, "browser")).toEqual({ status: "skipped", reason: "already_sent" });
    expect(requests.map((r) => r.headers["idempotency-key"])).toEqual([
      `deliverable-submitted/${DELIVERABLE}/0`,
      `deliverable-submitted/${DELIVERABLE}/1`,
    ]);
  });

  it("retries a claim whose send failed, under the same provider key", async () => {
    const { db, tables } = world();
    let attempt = 0;
    const keys: string[] = [];
    const notify = deliverableNotifier({
      apiKey: "re_test_key",
      appUrl: "https://www.agentsexchange.ai",
      db: () => db,
      log: () => {},
      send: async (m) => {
        keys.push(m.idempotencyKey);
        if (attempt++ === 0) throw new Error("socket hang up");
        return { id: "re_456" };
      },
    });
    expect(await notify(DELIVERABLE, "mcp")).toEqual({ status: "failed", reason: "unreachable" });
    expect(tables.email_notifications[0].sent_at).toBeUndefined();
    expect((await notify(DELIVERABLE, "mcp")).status).toBe("sent");
    expect(keys).toEqual([keys[0], keys[0]]);
    expect(tables.email_notifications[0].sent_at).toEqual(expect.any(String));
  });

  it("before the migration is applied it still sends, relying on Resend's idempotency key, and logs that once", async () => {
    const { db } = world({ withLedger: false });
    const { notify, requests, log } = notifier(db);
    expect((await notify(DELIVERABLE, "mcp")).status).toBe("sent");
    expect((await notify(DELIVERABLE, "browser")).status).toBe("sent");
    // Both requests carry the same key, so Resend delivers one email.
    expect(new Set(requests.map((r) => r.headers["idempotency-key"])).size).toBe(1);
    expect(log.mock.calls.filter(([line]) => /email_notifications is missing/.test(String(line)))).toHaveLength(1);
  });

  it("logs outcomes without ids, titles or addresses", async () => {
    const { db } = world();
    const { notify, log } = notifier(db);
    await notify(DELIVERABLE, "mcp");
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain("deliverable_email");
    for (const secret of [DELIVERABLE, CONTRACT, "owner@acme.test", "Pricing memo", "Competitor pricing scan"]) expect(logged).not.toContain(secret);
  });

  it("escapes titles in the HTML body", async () => {
    const { db, tables } = world();
    tables.contract_deliverables[0].title = `<img src=x onerror="alert(1)">`;
    const { notify, requests } = notifier(db);
    await notify(DELIVERABLE, "mcp");
    const payload = JSON.parse(requests[0].body) as { html: string };
    expect(payload.html).not.toContain("<img");
    expect(payload.html).toContain("&lt;img");
  });
});

describe("submit_deliverable triggers the owner email", () => {
  const PROFILE = "11111111-1111-4111-8111-111111111111";
  type SubmitInput = { contractId: string; title: string; notes: string };
  const submitTool = TOOLS.find((t) => t.name === "submit_deliverable")!;
  const submit = { run: submitTool.run as unknown as (input: SubmitInput, ctx: ToolContext) => Promise<unknown> };

  function ctxWith(db: ReturnType<typeof fakeDb>, deliverableSubmitted: ToolContext["deliverableSubmitted"]): ToolContext {
    return { open: async () => ({ db, profileId: PROFILE }), worker: "agentexchange", now: () => "2026-10-14T00:00:00.000Z", paymentsEnabled: false, gate: null, deliverableSubmitted };
  }
  const seeded = () =>
    fakeDb({
      tables: {
        contracts: [{ id: CONTRACT, organization_name: "Acme", agent_name: "Hermes Analyst", title: "Competitor pricing scan", status: "Active" }],
        contract_deliverables: [],
        deliverable_gate_events: [],
      },
    });

  it("passes the new deliverable's id once it is stored", async () => {
    const hook = vi.fn(async () => ({ status: "sent" }));
    const out = (await submit.run({ contractId: CONTRACT, title: "Pricing memo", notes: BODY }, ctxWith(seeded(), hook))) as { ok: boolean; deliverable: { id: string } };
    expect(out.ok).toBe(true);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith(out.deliverable.id);
  });

  it("a failing notifier never fails the submission", async () => {
    const out = (await submit.run({ contractId: CONTRACT, title: "Pricing memo", notes: BODY }, ctxWith(seeded(), async () => { throw new Error("resend down"); }))) as { ok: boolean };
    expect(out.ok).toBe(true);
  });

  it("a deliverable the quality gate returns sends nothing", async () => {
    const hook = vi.fn(async () => ({}));
    const ctx = { ...ctxWith(seeded(), hook), gate: async () => ({ satisfiesBrief: 0.1, complete: 0.1, unsupportedClaims: 0.1, quality: 0.5 }) };
    const out = (await submit.run({ contractId: CONTRACT, title: "Pricing memo", notes: "thin" }, ctx)) as { ok: boolean };
    expect(out.ok).toBe(false);
    expect(hook).not.toHaveBeenCalled();
  });
});

describe("POST /api/notifications", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../server/config.js");
    vi.doUnmock("../server/notifications.js");
  });

  async function route(canSee: boolean) {
    const notify = vi.fn(async () => ({ status: "sent", key: "k" }));
    vi.doMock("../server/config.js", () => ({ readServerEnv: () => ({ supabaseUrl: "https://db.test", supabaseAnonKey: "anon", workers: [], paymentsEnabled: false, appUrl: "https://example.test" }) }));
    vi.doMock("../server/notifications.js", () => ({ callerCanSeeDeliverable: async () => canSee, notifyDeliverableSubmitted: notify }));
    const { POST } = await import("../api/notifications");
    return { POST, notify };
  }
  const req = (body: unknown, auth = "Bearer user-token") =>
    new Request("https://example.test/api/notifications", { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(body) });

  it("needs a signed-in caller", async () => {
    const { POST, notify } = await route(true);
    expect((await POST(req({ event: "deliverable_submitted", deliverableId: DELIVERABLE }, ""))).status).toBe(401);
    expect(notify).not.toHaveBeenCalled();
  });

  it("rejects anything but a deliverable id", async () => {
    const { POST, notify } = await route(true);
    expect((await POST(req({ event: "deliverable_submitted", deliverableId: "not-a-uuid" }))).status).toBe(400);
    expect((await POST(req({ event: "something_else", deliverableId: DELIVERABLE }))).status).toBe(400);
    expect(notify).not.toHaveBeenCalled();
  });

  it("refuses a deliverable the caller cannot see", async () => {
    const { POST, notify } = await route(false);
    expect((await POST(req({ event: "deliverable_submitted", deliverableId: DELIVERABLE }))).status).toBe(403);
    expect(notify).not.toHaveBeenCalled();
  });

  it("hands a visible deliverable to the notifier", async () => {
    const { POST, notify } = await route(true);
    const res = await POST(req({ event: "deliverable_submitted", deliverableId: DELIVERABLE }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "sent" });
    expect(notify).toHaveBeenCalledWith(DELIVERABLE, "browser");
  });
});

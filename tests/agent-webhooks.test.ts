import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertDeliverableUrl, deliverDue, generateWebhookSecret, httpTransport, isPrivateAddress, parseEventFilter, RETRY_MINUTES, signWebhook,
  WebhookUrlError, type DeliveryStore, type DueDelivery,
} from "../server/agentWebhooks";
import { handleBody } from "../server/mcp/rpc";
import type { ToolContext } from "../server/mcp/tools";

const publicDns = async () => ["93.184.216.34"];

describe("signing", () => {
  it("matches the Standard Webhooks reference signature", () => {
    expect(signWebhook("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw", "msg_p5jXN8AQM9LWM0D4loKWxJek", 1614265330, '{"test": 2432232314}'))
      .toBe("v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=");
  });
  it("generates a 32-byte whsec_ secret, different every time", () => {
    const a = generateWebhookSecret();
    expect(a).toMatch(/^whsec_[A-Za-z0-9+/]+=*$/);
    expect(Buffer.from(a.slice(6), "base64")).toHaveLength(32);
    expect(generateWebhookSecret()).not.toBe(a);
  });
});

describe("only public HTTPS endpoints", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])(
    "treats %s as private", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])("treats %s as public", (ip) => expect(isPrivateAddress(ip)).toBe(false));

  it.each([
    ["http://agent.example.com/hook", "https"],
    ["https://user:pw@agent.example.com/hook", "credentials"],
    ["https://localhost/hook", "public"],
    ["https://metadata.google.internal/hook", "public"],
    ["https://10.0.0.5/hook", "public"],
    ["https://[::1]/hook", "public"],
    ["not a url", "valid URL"],
  ])("refuses %s", async (url, message) => {
    await expect(assertDeliverableUrl(url, publicDns)).rejects.toThrow(message);
  });
  it("refuses a public-looking name that resolves to a private address", async () => {
    await expect(assertDeliverableUrl("https://sneaky.example.com/hook", async () => ["93.184.216.34", "10.0.0.7"])).rejects.toBeInstanceOf(WebhookUrlError);
  });
  it("accepts a public HTTPS endpoint", async () => {
    expect((await assertDeliverableUrl("https://agent.example.com/hook", publicDns)).hostname).toBe("agent.example.com");
  });
  it("accepts only known event types in a filter", () => {
    expect(parseEventFilter(undefined)).toEqual([]);
    expect(parseEventFilter(["message.created", "message.created"])).toEqual(["message.created"]);
    expect(() => parseEventFilter(["everything"])).toThrow(WebhookUrlError);
  });
});

describe("delivery with retries", () => {
  const due = (attempts = 0, webhook: DueDelivery["webhook"] = { url: "https://agent.example.com/hook", secret: "whsec_c2VjcmV0" }): DueDelivery => ({
    eventId: `e${attempts}`, keyId: "k1", attempts, webhook,
    event: { type: "negotiation.countered", data: { negotiationId: "n1", status: "countered" }, createdAt: "2026-11-19T00:00:00.000Z" },
  });
  const store = (batches: DueDelivery[][]) => {
    const s = {
      claimDue: vi.fn(async () => batches.shift() ?? []),
      delivered: vi.fn(async () => {}), retry: vi.fn(async () => {}), giveUp: vi.fn(async () => {}),
    } satisfies DeliveryStore;
    return s;
  };
  const NOW = Date.parse("2026-11-19T12:00:00Z");

  it("marks a 2xx delivered and sends the Standard Webhooks envelope", async () => {
    const s = store([[due()]]);
    const transport = vi.fn(async () => ({ ok: true, status: 204 }));
    expect(await deliverDue(s, transport, () => NOW, NOW + 10_000)).toEqual({ delivered: 1, retried: 0, gaveUp: 0 });
    expect(transport).toHaveBeenCalledWith("https://agent.example.com/hook", "whsec_c2VjcmV0",
      { id: "e0", type: "negotiation.countered", createdAt: "2026-11-19T00:00:00.000Z", data: { negotiationId: "n1", status: "countered" } }, Math.floor(NOW / 1000));
    expect(s.delivered).toHaveBeenCalledWith(expect.objectContaining({ eventId: "e0" }), 204, NOW);
  });

  it("retries on the backoff schedule and gives up after the last attempt", async () => {
    const s = store([[due(0), due(3), due(RETRY_MINUTES.length)]]);
    const transport = vi.fn(async () => ({ ok: false, status: 500 }));
    expect(await deliverDue(s, transport, () => NOW, NOW + 10_000)).toEqual({ delivered: 0, retried: 2, gaveUp: 1 });
    expect(s.retry).toHaveBeenNthCalledWith(1, expect.objectContaining({ eventId: "e0" }), 500, NOW + RETRY_MINUTES[0] * 60_000, NOW);
    expect(s.retry).toHaveBeenNthCalledWith(2, expect.objectContaining({ eventId: "e3" }), 500, NOW + RETRY_MINUTES[3] * 60_000, NOW);
    expect(s.giveUp).toHaveBeenCalledWith(expect.objectContaining({ eventId: `e${RETRY_MINUTES.length}` }), 500, NOW);
    expect(RETRY_MINUTES.reduce((a, b) => a + b, 0) / 60).toBeGreaterThan(20);
  });

  it("gives up a delivery whose webhook was removed or switched off, without sending", async () => {
    const s = store([[due(0, null)]]);
    const transport = vi.fn();
    expect(await deliverDue(s, transport, () => NOW, NOW + 10_000)).toMatchObject({ gaveUp: 1 });
    expect(transport).not.toHaveBeenCalled();
  });

  it("keeps claiming full batches until the queue is empty, within the deadline", async () => {
    const s = store([[due(0), due(0)], [due(0)]]);
    const transport = vi.fn(async () => ({ ok: true, status: 200 }));
    expect(await deliverDue(s, transport, () => NOW, NOW + 10_000, 2)).toMatchObject({ delivered: 3 });
    let t = NOW;
    const late = store([[due(0), due(0)]]);
    expect(await deliverDue(late, async () => { t += 6_000; return { ok: true, status: 200 }; }, () => t, NOW + 5_000)).toMatchObject({ delivered: 1 });
  });
});

describe("HTTP sender", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it("posts a verifiable signature, refuses redirects and reports non-2xx", async () => {
    const send = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", send);
    const secret = generateWebhookSecret();
    const envelope = { id: "evt_1", type: "message.created", createdAt: "2026-11-19T00:00:00.000Z", data: { contractId: "c1" } };
    expect(await httpTransport(publicDns)("https://agent.example.com/hook", secret, envelope, 1795000000)).toEqual({ ok: true, status: 200 });
    const [, init] = send.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.redirect).toBe("manual");
    expect(init.headers["webhook-id"]).toBe("evt_1");
    expect(init.headers["webhook-timestamp"]).toBe("1795000000");
    expect(init.headers["webhook-signature"]).toBe(signWebhook(secret, "evt_1", 1795000000, String(init.body)));
    expect(JSON.parse(String(init.body))).toEqual(envelope);
    send.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://10.0.0.1/" } }));
    expect(await httpTransport(publicDns)("https://agent.example.com/hook", secret, envelope, 1)).toEqual({ ok: false, status: 302 });
  });
  it("never connects to a private address", async () => {
    const send = vi.fn();
    vi.stubGlobal("fetch", send);
    expect(await httpTransport(async () => ["127.0.0.1"])("https://agent.example.com/hook", "whsec_eA==", { id: "e", type: "t", createdAt: "", data: {} }, 1))
      .toEqual({ ok: false, status: null });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("agent tools", () => {
  const ctx = (patch: Partial<ToolContext> = {}): ToolContext => ({
    open: async () => { throw new Error("no session in this test"); },
    worker: "test", now: () => new Date().toISOString(), paymentsEnabled: false, afterWrite: vi.fn(async () => {}), ...patch,
  });
  const call = (name: string, c: ToolContext) => handleBody({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: {} } }, c) as Promise<{ result: { structuredContent: Record<string, unknown> } }>;

  it("lists the webhook tools", async () => {
    const r = (await handleBody({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx())) as { result: { tools: Array<{ name: string }> } };
    expect(r.result.tools.map((t) => t.name)).toEqual(expect.arrayContaining(["set_webhook", "get_webhook", "remove_webhook", "test_webhook"]));
  });
  it("ties webhooks to an agent key", async () => {
    const r = await call("get_webhook", ctx());
    expect(r.result.structuredContent).toEqual({ ok: false, error: "Webhooks belong to an agent API key; connect with one" });
  });
  it("pushes a write's events right after write tools only", async () => {
    const c = ctx();
    await call("get_webhook", c);
    expect(c.afterWrite).not.toHaveBeenCalled();
    await call("remove_webhook", c);
    expect(c.afterWrite).toHaveBeenCalledOnce();
  });
  it("never lets a failed push fail the tool result", async () => {
    const c = ctx({ afterWrite: vi.fn(async () => { throw new Error("queue down"); }) });
    const r = await call("remove_webhook", c);
    expect(r.result.structuredContent.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("queue down");
  });
});

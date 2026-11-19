import { beforeEach, describe, expect, it, vi } from "vitest";

const { caller, upserts } = vi.hoisted(() => ({ caller: vi.fn(), upserts: [] as Record<string, unknown>[] }));
vi.mock("../server/config.js", () => ({ readServerEnv: () => ({ supabaseUrl: "https://db.test", supabaseAnonKey: "anon" }) }));
vi.mock("../server/caller.js", () => ({
  bearerToken: (r: Request) => (r.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || null,
  callerProfile: caller,
}));
// Keys: k-mine belongs to profile p-me, k-theirs to someone else, k-revoked is revoked.
const keys: Record<string, { id: string; profile_id: string; revoked_at: string | null }> = {
  "k-mine": { id: "k-mine", profile_id: "p-me", revoked_at: null },
  "k-theirs": { id: "k-theirs", profile_id: "p-other", revoked_at: null },
  "k-revoked": { id: "k-revoked", profile_id: "p-me", revoked_at: "2026-11-01T00:00:00Z" },
};
vi.mock("../server/service.js", () => ({
  serviceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_c: string, v: string) => ({
          maybeSingle: async () => ({ data: table === "agent_api_keys" ? keys[v] ?? null : null, error: null }),
          then: (resolve: (r: unknown) => void) => resolve({ data: [], error: null }),
        }),
      }),
      upsert: (row: Record<string, unknown>) => {
        upserts.push(row);
        return { select: () => ({ single: async () => ({ data: { ...row, created_at: "2026-11-19T00:00:00Z" }, error: null }) }) };
      },
    }),
  }),
}));
vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34", family: 4 }] }));
import { GET, PUT } from "../api/agent-webhooks";

const put = (body: unknown, auth = "Bearer token") =>
  PUT(new Request("https://example.test/api/agent-webhooks", { method: "PUT", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(body) }));

describe("owner webhook API", () => {
  beforeEach(() => { caller.mockReset().mockResolvedValue({ profileId: "p-me" }); upserts.length = 0; });

  it("requires a signed-in owner", async () => {
    caller.mockResolvedValue(null);
    expect((await GET(new Request("https://example.test/api/agent-webhooks", { headers: { authorization: "Bearer bad" } }))).status).toBe(401);
    expect((await put({ keyId: "k-mine", url: "https://agent.example.com/hook" }, "")).status).toBe(401);
  });

  it("sets a webhook on the owner's own key and returns the secret once", async () => {
    const r = await put({ keyId: "k-mine", url: "https://agent.example.com/hook" });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { secret: string; webhook: { url: string; keyId: string } };
    expect(body.secret).toMatch(/^whsec_/);
    expect(body.webhook).toMatchObject({ keyId: "k-mine", url: "https://agent.example.com/hook" });
    expect(upserts[0]).toMatchObject({ key_id: "k-mine", profile_id: "p-me", disabled_at: null });
  });

  it.each([["someone else's key", "k-theirs"], ["a revoked key", "k-revoked"], ["an unknown key", "k-none"]])("refuses %s", async (_label, keyId) => {
    const r = await put({ keyId, url: "https://agent.example.com/hook" });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: "Agent key not found" });
    expect(upserts).toHaveLength(0);
  });

  it("refuses a private or plain-HTTP endpoint before touching the database", async () => {
    expect((await put({ keyId: "k-mine", url: "http://agent.example.com/hook" })).status).toBe(400);
    expect((await put({ keyId: "k-mine", url: "https://169.254.169.254/latest" })).status).toBe(400);
    expect(upserts).toHaveLength(0);
  });
});

describe("key webhook panel", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { KeyWebhookPanel } = await import("../src/components/KeyWebhookPanel");
  const render = (webhook: Parameters<typeof KeyWebhookPanel>[0]["webhook"]) =>
    renderToStaticMarkup(createElement(KeyWebhookPanel, { keyId: "k1", webhook, onChanged: () => {} }));
  it("offers to add a webhook when the key has none", () => {
    expect(render(null)).toContain("Add webhook");
  });
  it("shows the endpoint, its health and a way back on after it was switched off", () => {
    const html = render({ keyId: "k1", url: "https://agent.example.com/hook", events: [], createdAt: "2026-11-19T00:00:00Z",
      disabledAt: "2026-11-19T01:00:00Z", disabledReason: "Deliveries failed for about a day", lastSuccessAt: null, lastFailureAt: "2026-11-19T01:00:00Z", lastStatus: 500 });
    expect(html).toContain("https://agent.example.com/hook");
    expect(html).toContain("Switched off");
    expect(html).toContain("Turn back on");
    expect(html).not.toContain("whsec_");
  });
});

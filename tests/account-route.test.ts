import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./fakeSupabase";

const h = vi.hoisted(() => ({
  caller: vi.fn(),
  serviceReady: true,
  ready: true,
  deleted: [] as string[],
  requests: [] as Record<string, unknown>[],
}));
vi.mock("../server/config.js", () => ({ readServerEnv: () => ({ supabaseUrl: "https://db.test", supabaseAnonKey: "anon" }) }));
vi.mock("../server/caller.js", () => ({
  bearerToken: (r: Request) => (r.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || null,
  callerProfile: h.caller,
}));
vi.mock("../server/service.js", async () => {
  const { fakeDb: db } = await import("./fakeSupabase");
  return {
    serviceRoleConfigured: () => h.serviceReady,
    serviceClient: () =>
      Object.assign(
        db({
          projectColumns: true,
          tables: { agent_webhooks: [], account_deletion_requests: h.requests },
          rpc: (name) => (name === "account_deletion_ready" ? { data: h.ready, error: null } : { data: null, error: { message: "no rpc" } }),
        }),
        {
          auth: {
            admin: {
              deleteUser: async (id: string) => { h.deleted.push(id); return { data: {}, error: null }; },
              getUserById: async () => ({ data: { user: null }, error: { status: 404, message: "User not found" } }),
            },
          },
        },
      ),
  };
});
import { DELETE, GET } from "../api/account";

const me = (tables: Record<string, Record<string, unknown>[]> = {}) => ({
  profileId: "p-me",
  userId: "u-me",
  email: "me@example.com",
  user: { id: "u-me", email: "me@example.com", identities: [{ provider: "email" }], app_metadata: {}, user_metadata: {} },
  client: fakeDb({ tables: { profiles: [{ id: "p-me", user_id: "u-me", email: "me@example.com" }], ...tables } }) as SupabaseClient,
});

const get = (auth = "Bearer token") => GET(new Request("https://example.test/api/account", { headers: { authorization: auth } }));
const del = (body: unknown, auth = "Bearer token") =>
  DELETE(new Request("https://example.test/api/account", { method: "DELETE", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(body) }));

describe("/api/account", () => {
  beforeEach(() => {
    h.caller.mockReset().mockResolvedValue(me());
    h.serviceReady = true;
    h.ready = true;
    h.deleted.length = 0;
    h.requests.length = 0;
  });

  it("requires a signed-in account", async () => {
    h.caller.mockResolvedValue(null);
    expect((await get("Bearer bad")).status).toBe(401);
    expect((await get("")).status).toBe(401);
    expect((await del({ confirm: "me@example.com" }, "")).status).toBe(401);
    expect(h.deleted).toEqual([]);
  });

  it("downloads the export as an uncached JSON attachment", async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-type")).toContain("application/json");
    expect(r.headers.get("content-disposition")).toMatch(/^attachment; filename="agentexchange-data-\d{4}-\d{2}-\d{2}\.json"$/);
    const body = (await r.json()) as { format: string; account: { email: string }; profile: { id: string } };
    expect(body).toMatchObject({ format: "agentexchange-account-export", account: { email: "me@example.com" }, profile: { id: "p-me" } });
  });

  it("refuses an export too large for a function response instead of truncating it silently", async () => {
    const big = "x".repeat(1_100_000);
    h.caller.mockResolvedValue(me({ activity_events: [1, 2, 3, 4].map((i) => ({ id: `e${i}`, owner_id: "p-me", message: big, created_at: String(i) })) }));
    const r = await get();
    expect(r.status).toBe(413);
    expect(((await r.json()) as { error: string }).error).toContain("support@agentsexchange.ai");
  });

  it("deletes nothing without the typed email", async () => {
    for (const body of [{}, { confirm: "someone@example.com" }, { confirm: "DELETE" }, "not json"]) {
      const r = await del(body);
      expect(r.status).toBe(400);
    }
    expect(h.deleted).toEqual([]);
    expect(h.requests).toEqual([]);
  });

  it("deletes an account with nothing to keep", async () => {
    const r = await del({ confirm: " Me@Example.com " });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, status: "deleted" });
    expect(h.deleted).toEqual(["u-me"]);
  });

  it("queues an account with marketplace or billing records for review", async () => {
    h.ready = false;
    const r = await del({ confirm: "me@example.com" });
    expect(r.status).toBe(202);
    expect(await r.json()).toMatchObject({ ok: true, status: "requested", request: expect.any(Object) });
    expect(h.deleted).toEqual([]);
    expect(h.requests).toEqual([expect.objectContaining({ user_id: "u-me" })]);
  });

  it("fails closed when the service role is not configured", async () => {
    h.serviceReady = false;
    const r = await del({ confirm: "me@example.com" });
    expect(r.status).toBe(503);
    expect(h.deleted).toEqual([]);
  });
});

// A missing, expired or forged sign-in token must be a 401, which tells the
// caller to sign in again. /api/agent-keys used to hand a bad token straight
// to the database and answer 400 "JWT cryptographic operation failed";
// /api/dispatch answered 403 "not visible to caller".
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./fakeSupabase";

const { caller, canSee } = vi.hoisted(() => ({ caller: vi.fn(), canSee: vi.fn() }));
vi.mock("../server/config.js", () => ({
  readServerEnv: () => ({ supabaseUrl: "https://db.test", supabaseAnonKey: "anon", workers: [{ name: "agentexchange", token: "t", url: "https://worker.test" }] }),
}));
vi.mock("../server/caller.js", () => ({
  bearerToken: (r: Request) => /^Bearer\s+(.+)$/i.exec(r.headers.get("authorization") ?? "")?.[1].trim() ?? null,
  callerProfile: caller,
}));
vi.mock("../server/dispatch.js", async (importActual) => ({
  ...(await importActual<typeof import("../server/dispatch.js")>()),
  callerCanSee: canSee,
  loggedDispatch: () => async () => [],
}));
vi.mock("../server/agentWebhooks.js", () => ({ deliverSoon: async () => undefined }));
vi.mock("../server/service.js", () => ({ serviceClient: () => ({}) }));
import { DELETE, GET, POST } from "../api/agent-keys";
import { POST as dispatch } from "../api/dispatch";

const PROFILE = "11111111-1111-4111-8111-111111111111";
const CONTRACT = "22222222-2222-4222-8222-222222222222";
const req = (method: string, auth: string | null, body?: unknown) =>
  new Request("https://example.test/api/agent-keys", {
    method,
    headers: { ...(auth ? { authorization: auth } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("/api/agent-keys with a bad sign-in token", () => {
  beforeEach(() => { caller.mockReset().mockResolvedValue(null); });

  it("answers 401 on GET, POST and DELETE, after checking the token with Supabase Auth", async () => {
    for (const r of [req("GET", "Bearer expired.or.forged"), req("POST", "Bearer expired.or.forged", { name: "probe" }), req("DELETE", "Bearer expired.or.forged", { id: "k" })]) {
      const res = await (r.method === "GET" ? GET : r.method === "POST" ? POST : DELETE)(r);
      expect(res.status, r.method).toBe(401);
      expect(res.headers.get("www-authenticate")).toBe("Bearer");
      expect(await res.json()).toEqual({ ok: false, error: "Unauthorized" });
    }
    expect(caller).toHaveBeenCalledTimes(3);
    expect(caller.mock.calls.every(([, token]) => token === "expired.or.forged")).toBe(true);
  });

  it("answers 401 with no token at all, without calling Supabase", async () => {
    expect((await POST(req("POST", null, { name: "probe" }))).status).toBe(401);
    expect(caller).not.toHaveBeenCalled();
  });
});

describe("/api/agent-keys for a signed-in operator", () => {
  it("mints, lists and revokes a key on the caller's own session", async () => {
    const client = fakeDb({ tables: { agent_api_keys: [] } });
    caller.mockReset().mockResolvedValue({ profileId: PROFILE, client });
    const minted = await POST(req("POST", "Bearer good", { name: "Strategy Crate" }));
    expect(minted.status).toBe(200);
    const body = await minted.json();
    expect(body.key).toMatch(/^axk_/);
    expect(body.record).toMatchObject({ name: "Strategy Crate", can_spend: false });

    const list = await (await GET(req("GET", "Bearer good"))).json();
    expect(list.keys).toHaveLength(1);
    expect((await DELETE(req("DELETE", "Bearer good", { id: body.record.id }))).status).toBe(200);
  });

  it("still reports a database refusal as 400, not 401", async () => {
    const client = fakeDb({ tables: { agent_api_keys: [] }, refuseInsert: () => "Key limit reached" });
    caller.mockReset().mockResolvedValue({ profileId: PROFILE, client });
    const res = await POST(req("POST", "Bearer good", { name: "eleventh" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Key limit/);
  });
});

describe("/api/dispatch", () => {
  const send = (auth: string) => dispatch(new Request("https://example.test/api/dispatch", {
    method: "POST", headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({ event: "contract_funded", contractId: CONTRACT }),
  }));
  beforeEach(() => { caller.mockReset(); canSee.mockReset(); });

  it("answers 401 to a bad token instead of 403 'not visible'", async () => {
    canSee.mockResolvedValue(false);
    caller.mockResolvedValue(null);
    const res = await send("Bearer expired.or.forged");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe("Bearer");
  });

  it("keeps 403 for a signed-in caller who can't see the contract", async () => {
    canSee.mockResolvedValue(false);
    caller.mockResolvedValue({ profileId: PROFILE });
    expect((await send("Bearer good")).status).toBe(403);
  });

  it("does not spend an Auth check when the caller can see the contract", async () => {
    canSee.mockResolvedValue(true);
    expect((await send("Bearer good")).status).toBe(200);
    expect(caller).not.toHaveBeenCalled();
  });
});

// Listing review: the owner sees and decides the queue, nobody else can, and an
// agent is told when its listing is not public yet.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decideListing, loadModerationQueue, parseDecision } from "../server/moderation";
import { TOOLS, type ToolContext } from "../server/mcp/tools";
import { fakeDb } from "./fakeSupabase";

const OWNER = "11111111-1111-4111-8111-111111111111";
const STRANGER = "22222222-2222-4222-8222-222222222222";
const A1 = "33333333-3333-4333-8333-333333333333";
const A2 = "44444444-4444-4444-8444-444444444444";
const A3 = "55555555-5555-4555-8555-555555555555";

function listings() {
  return fakeDb({
    tables: {
      agents: [
        { id: A2, name: "ThreadFox", specialty: "Research", description: "Memos", starting_rate: "$625", skills: ["research"], job_kinds: ["research_report"], moderation_status: "pending", created_at: "2026-11-18", updated_at: "2026-11-18", owner_id: "p-fox" },
        { id: A1, name: "VerKron", specialty: "Audits", description: null, starting_rate: null, skills: null, job_kinds: null, moderation_status: "pending", created_at: "2026-10-19", updated_at: null, owner_id: "p-ver" },
        { id: A3, name: "Old spam", specialty: "x", description: null, starting_rate: null, skills: [], job_kinds: [], moderation_status: "rejected", created_at: "2026-10-01", updated_at: null, owner_id: null },
        { id: "approved-1", name: "Stan · AI Transformation Lead", specialty: "Plans", moderation_status: "approved", created_at: "2026-11-19", owner_id: "p-bryan" },
      ],
      profiles: [{ id: "p-fox", display_name: "ThreadFox" }, { id: "p-ver", display_name: null }],
    },
  });
}

describe("moderation queue", () => {
  it("lists pending listings oldest first and rejected ones separately, never approved ones", async () => {
    const q = await loadModerationQueue(listings());
    expect(q.pending.map((i) => i.name)).toEqual(["VerKron", "ThreadFox"]);
    expect(q.rejected.map((i) => i.name)).toEqual(["Old spam"]);
    expect(q.pending[1]).toMatchObject({ owner: "ThreadFox", startingRate: "$625", jobKinds: ["research_report"], status: "pending" });
    expect(q.pending[0]).toMatchObject({ owner: "Unnamed seller", skills: [], jobKinds: [] });
  });

  it("approve publishes, reject keeps private, an unknown id is null", async () => {
    const db = listings();
    expect(await decideListing(db, A1, "approve")).toMatchObject({ id: A1, moderation_status: "approved" });
    expect(await decideListing(db, A2, "reject")).toMatchObject({ id: A2, moderation_status: "rejected" });
    expect(await decideListing(db, "66666666-6666-4666-8666-666666666666", "approve")).toBeNull();
    const q = await loadModerationQueue(db);
    expect(q.pending).toEqual([]);
    expect(q.rejected.map((i) => i.name).sort()).toEqual(["Old spam", "ThreadFox"]);
  });

  it("accepts only a listing id with approve or reject", () => {
    expect(parseDecision({ agentId: A1, decision: "approve" })).toEqual({ agentId: A1, decision: "approve" });
    expect(parseDecision({ agentId: A1, decision: "delete" })).toBeNull();
    expect(parseDecision({ agentId: "nope", decision: "approve" })).toBeNull();
    expect(parseDecision(null)).toBeNull();
  });
});

// ── The route ────────────────────────────────────────────────────────────────

const { callerProfile, state } = vi.hoisted(() => ({ callerProfile: vi.fn(), state: { db: null as unknown, serviceRole: true } }));
vi.mock("../server/config.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("../server/config")>()), readServerEnv: () => ({ supabaseUrl: "https://db.example.test", supabaseAnonKey: "anon", workers: [], paymentsEnabled: true, appUrl: "https://example.test" }) }));
vi.mock("../server/caller.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("../server/caller")>()), callerProfile }));
vi.mock("../server/service.js", () => ({ serviceClient: () => state.db, serviceRoleConfigured: () => state.serviceRole }));
import { GET, POST } from "../api/moderation";

describe("/api/moderation", () => {
  const get = (token?: string) => new Request("https://example.test/api/moderation", { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const post = (token: string, body: unknown) => new Request("https://example.test/api/moderation", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });

  beforeEach(() => {
    vi.stubEnv("PLATFORM_OWNER_USER_IDS", OWNER);
    vi.spyOn(console, "info").mockImplementation(() => {});
    callerProfile.mockReset();
    state.db = listings();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("asks for a session, then hides itself from everyone but the platform owner", async () => {
    expect((await GET(get())).status).toBe(401);
    callerProfile.mockResolvedValue({ profileId: "p", userId: STRANGER, email: null });
    expect((await GET(get("t"))).status).toBe(404);
    expect((await POST(post("t", { agentId: A1, decision: "approve" }))).status).toBe(404);
    expect((await loadModerationQueue(state.db as ReturnType<typeof fakeDb>)).pending).toHaveLength(2);
  });

  it("is closed to everyone while the owner list is unset", async () => {
    vi.stubEnv("PLATFORM_OWNER_USER_IDS", "");
    callerProfile.mockResolvedValue({ profileId: "p", userId: OWNER, email: null });
    expect((await GET(get("t"))).status).toBe(404);
  });

  it("gives the owner the queue and records a decision", async () => {
    callerProfile.mockResolvedValue({ profileId: "p", userId: OWNER, email: null });
    const queue = await (await GET(get("t"))).json();
    expect(queue.ok).toBe(true);
    expect(queue.pending.map((i: { name: string }) => i.name)).toEqual(["VerKron", "ThreadFox"]);
    const decided = await POST(post("t", { agentId: A2, decision: "approve" }));
    expect(decided.status).toBe(200);
    expect((await decided.json()).listing).toMatchObject({ name: "ThreadFox", moderation_status: "approved" });
    expect((await POST(post("t", { agentId: A2, decision: "maybe" }))).status).toBe(400);
  });
});

describe("agents are told whether their listing is public", () => {
  const PROFILE = "77777777-7777-4777-8777-777777777777";
  const ctx = (db: ReturnType<typeof fakeDb>): ToolContext => ({ open: async () => ({ db, profileId: PROFILE }), worker: "agent:test", now: () => "2026-11-19T00:00:00Z", paymentsEnabled: false });
  const tool = (name: string) => TOOLS.find((t) => t.name === name)!;

  it("publish_agent on a listing that is still in review says so", async () => {
    const db = fakeDb({ tables: { agents: [{ id: A1, owner_id: PROFILE, name: "Research desk", specialty: "Research", moderation_status: "pending", created_at: "2026-11-19" }] } });
    const r = (await tool("publish_agent").run({ name: "Research desk", specialty: "Research", skills: [], availability: "Available", toolAccess: [], jobKinds: [] }, ctx(db))) as { ok: boolean; created: boolean; review: { status: string; public: boolean; note: string } };
    expect(r).toMatchObject({ ok: true, created: false });
    expect(r.review).toMatchObject({ status: "pending", public: false });
    expect(r.review.note).toMatch(/waiting for review/);
  });

  it("whoami shows each listing's review status", async () => {
    const db = fakeDb({ tables: { agents: [{ id: A1, owner_id: PROFILE, name: "Research desk", specialty: "Research", moderation_status: "approved", created_at: "2026-11-19" }], profiles: [{ id: PROFILE, display_name: "Op" }] } });
    const r = (await tool("whoami").run({}, ctx(db))) as { agents: Array<{ moderation_status: string }> };
    expect(r.agents[0].moderation_status).toBe("approved");
  });
});

import { describe, expect, it } from "vitest";
import { hashKey, looksLikeAgentKey, mintKey } from "../server/agentKeys";
import { MARKETPLACE_GUIDE, TOOLS, type ToolContext } from "../server/mcp/tools";
import { fakeDb } from "./fakeSupabase";

const PROFILE = "11111111-1111-4111-8111-111111111111";
const AGENT = "33333333-3333-4333-8333-333333333333";
const OPP = "66666666-6666-4666-8666-666666666666";
const OPP2 = "77777777-7777-4777-8777-777777777777";

function ctx(db: ReturnType<typeof fakeDb>): ToolContext {
  return { open: async () => ({ db, profileId: PROFILE }), worker: "agent:axk_test", now: () => "2026-09-18T00:00:00.000Z" };
}
const tool = (name: string) => TOOLS.find((t) => t.name === name)!;

function seeded() {
  return fakeDb({
    tables: {
      agents: [{ id: AGENT, owner_id: PROFILE, name: "Scout", specialty: "Research", skills: [], availability: "Available", verification_status: "Unverified", trust_score: 0, created_at: "2026-09-01" }],
      opportunities: [
        { id: OPP, title: "Market memo", organization_name: "Acme", category: "Research", budget_range: "$400 - $800", required_skills: ["research"], description: "Three competitors", success_criteria: "table", status: "open", created_at: "2026-09-02" },
        { id: OPP2, title: "Landing page copy", organization_name: "Beta", category: "Copy", budget_range: "$200", required_skills: ["copywriting"], description: "Homepage", success_criteria: "", status: "open", created_at: "2026-09-03" },
        { id: "88888888-8888-4888-8888-888888888888", title: "Closed", organization_name: "Old", category: "Research", status: "closed", created_at: "2026-08-01" },
      ],
      applications: [],
      negotiations: [],
    },
  });
}

describe("agent API keys", () => {
  it("mints keys that hash deterministically and look like keys", () => {
    const k = mintKey();
    expect(k.raw.startsWith("axk_")).toBe(true);
    expect(k.prefix).toBe(k.raw.slice(0, 12));
    expect(hashKey(k.raw)).toBe(k.hash);
    expect(k.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(looksLikeAgentKey(k.raw)).toBe(true);
    expect(looksLikeAgentKey("ax_notakey")).toBe(false);
    expect(mintKey().raw).not.toBe(k.raw);
  });
});

describe("supply-side tools", () => {
  it("search_opportunities returns only open briefs, filtered by text and category", async () => {
    const all = (await tool("search_opportunities").run({ limit: 20 } as never, ctx(seeded()))) as { count: number; opportunities: Array<{ title: string }> };
    expect(all.opportunities.map((o) => o.title)).toEqual(["Landing page copy", "Market memo"]);
    const research = (await tool("search_opportunities").run({ query: "competitors", limit: 20 } as never, ctx(seeded()))) as { opportunities: Array<{ title: string }> };
    expect(research.opportunities.map((o) => o.title)).toEqual(["Market memo"]);
    const copy = (await tool("search_opportunities").run({ category: "copy", limit: 20 } as never, ctx(seeded()))) as { opportunities: Array<{ title: string }> };
    expect(copy.opportunities.map((o) => o.title)).toEqual(["Landing page copy"]);
  });

  it("apply_to_opportunity requires one of my agents and refuses a duplicate", async () => {
    const db = seeded();
    const notMine = (await tool("apply_to_opportunity").run({ opportunityId: OPP, agentId: "99999999-9999-4999-8999-999999999999", proposal: "I will do this well and quickly." }, ctx(db))) as { ok: boolean; error: string };
    expect(notMine.ok).toBe(false);
    expect(notMine.error).toMatch(/not one of your agents/);
    const first = (await tool("apply_to_opportunity").run({ opportunityId: OPP, agentId: AGENT, proposal: "Three competitors, one table, two days." }, ctx(db))) as { ok: boolean; application: { id: string } };
    expect(first.ok).toBe(true);
    const again = (await tool("apply_to_opportunity").run({ opportunityId: OPP, agentId: AGENT, proposal: "Trying again with the same agent." }, ctx(db))) as { ok: boolean; error: string };
    expect(again.ok).toBe(false);
    expect(again.error).toMatch(/already applied/);
    const mine = (await tool("get_opportunity").run({ opportunityId: OPP }, ctx(db))) as { myApplications: unknown[] };
    expect(mine.myApplications).toHaveLength(1);
  });

  it("negotiate_opportunity records rate and timeline under my agent", async () => {
    const db = seeded();
    const r = (await tool("negotiate_opportunity").run({ opportunityId: OPP2, agentId: AGENT, rate: "$180", timeline: "2 days" }, ctx(db))) as { ok: boolean };
    expect(r.ok).toBe(true);
    const list = (await tool("list_my_applications").run({ status: "all" }, ctx(db))) as { negotiations: Array<{ rate: string; agent_name: string }> };
    expect(list.negotiations[0]).toMatchObject({ rate: "$180", agent_name: "Scout" });
  });

  it("the guide tells an agent the lifecycle and the fee", async () => {
    const g = (await tool("get_marketplace_guide").run({}, ctx(seeded()))) as { guide: string };
    expect(g.guide).toBe(MARKETPLACE_GUIDE);
    expect(g.guide).toMatch(/15% platform fee/);
    expect(g.guide).toMatch(/submit_deliverable/);
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TOOLS, type ToolContext } from "../server/mcp/tools";
import { getAllOpportunities, getListedAgents } from "../src/data/localSelectors";
import { OwnerBriefPanel } from "../src/components/OwnerBriefPanel";
import { listingStatusText, OwnerListingPanel } from "../src/components/OwnerListingPanel";
import { payoutStateText } from "../src/lib/repositories/ownerManagement";
import type { CreatedAgent, CreatedOpportunity } from "../src/state/marketplaceTypes";
import { fakeDb } from "./fakeSupabase";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const AGENT = "22222222-2222-4222-8222-222222222222";
const BRIEF = "33333333-3333-4333-8333-333333333333";
const CONTRACT = "44444444-4444-4444-8444-444444444444";

function seeded() {
  return fakeDb({
    tables: {
      agents: [
        { id: AGENT, owner_id: ME, name: "Analyst", specialty: "Research", moderation_status: "approved", listed: true, created_at: "2026-11-01" },
        { id: "55555555-5555-4555-8555-555555555555", owner_id: OTHER, name: "Theirs", specialty: "Copy", moderation_status: "approved", listed: true, created_at: "2026-11-01" },
      ],
      opportunities: [{ id: BRIEF, owner_id: ME, title: "Market scan", status: "open", created_at: "2026-11-02" }],
      applications: [
        { id: "a1", opportunity_id: BRIEF, status: "pending" },
        { id: "a2", opportunity_id: BRIEF, status: "accepted" },
      ],
      negotiations: [
        { id: "n1", opportunity_id: BRIEF, status: "pending" },
        { id: "n2", opportunity_id: BRIEF, status: "countered" },
        { id: "n3", opportunity_id: BRIEF, status: "accepted" },
      ],
      contracts: [{ id: CONTRACT, title: "Market scan", organization_name: "Acme", payment_status: "unfunded", status: "Active" }],
      contract_milestones: [], contract_deliverables: [], contract_messages: [], payments: [],
      disputes: [{ id: "d0", contract_id: CONTRACT, reason: "Earlier issue", status: "Resolved", owner_id: OTHER, created_at: "2026-11-03" }],
      payouts: [
        { id: "p1", contract_id: CONTRACT, operator_profile_id: ME, gross_cents: 5000, fee_cents: 750, net_cents: 4250, reversed_cents: 0, currency: "USD", status: "transferred", transferred_at: "2026-11-10", created_at: "2026-11-09" },
        { id: "p2", contract_id: CONTRACT, operator_profile_id: ME, gross_cents: 10000, fee_cents: 1500, net_cents: 8500, reversed_cents: 0, currency: "USD", status: "pending", created_at: "2026-11-12" },
        { id: "p3", contract_id: CONTRACT, operator_profile_id: OTHER, gross_cents: 9900, fee_cents: 1485, net_cents: 8415, reversed_cents: 0, currency: "USD", status: "transferred", created_at: "2026-11-11" },
      ],
    },
  });
}
const ctx = (db: ReturnType<typeof fakeDb>): ToolContext => ({ open: async () => ({ db, profileId: ME }), worker: "test", now: () => "2026-11-19T00:00:00.000Z", paymentsEnabled: false });
const run = (name: string, input: unknown, db = seeded()) => TOOLS.find((t) => t.name === name)!.run(input as never, ctx(db)) as Promise<Record<string, unknown>>;

describe("listing tools", () => {
  it("update_agent edits only the given fields of your own agent and reports the review", async () => {
    const db = seeded();
    const r = await run("update_agent", { agentId: AGENT, specialty: "Research and writing", startingRate: "$300" }, db);
    expect(r.ok).toBe(true);
    expect(r.agent).toMatchObject({ id: AGENT, name: "Analyst", specialty: "Research and writing", starting_rate: "$300" });
    expect(r.review).toMatchObject({ status: "approved" });
  });
  it("update_agent refuses someone else's agent and an empty edit", async () => {
    expect(await run("update_agent", { agentId: "55555555-5555-4555-8555-555555555555", name: "Mine now" })).toEqual({ ok: false, error: "Not one of your agents." });
    expect(await run("update_agent", { agentId: AGENT })).toEqual({ ok: false, error: "Nothing to change: pass at least one field." });
  });
  it("set_agent_listed unlists and relists without touching the review", async () => {
    const db = seeded();
    const off = await run("set_agent_listed", { agentId: AGENT, listed: false }, db);
    expect(off).toMatchObject({ ok: true, public: false, agent: { listed: false, moderation_status: "approved" } });
    const on = await run("set_agent_listed", { agentId: AGENT, listed: true }, db);
    expect(on).toMatchObject({ ok: true, public: true, agent: { listed: true } });
  });
});

describe("brief tools", () => {
  it("update_opportunity edits an open brief and refuses a closed one", async () => {
    const db = seeded();
    expect(await run("update_opportunity", { opportunityId: BRIEF, title: "Market scan v2", budgetRange: "$800" }, db)).toMatchObject({ ok: true, opportunity: { title: "Market scan v2", budget_range: "$800" } });
    await run("close_opportunity", { opportunityId: BRIEF, declinePending: false }, db);
    expect((await run("update_opportunity", { opportunityId: BRIEF, title: "Again" }, db)).ok).toBe(false);
  });
  it("close_opportunity closes and declines pending applications and open proposals only", async () => {
    const db = seeded();
    expect(await run("close_opportunity", { opportunityId: BRIEF, declinePending: true }, db)).toMatchObject({ ok: true, opportunity: { status: "closed" }, declinedApplications: 1, declinedProposals: 2 });
    const { data: apps } = await db.from("applications").select("*");
    const { data: negs } = await db.from("negotiations").select("*");
    expect((apps as Array<{ id: string; status: string }>).map((a) => `${a.id}:${a.status}`)).toEqual(["a1:rejected", "a2:accepted"]);
    expect((negs as Array<{ id: string; status: string }>).map((n) => `${n.id}:${n.status}`)).toEqual(["n1:rejected", "n2:rejected", "n3:accepted"]);
    expect((await run("close_opportunity", { opportunityId: BRIEF, declinePending: true }, db)).ok).toBe(false);
    expect(await run("reopen_opportunity", { opportunityId: BRIEF }, db)).toMatchObject({ ok: true, opportunity: { status: "open" } });
  });
});

describe("payouts and disputes", () => {
  it("list_payouts shows only your own payouts, newest first, with totals", async () => {
    const r = await run("list_payouts", { limit: 25 });
    expect(r.totals).toEqual({ transferredCents: 4250, pendingCents: 8500 });
    expect((r.payouts as Array<{ id: string; contractTitle: string }>).map((p) => p.id)).toEqual(["p2", "p1"]);
    expect((r.payouts as Array<{ contractTitle: string }>)[0].contractTitle).toBe("Market scan");
  });
  it("open_dispute and resolve_dispute, and get_contract lists both", async () => {
    const db = seeded();
    const opened = await run("open_dispute", { contractId: CONTRACT, reason: "The delivery missed the scope" }, db);
    expect(opened).toMatchObject({ ok: true, dispute: { contract_id: CONTRACT } });
    const id = (opened.dispute as { id: string }).id;
    await db.from("disputes").update({ owner_id: ME }).eq("id", id);
    const contract = await run("get_contract", { contractId: CONTRACT }, db);
    expect((contract.disputes as Array<{ id: string; openedByYou: boolean }>).map((d) => [d.id, d.openedByYou])).toEqual([["d0", false], [id, true]]);
    expect(await run("resolve_dispute", { disputeId: id, resolutionNotes: "Agreed a revision" }, db)).toMatchObject({ ok: true, dispute: { status: "Resolved" } });
    expect((await run("resolve_dispute", { disputeId: "d0", resolutionNotes: "Again" }, db)).ok).toBe(false);
  });
});

describe("site", () => {
  const agent = (patch: Partial<CreatedAgent>): CreatedAgent => ({ ...({ id: AGENT, name: "Analyst", specialty: "Research", description: "Does research", startingRate: "$200", toolAccess: [], customSkills: [], createdAt: "2026-11-01", listed: true, moderationStatus: "approved", availability: "Available" } as unknown as CreatedAgent), ...patch });
  const brief = (patch: Partial<CreatedOpportunity>): CreatedOpportunity => ({ ...({ id: BRIEF, title: "Market scan", summary: "Scan three competitors in depth", budget: "$500", cadence: "project", category: "Research", createdAt: "2026-11-02", status: "open", requiredSkills: [], matchScore: 0, trustLevel: "Unverified", tags: [], accent: "violet" } as unknown as CreatedOpportunity), ...patch });

  it("public lists hide unlisted agents and closed briefs; the brief page can still find a closed one", () => {
    expect(getListedAgents([agent({}), agent({ id: "x", listed: false })]).map((a) => a.id)).toEqual([AGENT]);
    expect(getAllOpportunities([brief({}), brief({ id: "c", status: "closed" })]).map((b) => b.id)).toEqual([BRIEF]);
    expect(getAllOpportunities([brief({ id: "c", status: "closed" })], { includeClosed: true }).map((b) => b.id)).toEqual(["c"]);
  });
  it("owner panels offer the right action for the state", () => {
    expect(renderToStaticMarkup(createElement(OwnerListingPanel, { agent: agent({ listed: false }), onChanged: () => {} }))).toContain("List again");
    expect(renderToStaticMarkup(createElement(OwnerListingPanel, { agent: agent({}), onChanged: () => {} }))).toContain("Unlist");
    const open = renderToStaticMarkup(createElement(OwnerBriefPanel, { brief: brief({}), onChanged: () => {} }));
    expect(open).toContain("Edit brief");
    expect(open).toContain("Close brief");
    const closed = renderToStaticMarkup(createElement(OwnerBriefPanel, { brief: brief({ status: "closed" }), onChanged: () => {} }));
    expect(closed).toContain("Reopen brief");
    expect(closed).not.toContain("Edit brief");
  });
  it("says plainly where a listing and a payout stand", () => {
    expect(listingStatusText({ listed: false, moderationStatus: "approved" })).toMatch(/^Unlisted/);
    expect(listingStatusText({ listed: true, moderationStatus: "pending" })).toMatch(/^Waiting for review/);
    expect(listingStatusText({ listed: true, moderationStatus: "approved" })).toBe("Public on the marketplace.");
    expect(payoutStateText({ status: "transferred", transferredAt: "2026-11-10T00:00:00Z" })).toMatch(/^Sent to your Stripe account/);
    expect(payoutStateText({ status: "pending", transferredAt: null })).toBe("Waiting for release or your payout setup");
  });
});

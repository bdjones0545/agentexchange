import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TOOLS, type ToolContext } from "../server/mcp/tools";
import { SAMPLE_FOLD_CHARS, SampleDeliverable } from "../src/components/SampleDeliverable";
import { mapAgentRow } from "../src/lib/repositories/supabaseStateRepository";
import { fakeDb } from "./fakeSupabase";

const ME = "11111111-1111-4111-8111-111111111111";
const AGENT = "22222222-2222-4222-8222-222222222222";

function seeded() {
  return fakeDb({
    tables: {
      agents: [{ id: AGENT, owner_id: ME, name: "Analyst", specialty: "Research", moderation_status: "approved", listed: true, sample_deliverable: null, created_at: "2026-11-01" }],
    },
  });
}
const ctx = (db: ReturnType<typeof fakeDb>): ToolContext => ({ open: async () => ({ db, profileId: ME }), worker: "test", now: () => "2026-11-27T00:00:00.000Z", paymentsEnabled: false });
const run = (name: string, input: unknown, db: ReturnType<typeof fakeDb>) => TOOLS.find((t) => t.name === name)!.run(input as never, ctx(db)) as Promise<Record<string, unknown>>;
const row = async (db: ReturnType<typeof fakeDb>, name: string) => (await db.from("agents").select("*").eq("name", name).single()).data as Record<string, unknown>;

describe("sample deliverable on a listing", () => {
  it("shows a short sample in full with its line breaks kept", () => {
    const html = renderToStaticMarkup(createElement(SampleDeliverable, { sample: "Sample: audit, done for Acme.\n\nFindings:\n- Title too long" }));
    expect(html).toContain("Sample deliverable");
    expect(html).toContain("Findings:\n- Title too long");
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).not.toContain("Show the full sample");
    expect(html).not.toContain("max-h-80");
  });

  it("folds a long sample behind a button", () => {
    const html = renderToStaticMarkup(createElement(SampleDeliverable, { sample: "x".repeat(SAMPLE_FOLD_CHARS + 1) }));
    expect(html).toContain("max-h-80");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Show the full sample");
  });

  it("renders nothing for a blank sample", () => {
    expect(renderToStaticMarkup(createElement(SampleDeliverable, { sample: "  \n " }))).toBe("");
  });

  it("reads the column into the listing", () => {
    expect(mapAgentRow({ id: AGENT, name: "Analyst", sample_deliverable: "Sample: x" }).sampleDeliverable).toBe("Sample: x");
    expect(mapAgentRow({ id: AGENT, name: "Analyst", sample_deliverable: null }).sampleDeliverable).toBeUndefined();
  });

  it("update_agent sets, trims and removes the sample", async () => {
    const db = seeded();
    expect((await run("update_agent", { agentId: AGENT, sampleDeliverable: "  Sample: real work\n" }, db)).ok).toBe(true);
    expect((await row(db, "Analyst")).sample_deliverable).toBe("Sample: real work");
    expect((await run("update_agent", { agentId: AGENT, sampleDeliverable: "" }, db)).ok).toBe(true);
    expect((await row(db, "Analyst")).sample_deliverable).toBeNull();
  });

  it("update_agent and publish_agent cap the sample at 8,000 characters", () => {
    for (const name of ["update_agent", "publish_agent"]) {
      const schema = TOOLS.find((t) => t.name === name)!.schema;
      const base = name === "update_agent" ? { agentId: AGENT } : { name: "New one", specialty: "Research" };
      expect(schema.safeParse({ ...base, sampleDeliverable: "x".repeat(8000) }).success).toBe(true);
      expect(schema.safeParse({ ...base, sampleDeliverable: "x".repeat(8001) }).success).toBe(false);
    }
  });

  it("publish_agent stores a sample only when one is given", async () => {
    const db = seeded();
    expect((await run("publish_agent", { name: "With sample", specialty: "Research", sampleDeliverable: "Sample: done for Acme" }, db)).ok).toBe(true);
    expect((await row(db, "With sample")).sample_deliverable).toBe("Sample: done for Acme");
    expect((await run("publish_agent", { name: "Without sample", specialty: "Research" }, db)).ok).toBe(true);
    expect("sample_deliverable" in (await row(db, "Without sample"))).toBe(false);
  });
});

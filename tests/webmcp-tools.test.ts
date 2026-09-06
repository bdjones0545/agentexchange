/**
 * AgentExchange's WebMCP tool surface.
 *
 * These tools read a snapshot of application state, so no mocking of the data
 * layer is needed — the snapshot is supplied directly. What is under test is
 * that every tool is read-only, that search filters behave, and that a
 * signed-out caller is told to sign in rather than handed empty results.
 */
import { describe, expect, it } from "vitest";

import { opportunities } from "../src/data/marketplace";
import { agents } from "../src/data/agents";
import type { AgentExchangePersistedState } from "../src/state/marketplaceTypes";
import {
  buildAgentExchangeTools,
  type AgentExchangeSnapshot,
} from "../src/webmcp/tools";

type ToolResult = { isError?: boolean };

function textOf(result: unknown): string {
  const block = (result as { content?: { text?: string }[] }).content?.[0];
  if (typeof block?.text !== "string") throw new Error("tool returned no text content");
  return block.text;
}

const emptyState: AgentExchangePersistedState = {
  agentActivities: [],
  agentReviews: [],
  applications: [],
  contractWorkspaces: [],
  contractDisputes: [],
  createdAgents: [],
  createdOpportunities: [],
  hireRequests: [],
  localContracts: [],
  negotiations: [],
  savedOpportunities: [],
};

function toolsFor(snapshot: AgentExchangeSnapshot) {
  const built = buildAgentExchangeTools(() => snapshot);
  return {
    all: built,
    read: async (name: string, input: Record<string, unknown> = {}) => {
      const tool = built.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`no such tool: ${name}`);
      return JSON.parse(textOf(await tool.execute(input)));
    },
    call: async (name: string, input: Record<string, unknown> = {}) => {
      const tool = built.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`no such tool: ${name}`);
      return (await tool.execute(input)) as ToolResult;
    },
  };
}

/** A state with something in every collection, for the immutability proof. */
const populatedState: AgentExchangePersistedState = {
  ...emptyState,
  savedOpportunities: [{ opportunityId: "o1", savedAt: "2026-01-01" }],
  applications: [
    {
      id: "a1",
      opportunityId: "o1",
      opportunityTitle: "T",
      agentId: "ag1",
      agentName: "A",
      proposal: "p",
      status: "pending",
      createdAt: "2026-01-01",
    },
  ],
};

const signedIn = toolsFor({ state: emptyState, isAuthenticated: true });
const signedOut = toolsFor({ state: emptyState, isAuthenticated: false });

describe("the tool surface", () => {
  it("exposes exactly the five intended tools", () => {
    expect(signedIn.all.map((tool) => tool.name).sort()).toEqual([
      "agentexchange_list_my_applications",
      "agentexchange_list_my_contracts",
      "agentexchange_list_saved_opportunities",
      "agentexchange_search_agents",
      "agentexchange_search_opportunities",
    ]);
  });

  it("declares every tool read-only", () => {
    for (const tool of signedIn.all) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("marks results that can contain other people's text as untrusted", () => {
    for (const tool of signedIn.all) {
      expect(tool.annotations?.untrustedContentHint).toBe(true);
    }
  });

  it("names every tool with a reading verb", () => {
    // The naming convention carries the guarantee: a tool that applies to an
    // opportunity, accepts a negotiation or saves a listing could not be named
    // under this rule. (A substring check would be wrong here — the read tool
    // agentexchange_list_saved_opportunities legitimately contains "save".)
    for (const tool of signedIn.all) {
      expect(tool.name).toMatch(/^agentexchange_(get|list|search)_/);
    }
  });

  it("leaves application state untouched when every tool is executed", async () => {
    // The real read-only proof: run the whole surface and show the state it was
    // handed is byte-identical afterwards.
    const state = structuredClone(populatedState);
    const before = JSON.stringify(state);
    const built = buildAgentExchangeTools(() => ({ state, isAuthenticated: true }));
    for (const tool of built) {
      await tool.execute({ query: "a", limit: 5 });
    }
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("opportunity search", () => {
  it("returns the whole catalog with no query", async () => {
    const result = await signedIn.read("agentexchange_search_opportunities", {
      limit: 99,
    });
    expect(result.count).toBe(opportunities.length);
  });

  it("matches on summary text", async () => {
    const result = await signedIn.read("agentexchange_search_opportunities", {
      query: "compliance",
    });
    expect(result.count).toBeGreaterThan(0);
    for (const item of result.opportunities) {
      const haystack = `${item.title} ${item.summary} ${item.tags.join(" ")}`;
      expect(haystack.toLowerCase()).toContain("compliance");
    }
  });

  it("matches on a tag as well as prose", async () => {
    const result = await signedIn.read("agentexchange_search_opportunities", {
      query: "zapier",
    });
    expect(result.count).toBeGreaterThan(0);
  });

  it("is case-insensitive", async () => {
    const lower = await signedIn.read("agentexchange_search_opportunities", {
      query: "compliance",
    });
    const upper = await signedIn.read("agentexchange_search_opportunities", {
      query: "COMPLIANCE",
    });
    expect(upper.count).toBe(lower.count);
  });

  it("filters by category", async () => {
    const category = opportunities[0]?.category;
    const result = await signedIn.read("agentexchange_search_opportunities", {
      category,
      limit: 99,
    });
    for (const item of result.opportunities) expect(item.category).toBe(category);
  });

  it("returns nothing for a term that matches nothing", async () => {
    const result = await signedIn.read("agentexchange_search_opportunities", {
      query: "zzzzz-no-such-term",
    });
    expect(result).toEqual({ count: 0, opportunities: [] });
  });

  it("clamps a nonsensical limit to at least one result", async () => {
    const result = await signedIn.read("agentexchange_search_opportunities", {
      limit: -5,
    });
    expect(result.count).toBe(1);
  });

  it("includes opportunities the user created, not just the seeded catalog", async () => {
    const created = {
      ...opportunities[0],
      id: "local-1",
      title: "Locally created opportunity",
    };
    const local = toolsFor({
      state: { ...emptyState, createdOpportunities: [created as never] },
      isAuthenticated: true,
    });
    const result = await local.read("agentexchange_search_opportunities", {
      query: "Locally created",
    });
    expect(result.count).toBe(1);
    expect(result.opportunities[0].id).toBe("local-1");
  });
});

describe("agent search", () => {
  it("returns the whole roster with no query", async () => {
    const result = await signedIn.read("agentexchange_search_agents", { limit: 99 });
    expect(result.count).toBe(agents.length);
  });

  it("filters by availability", async () => {
    const result = await signedIn.read("agentexchange_search_agents", {
      availability: "Available",
      limit: 99,
    });
    for (const agent of result.agents) expect(agent.availability).toBe("Available");
  });

  it("resolves skill ids to readable labels", async () => {
    const result = await signedIn.read("agentexchange_search_agents", { limit: 99 });
    for (const agent of result.agents) {
      for (const skill of agent.skills) expect(typeof skill).toBe("string");
    }
  });
});

describe("personal tools", () => {
  const personal = [
    "agentexchange_list_my_applications",
    "agentexchange_list_saved_opportunities",
    "agentexchange_list_my_contracts",
  ];

  it("tell a signed-out caller to sign in rather than reporting nothing", async () => {
    for (const name of personal) {
      const result = await signedOut.read(name);
      expect(result.error).toContain("No signed-in user");
    }
  });

  it("return real structure once signed in", async () => {
    const applications = await signedIn.read("agentexchange_list_my_applications");
    expect(applications).toEqual({
      applications: [],
      negotiations: [],
      hireRequests: [],
    });
  });

  it("resolve a saved opportunity to its catalog detail", async () => {
    const target = opportunities[0];
    if (!target) throw new Error("catalog is empty");
    const local = toolsFor({
      state: {
        ...emptyState,
        savedOpportunities: [{ opportunityId: target.id, savedAt: "2026-01-01" }],
      },
      isAuthenticated: true,
    });
    const result = await local.read("agentexchange_list_saved_opportunities");
    expect(result.count).toBe(1);
    expect(result.saved[0].title).toBe(target.title);
  });

  it("says so when a saved opportunity is no longer listed", async () => {
    const local = toolsFor({
      state: {
        ...emptyState,
        savedOpportunities: [{ opportunityId: "gone", savedAt: "2026-01-01" }],
      },
      isAuthenticated: true,
    });
    const result = await local.read("agentexchange_list_saved_opportunities");
    expect(result.saved[0].title).toBe("(no longer listed)");
  });

  it("reports only unresolved disputes alongside contracts", async () => {
    const dispute = (id: string, status: string) => ({
      id,
      contractId: "c1",
      reason: "late",
      status,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
    const local = toolsFor({
      state: {
        ...emptyState,
        contractDisputes: [
          dispute("d1", "Open"),
          dispute("d2", "Resolved"),
        ] as never,
      },
      isAuthenticated: true,
    });
    const result = await local.read("agentexchange_list_my_contracts");
    expect(result.openDisputes.map((d: { id: string }) => d.id)).toEqual(["d1"]);
  });
});

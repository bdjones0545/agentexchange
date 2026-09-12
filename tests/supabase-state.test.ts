/**
 * Supabase-mode hydration: rows from the normalized tables become the same
 * state shape the UI already consumes. These are the mappings that make the
 * marketplace two-sided, so they are pinned here without a Supabase client.
 */
import { describe, expect, it } from "vitest";

import {
  buildWorkspaces,
  mapAgentActivityRow,
  mapApplicationRow,
  mapContractRow,
  mapHireRequestRow,
  mapOpportunityRow,
  mapRowsToState,
  type SupabaseStateRows,
} from "../src/lib/repositories/supabaseStateRepository";

const OPP_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const AGENT_ID = "33333333-3333-4333-8333-333333333333";
const CONTRACT_ID = "44444444-4444-4444-8444-444444444444";
const OWNER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const emptyRows: SupabaseStateRows = {
  activityEvents: [],
  agents: [],
  applications: [],
  contractDeliverables: [],
  contractMessages: [],
  contractMilestones: [],
  contracts: [],
  disputes: [],
  hireRequests: [],
  negotiations: [],
  opportunities: [],
  reviews: [],
  savedOpportunities: [],
};

const opportunityRow = {
  budget_range: "$4k-$6k",
  category: "Research",
  created_at: "2026-09-01T00:00:00Z",
  description: "Summarize a market.",
  estimated_duration: "2 weeks",
  id: OPP_ID,
  organization_id: ORG_ID,
  organization_name: "Acme",
  owner_id: OWNER_A,
  required_skills: ["research", "writing"],
  status: "open",
  success_criteria: "A memo.",
  title: "Market memo",
};

describe("mapOpportunityRow", () => {
  it("carries the relationship keys the lifecycle depends on", () => {
    const opportunity = mapOpportunityRow(opportunityRow);
    expect(opportunity.id).toBe(OPP_ID);
    expect(opportunity.organizationId).toBe(ORG_ID);
    expect(opportunity.ownerId).toBe(OWNER_A);
    expect(opportunity.organization).toBe("Acme");
    expect(opportunity.tags).toEqual(["research", "writing"]);
  });

  it("falls back to a Custom tag when no skills are listed", () => {
    expect(mapOpportunityRow({ ...opportunityRow, required_skills: [] }).tags).toEqual(["Custom"]);
  });
});

describe("mapApplicationRow / mapHireRequestRow", () => {
  const opportunities = new Map([[OPP_ID, mapOpportunityRow(opportunityRow)]]);

  it("resolves the opportunity title from the loaded opportunities", () => {
    const application = mapApplicationRow(
      {
        agent_id: AGENT_ID,
        agent_name: "Scout",
        created_at: "2026-09-02T00:00:00Z",
        id: "55555555-5555-4555-8555-555555555555",
        opportunity_id: OPP_ID,
        owner_id: OWNER_B,
        proposal: "I can do this.",
        status: "pending",
      },
      opportunities,
    );
    expect(application.opportunityTitle).toBe("Market memo");
    expect(application.ownerId).toBe(OWNER_B);
    expect(application.status).toBe("pending");
  });

  it("keeps the hire request's own title when it has one", () => {
    const hireRequest = mapHireRequestRow(
      {
        agent_id: AGENT_ID,
        agent_name: "Scout",
        created_at: "2026-09-02T00:00:00Z",
        id: "66666666-6666-4666-8666-666666666666",
        opportunity_id: OPP_ID,
        opportunity_title: "Market memo",
        owner_id: OWNER_A,
        quick_job_title: null,
        status: "pending",
      },
      opportunities,
    );
    expect(hireRequest.opportunityTitle).toBe("Market memo");
    expect(hireRequest.quickJobTitle).toBeUndefined();
    expect(hireRequest.ownerId).toBe(OWNER_A);
  });
});

describe("mapContractRow", () => {
  it("preserves source provenance and both party ids", () => {
    const contract = mapContractRow({
      agent_id: AGENT_ID,
      agent_name: "Scout",
      due_date: "2026-09-30",
      id: CONTRACT_ID,
      organization_id: ORG_ID,
      organization_name: "Acme",
      progress: 5,
      source_id: "66666666-6666-4666-8666-666666666666",
      source_type: "hire-request",
      start_date: "2026-09-02",
      status: "Active",
      title: "Market memo",
      value: "$4k-$6k",
    });
    expect(contract.sourceType).toBe("hire-request");
    expect(contract.organizationId).toBe(ORG_ID);
    expect(contract.agentId).toBe(AGENT_ID);
    expect(contract.accent).toBe("emerald");
  });
});

describe("buildWorkspaces", () => {
  it("groups child rows per contract and derives a timeline", () => {
    const contract = mapContractRow({
      agent_name: "Scout",
      id: CONTRACT_ID,
      organization_name: "Acme",
      title: "Market memo",
    });
    const [workspace] = buildWorkspaces(
      [contract],
      [
        { completed: true, completed_at: "2026-09-05T00:00:00Z", contract_id: CONTRACT_ID, created_at: "2026-09-03T00:00:00Z", id: "m1", title: "Outline" },
        { completed: false, contract_id: "other", created_at: "2026-09-03T00:00:00Z", id: "m2", title: "Not mine" },
      ],
      [{ contract_id: CONTRACT_ID, created_at: "2026-09-04T00:00:00Z", decisions: [], id: "d1", status: "submitted", submitted_at: "2026-09-06T00:00:00Z", title: "Draft" }],
      [{ author: "Acme", body: "Hi", contract_id: CONTRACT_ID, created_at: "2026-09-03T12:00:00Z", id: "msg1", sender_type: "Organization" }],
    );
    expect(workspace.contractId).toBe(CONTRACT_ID);
    expect(workspace.milestones.map((m) => m.id)).toEqual(["m1"]);
    expect(workspace.deliverables[0].status).toBe("submitted");
    expect(workspace.messages[0].senderType).toBe("Organization");
    expect(workspace.activity[0].type).toBe("deliverable_submitted");
    expect(workspace.activity.map((a) => a.type)).toContain("milestone_completed");
    expect(workspace.updatedAt).toBe("2026-09-04T00:00:00Z");
  });
});

describe("mapAgentActivityRow", () => {
  it("rebuilds the event from metadata and drops rows without an agent", () => {
    const event = mapAgentActivityRow({
      created_at: "2026-09-02T00:00:00Z",
      id: "e1",
      message: "Scout applied to Market memo.",
      metadata: { agentId: AGENT_ID, agentName: "Scout", createdAt: "2026-09-02T00:00:00Z", type: "application_submitted" },
    });
    expect(event?.type).toBe("application_submitted");
    expect(event?.agentName).toBe("Scout");
    expect(mapAgentActivityRow({ id: "e2", message: "x", metadata: {} })).toBeNull();
  });
});

describe("mapRowsToState", () => {
  it("produces the full persisted-state shape with every collection populated", () => {
    const state = mapRowsToState({
      ...emptyRows,
      agents: [{ created_at: "2026-09-01T00:00:00Z", id: AGENT_ID, name: "Scout", owner_id: OWNER_B, skills: ["research"], specialty: "Research" }],
      applications: [{ agent_id: AGENT_ID, agent_name: "Scout", created_at: "2026-09-02T00:00:00Z", id: "a1", opportunity_id: OPP_ID, owner_id: OWNER_B, proposal: "Yes", status: "pending" }],
      contracts: [{ agent_name: "Scout", created_at: "2026-09-03T00:00:00Z", id: CONTRACT_ID, organization_name: "Acme", title: "Market memo" }],
      opportunities: [opportunityRow],
      reviews: [{ agent_name: "Scout", contract_id: CONTRACT_ID, created_at: "2026-09-07T00:00:00Z", id: "r1", organization_name: "Acme", rating: 5, review: "Great" }],
      savedOpportunities: [{ created_at: "2026-09-02T00:00:00Z", opportunity_id: OPP_ID }],
    });
    expect(state.createdOpportunities).toHaveLength(1);
    expect(state.createdAgents[0].ownerId).toBe(OWNER_B);
    expect(state.applications[0].opportunityTitle).toBe("Market memo");
    expect(state.localContracts[0].id).toBe(CONTRACT_ID);
    expect(state.contractWorkspaces[0].contractId).toBe(CONTRACT_ID);
    expect(state.agentReviews[0].rating).toBe(5);
    expect(state.savedOpportunities[0].opportunityId).toBe(OPP_ID);
    // Nothing leaks in from a browser snapshot: the shape is exactly the tables.
    expect(Object.keys(state).sort()).toEqual([
      "agentActivities",
      "agentReviews",
      "applications",
      "contractDisputes",
      "contractWorkspaces",
      "createdAgents",
      "createdOpportunities",
      "hireRequests",
      "localContracts",
      "negotiations",
      "savedOpportunities",
    ]);
  });
});

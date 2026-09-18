import { describe, expect, it } from "vitest";
import { agents } from "../src/data/agents";
import { getAgentRatingLabel, getVerificationStatus } from "../src/data/agentTrust";
import {
  applyWorkspaceToContract,
  deriveContractRow,
  withDeliverableDecision,
  withMilestoneToggled,
} from "../src/data/contractWorkspace";
import { getLiveActivity, getLiveHubMetrics, getLiveMarketplaceMetrics } from "../src/data/liveMetrics";
import type { ContractWorkspace, CreatedAgent } from "../src/state/marketplaceTypes";
import type { Contract } from "../src/data/operations";

const workerAgent: CreatedAgent = {
  ...agents[0],
  id: "1e6b8619-585b-4c55-b6ef-975e93f2bf5b",
  name: "Research and Writing Analyst",
  tier: "Unverified",
  trustScore: 0,
  revenue: "$0",
  successRate: "New",
  createdAt: "2026-09-18T00:00:00Z",
  description: "",
  startingRate: "",
  toolAccess: [],
  ownerId: "2cef0bea-0776-458b-94a1-843274728541",
};

const completed: Contract = {
  id: "c1",
  organization: "Acme",
  agent: workerAgent.name,
  title: "Scan",
  value: "$600",
  status: "Completed",
  startDate: "",
  dueDate: "",
  progress: 100,
  accent: "violet",
};

describe("trust signals in shared mode come from the stored columns", () => {
  it("does not infer VERIFIED from a completed contract", () => {
    const input = { agent: workerAgent, contracts: [completed], disputes: [], reviews: [] };
    expect(getVerificationStatus(input, { sharedMode: false })).toBe("Verified");
    expect(getVerificationStatus(input, { sharedMode: true })).toBe("Unverified");
    expect(getVerificationStatus({ ...input, agent: { ...workerAgent, tier: "Top Rated" } }, { sharedMode: true })).toBe("Top Rated");
    expect(getVerificationStatus({ ...input, agent: { ...workerAgent, tier: "Enterprise Tier" } }, { sharedMode: true })).toBe("Unverified");
  });

  it("shows no rating until an organization leaves one", () => {
    expect(getAgentRatingLabel(workerAgent, [], { sharedMode: true })).toBe("No reviews yet");
    expect(getAgentRatingLabel(workerAgent, [], { sharedMode: false })).toBe("5.0 rating");
    const review = { id: "r1", agentId: workerAgent.id, agentName: workerAgent.name, contractId: "c1", contractTitle: "Scan", organization: "Acme", rating: 4, review: "good", createdAt: "" };
    expect(getAgentRatingLabel(workerAgent, [review], { sharedMode: true })).toBe("4.0 rating (1)");
  });
});

describe("contract status and progress", () => {
  const workspace: ContractWorkspace = {
    contractId: "c1",
    milestones: [{ id: "m1", title: "Plan", notes: "", completed: false, createdAt: "" }],
    deliverables: [{ id: "d1", title: "Memo", notes: "", status: "submitted", decisions: [], createdAt: "" }],
    messages: [],
    activity: [],
    updatedAt: "",
  };
  const row: Contract = { ...completed, status: "Active", progress: 90 };

  it("shared mode renders the row as stored; demo mode derives from the workspace", () => {
    expect(applyWorkspaceToContract(row, workspace, { sharedMode: true })).toEqual(row);
    expect(applyWorkspaceToContract(row, workspace, { sharedMode: false })).toMatchObject({ status: "In Review", progress: 25 });
  });

  it("a decision derives the pair the product writes back to the row", () => {
    const approved = withDeliverableDecision(workspace, "d1", "approved");
    expect(deriveContractRow(approved)).toEqual({ status: "Active", progress: 50 });
    const done = withMilestoneToggled(approved, "m1");
    expect(deriveContractRow(done)).toEqual({ status: "Completed", progress: 100 });
    expect(deriveContractRow(withDeliverableDecision(workspace, "d1", "rejected"))).toEqual({ status: "Active", progress: 0 });
  });
});

describe("live metrics never show seed numbers", () => {
  it("counts the rows the user can see", () => {
    const metrics = getLiveMarketplaceMetrics({ agents: [workerAgent], opportunities: [], contracts: [completed], hireRequests: [] });
    expect(metrics.map((m) => [m.label, m.value])).toEqual([
      ["Agents listed", "1"],
      ["Open opportunities", "0"],
      ["Contracts in flight", "0"],
    ]);
    const hub = getLiveHubMetrics({ agents: [], opportunities: [], contracts: [completed, { ...completed, id: "c2", status: "In Review" }], hireRequests: [{ id: "h", agentId: "a", agentName: "x", opportunityId: "o", opportunityTitle: "t", quickJobTitle: "", status: "pending", createdAt: "" }] });
    expect(hub.map((m) => m.value)).toEqual(["0", "1", "1", "1"]);
  });

  it("turns recorded agent activity into a feed with relative times", () => {
    const now = Date.parse("2026-09-18T01:00:00Z");
    const feed = getLiveActivity([
      { id: "a1", agentId: "x", agentName: "Analyst", type: "deliverable_submitted", message: "Submitted the memo.", createdAt: "2026-09-18T00:56:00Z" },
      { id: "a0", agentId: "x", agentName: "Analyst", type: "hire_request_submitted", message: "Was hired.", createdAt: "2026-09-17T20:00:00Z" },
    ], 6, now);
    expect(feed.map((f) => [f.detail, f.timeAgo])).toEqual([
      ["Submitted the memo.", "4m ago"],
      ["Was hired.", "5h ago"],
    ]);
  });
});

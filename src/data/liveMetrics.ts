// Real numbers for the marketplace surfaces in shared mode.
//
// Demo mode ships illustrative seed metrics ("124k agents", "$12.4k today").
// A signed-in user on the shared marketplace must never see those next to
// their own contracts, so these helpers derive every tile and feed item from
// the rows the user can actually see.
import type { Category, LiveActivityItem, MarketplaceMetric } from "./marketplace";
import type { ActivityEvent, Contract, HubMetric } from "./operations";
import type {
  AgentActivityEvent,
  CreatedAgent,
  CreatedOpportunity,
  HireRequest,
  LocalContract,
} from "../state/marketplaceTypes";

type LiveInput = {
  agents: CreatedAgent[];
  opportunities: CreatedOpportunity[];
  contracts: Array<LocalContract | Contract>;
  hireRequests: HireRequest[];
};

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export function getLiveMarketplaceMetrics(input: LiveInput): MarketplaceMetric[] {
  const openOpportunities = input.opportunities.length;
  const active = input.contracts.filter((c) => c.status !== "Completed").length;
  return [
    {
      id: "agents",
      label: "Agents listed",
      value: String(input.agents.length),
      detail: input.agents.length === 0 ? "Be the first to publish one" : "Published by operators on this marketplace",
      accent: "cyan",
    },
    {
      id: "opportunities",
      label: "Open opportunities",
      value: String(openOpportunities),
      detail: openOpportunities === 0 ? "Post one to start hiring" : "Briefs accepting applications now",
      accent: "violet",
    },
    {
      id: "contracts",
      label: "Contracts in flight",
      value: String(active),
      detail: input.contracts.length === 0 ? "None yet" : `${plural(input.contracts.length - active, "contract")} completed`,
      accent: "emerald",
    },
  ];
}

/** Seed category cards, re-labelled with the real count of open briefs. */
export function getLiveCategories(seed: Category[], opportunities: CreatedOpportunity[]): Category[] {
  return seed.map((category) => {
    const count = opportunities.filter(
      (o) => o.category.toLowerCase() === category.title.toLowerCase(),
    ).length;
    return { ...category, metric: String(count), metricLabel: count === 1 ? "open brief" : "open briefs" };
  });
}

function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const ACTIVITY_ACCENT: Record<AgentActivityEvent["type"], LiveActivityItem["accent"]> = {
  application_submitted: "cyan",
  contract_completed: "emerald",
  deliverable_approved: "emerald",
  deliverable_rejected: "amber",
  deliverable_submitted: "violet",
  hire_request_submitted: "cyan",
  negotiation_started: "amber",
  status_changed: "violet",
};

export function getLiveActivity(activities: AgentActivityEvent[], limit = 6, now = Date.now()): LiveActivityItem[] {
  return [...activities]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((activity) => ({
      id: activity.id,
      title: activity.agentName,
      detail: activity.message,
      value: "",
      timeAgo: timeAgo(activity.createdAt, now),
      accent: ACTIVITY_ACCENT[activity.type] ?? "violet",
    }));
}

const TIMELINE_TYPE: Partial<Record<AgentActivityEvent["type"], ActivityEvent["type"]>> = {
  application_submitted: "Proposal submitted",
  contract_completed: "Contract awarded",
  deliverable_approved: "Deliverable approved",
  hire_request_submitted: "Contract awarded",
  negotiation_started: "Proposal submitted",
};

export function getLiveTimeline(activities: AgentActivityEvent[], limit = 8, now = Date.now()): ActivityEvent[] {
  return [...activities]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((activity) => ({
      id: activity.id,
      type: TIMELINE_TYPE[activity.type] ?? "Proposal submitted",
      title: activity.agentName,
      detail: activity.message,
      timestamp: timeAgo(activity.createdAt, now),
      accent: ACTIVITY_ACCENT[activity.type] ?? "violet",
    }));
}

export function getLiveHubMetrics(input: LiveInput): HubMetric[] {
  const active = input.contracts.filter((c) => c.status === "Active").length;
  const inReview = input.contracts.filter((c) => c.status === "In Review").length;
  const completed = input.contracts.filter((c) => c.status === "Completed").length;
  const pendingHires = input.hireRequests.filter((h) => h.status === "pending").length;
  return [
    { id: "active", label: "Active Contracts", value: String(active), detail: "Work in progress", accent: "cyan" },
    { id: "review", label: "In Review", value: String(inReview), detail: "Deliverables awaiting your decision", accent: "violet" },
    { id: "completed", label: "Completed", value: String(completed), detail: "Approved and closed", accent: "emerald" },
    { id: "hires", label: "Pending Hire Requests", value: String(pendingHires), detail: "Waiting on an operator", accent: "amber" },
  ];
}

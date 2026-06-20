import type { AccentTone } from "./marketplace";

export type ContractStatus = "Active" | "Pending Approval" | "Completed";

export type Organization = {
  id: string;
  name: string;
  sector: string;
};

export type Contract = {
  id: string;
  organizationId: string;
  organization: string;
  agent: string;
  title: string;
  value: string;
  status: ContractStatus;
  startDate: string;
  dueDate: string;
  progress: number;
  accent: AccentTone;
};

export type HubMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
  accent: AccentTone;
};

export type ActivityEventType =
  | "Contract awarded"
  | "Proposal submitted"
  | "Deliverable approved"
  | "Payment received"
  | "Collaboration started";

export type ActivityEvent = {
  id: string;
  type: ActivityEventType;
  title: string;
  detail: string;
  timestamp: string;
  accent: AccentTone;
};

export type CollaborationStatus = "Active" | "Completed" | "Shared";

export type Collaboration = {
  id: string;
  title: string;
  participants: string[];
  status: CollaborationStatus;
  detail: string;
  value: string;
  accent: AccentTone;
};

export type NetworkNode = {
  id: string;
  name: string;
  specialty: string;
  accent: AccentTone;
};

export const organizations: Organization[] = [
  {
    id: "orbit-dynamics",
    name: "Orbit Dynamics",
    sector: "Aerospace SaaS",
  },
  {
    id: "helix-capital",
    name: "Helix Capital",
    sector: "Financial Ops",
  },
  {
    id: "nova-retail",
    name: "Nova Retail",
    sector: "Commerce",
  },
  {
    id: "protocol-labs",
    name: "Protocol Labs",
    sector: "Web3 Infrastructure",
  },
];

export const contracts: Contract[] = [
  {
    id: "contract-orbit-research",
    organizationId: "orbit-dynamics",
    organization: "Orbit Dynamics",
    agent: "Nexus-1 Alpha",
    title: "Autonomous Infrastructure Audit",
    value: "$64,000",
    status: "Active",
    startDate: "Jun 12",
    dueDate: "Jul 01",
    progress: 72,
    accent: "violet",
  },
  {
    id: "contract-helix-risk",
    organizationId: "helix-capital",
    organization: "Helix Capital",
    agent: "Fin-Agent Prime",
    title: "Risk Signal Synthesis",
    value: "$38,500",
    status: "Active",
    startDate: "Jun 15",
    dueDate: "Jun 29",
    progress: 48,
    accent: "cyan",
  },
  {
    id: "contract-nova-gtm",
    organizationId: "nova-retail",
    organization: "Nova Retail",
    agent: "Atlas-Alpha",
    title: "GTM Routing Automation",
    value: "$22,000",
    status: "Pending Approval",
    startDate: "Jun 21",
    dueDate: "Jul 08",
    progress: 12,
    accent: "amber",
  },
  {
    id: "contract-protocol-deliverable",
    organizationId: "protocol-labs",
    organization: "Protocol Labs",
    agent: "Nexus-1 Alpha",
    title: "Protocol Threat Model",
    value: "$45,000",
    status: "Pending Approval",
    startDate: "Jun 03",
    dueDate: "Jun 20",
    progress: 96,
    accent: "emerald",
  },
  {
    id: "contract-orbit-playbook",
    organizationId: "orbit-dynamics",
    organization: "Orbit Dynamics",
    agent: "Atlas-Alpha",
    title: "Enterprise Sales Playbook",
    value: "$18,400",
    status: "Completed",
    startDate: "May 18",
    dueDate: "Jun 05",
    progress: 100,
    accent: "emerald",
  },
  {
    id: "contract-helix-audit",
    organizationId: "helix-capital",
    organization: "Helix Capital",
    agent: "Fin-Agent Prime",
    title: "Smart Contract Controls Review",
    value: "$51,000",
    status: "Completed",
    startDate: "May 10",
    dueDate: "Jun 01",
    progress: 100,
    accent: "violet",
  },
];

export const hubMetrics: HubMetric[] = [
  {
    id: "revenue-today",
    label: "Revenue Today",
    value: "$12.4k",
    detail: "Across active contract milestones",
    accent: "emerald",
  },
  {
    id: "active-contracts",
    label: "Active Contracts",
    value: "2",
    detail: "Operational agreements in flight",
    accent: "violet",
  },
  {
    id: "pending-actions",
    label: "Pending Actions",
    value: "3",
    detail: "Approvals, signatures, and reviews",
    accent: "amber",
  },
  {
    id: "trust-score",
    label: "Trust Score",
    value: "99.8",
    detail: "Enterprise reliability index",
    accent: "cyan",
  },
];

export const activityFeed: ActivityEvent[] = [
  {
    id: "awarded",
    type: "Contract awarded",
    title: "Orbit Dynamics awarded infrastructure audit",
    detail: "Nexus-1 Alpha accepted a high-trust enterprise scope.",
    timestamp: "Now",
    accent: "emerald",
  },
  {
    id: "proposal",
    type: "Proposal submitted",
    title: "Atlas-Alpha submitted GTM automation proposal",
    detail: "Awaiting Nova Retail approval for the staged rollout.",
    timestamp: "18m ago",
    accent: "violet",
  },
  {
    id: "deliverable",
    type: "Deliverable approved",
    title: "Protocol threat model approved",
    detail: "Final review cleared with no critical blockers.",
    timestamp: "44m ago",
    accent: "cyan",
  },
  {
    id: "payment",
    type: "Payment received",
    title: "Milestone payment received from Helix Capital",
    detail: "Risk synthesis milestone settled in the mock ledger.",
    timestamp: "1h ago",
    accent: "emerald",
  },
  {
    id: "collaboration",
    type: "Collaboration started",
    title: "Research Agent joined strategy workflow",
    detail: "Cross-agent project orchestration began for market launch.",
    timestamp: "2h ago",
    accent: "amber",
  },
];

export const networkNodes: NetworkNode[] = [
  {
    id: "research-agent",
    name: "Research Agent",
    specialty: "Signal extraction",
    accent: "cyan",
  },
  {
    id: "strategy-agent",
    name: "Strategy Agent",
    specialty: "Planning synthesis",
    accent: "violet",
  },
  {
    id: "content-agent",
    name: "Content Agent",
    specialty: "Narrative generation",
    accent: "amber",
  },
  {
    id: "qa-agent",
    name: "QA Agent",
    specialty: "Validation loop",
    accent: "emerald",
  },
];

export const collaborations: Collaboration[] = [
  {
    id: "collab-launch-system",
    title: "Enterprise Launch System",
    participants: ["Research Agent", "Strategy Agent", "Content Agent"],
    status: "Active",
    detail: "Coordinating discovery, positioning, and launch artifacts.",
    value: "$28k scope",
    accent: "violet",
  },
  {
    id: "collab-risk-review",
    title: "Risk Review Sprint",
    participants: ["Fin-Agent Prime", "QA Agent"],
    status: "Completed",
    detail: "Recently completed contract control review package.",
    value: "5 deliverables",
    accent: "emerald",
  },
  {
    id: "collab-market-map",
    title: "Shared Market Map",
    participants: ["Atlas-Alpha", "Research Agent", "Nexus-1 Alpha"],
    status: "Shared",
    detail: "Shared project intelligence for upcoming opportunity matching.",
    value: "3 orgs",
    accent: "cyan",
  },
];

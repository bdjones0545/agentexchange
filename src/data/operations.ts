import type { AccentTone } from "./marketplace";

export type ContractStatus =
  | "Active"
  | "In Review"
  | "Pending Approval"
  | "Completed";

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
  | "Contract completed"
  | "Hire request"
  | "Proposal submitted"
  | "Negotiation started"
  | "Deliverable submitted"
  | "Deliverable approved"
  | "Deliverable returned"
  | "Status changed"
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
    id: "meridian-systems",
    name: "Meridian Systems",
    sector: "Enterprise Infrastructure",
  },
];


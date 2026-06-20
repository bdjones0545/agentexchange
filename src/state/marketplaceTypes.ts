import type { AccentTone } from "../data/marketplace";
import type { ContractStatus } from "../data/operations";

export type LocalRequestStatus = "pending" | "accepted";

export type SavedOpportunity = {
  opportunityId: string;
  savedAt: string;
};

export type Application = {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  agentId: string;
  agentName: string;
  proposal: string;
  status: LocalRequestStatus;
  createdAt: string;
};

export type Negotiation = {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  rate: string;
  timeline: string;
  milestoneNotes: string;
  status: "pending";
  createdAt: string;
};

export type HireRequest = {
  id: string;
  agentId: string;
  agentName: string;
  opportunityId?: string;
  opportunityTitle: string;
  quickJobTitle?: string;
  status: LocalRequestStatus;
  createdAt: string;
};

export type LocalContract = {
  id: string;
  sourceId: string;
  sourceType: "application" | "hire-request";
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

export type LocalActionToastState = {
  id: string;
  message: string;
};

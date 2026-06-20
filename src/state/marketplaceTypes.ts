import type { Agent, AgentAvailability } from "../data/agents";
import type { AccentTone, Opportunity } from "../data/marketplace";
import type { ContractStatus } from "../data/operations";

export type LocalRequestStatus = "pending" | "accepted";

export type SavedOpportunity = {
  opportunityId: string;
  savedAt: string;
};

export type CreatedOpportunity = Opportunity & {
  createdAt: string;
};

export type CreateOpportunityInput = {
  budget: string;
  category: string;
  description: string;
  duration: string;
  organization: string;
  requiredSkills: string[];
  successCriteria: string;
  title: string;
};

export type CreatedAgent = Agent & {
  createdAt: string;
  description: string;
  startingRate: string;
  toolAccess: string[];
};

export type CreateAgentInput = {
  availability: AgentAvailability;
  description: string;
  name: string;
  skills: string[];
  specialty: string;
  startingRate: string;
  toolAccess: string[];
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

export type ContractMilestone = {
  id: string;
  title: string;
  notes: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
};

export type ContractDeliverableStatus =
  | "draft"
  | "submitted"
  | "approved";

export type ContractDeliverable = {
  id: string;
  title: string;
  notes: string;
  status: ContractDeliverableStatus;
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
};

export type ContractActivityItem = {
  id: string;
  message: string;
  createdAt: string;
};

export type ContractWorkspace = {
  contractId: string;
  milestones: ContractMilestone[];
  deliverables: ContractDeliverable[];
  activity: ContractActivityItem[];
  updatedAt: string;
};

export type LocalActionToastState = {
  id: string;
  message: string;
};

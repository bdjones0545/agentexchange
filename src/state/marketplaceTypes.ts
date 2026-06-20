import type { Agent, AgentAvailability } from "../data/agents";
import type { AccentTone, Opportunity } from "../data/marketplace";
import type { ContractStatus } from "../data/operations";

export type LocalRequestStatus = "pending" | "accepted" | "rejected";

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
  agentId?: string;
  agentName?: string;
  rate: string;
  timeline: string;
  milestoneNotes: string;
  counterNote?: string;
  counterRate?: string;
  counterTimeline?: string;
  status: "pending" | "accepted" | "rejected" | "countered";
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
  sourceType: "application" | "hire-request" | "negotiation";
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

export type DeliverableDecisionStatus = "approved" | "rejected";

export type DeliverableDecision = {
  id: string;
  status: DeliverableDecisionStatus;
  note: string;
  decidedAt: string;
};

export type ContractDeliverable = {
  id: string;
  title: string;
  notes: string;
  status: ContractDeliverableStatus;
  decisions: DeliverableDecision[];
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
};

export type ContractMessageSender = "Organization" | "Agent";

export type ContractMessage = {
  id: string;
  senderType: ContractMessageSender;
  author: string;
  body: string;
  createdAt: string;
};

export type ContractActivityEventType =
  | "dispute_opened"
  | "dispute_updated"
  | "deliverable_approved"
  | "deliverable_rejected"
  | "deliverable_submitted"
  | "message_sent"
  | "milestone_completed"
  | "review_added"
  | "status_changed"
  | "workspace";

export type ContractActivityEvent = {
  id: string;
  type: ContractActivityEventType;
  message: string;
  createdAt: string;
};

export type ContractWorkspace = {
  contractId: string;
  milestones: ContractMilestone[];
  deliverables: ContractDeliverable[];
  messages: ContractMessage[];
  activity: ContractActivityEvent[];
  updatedAt: string;
};

export type VerificationStatus =
  | "Unverified"
  | "Verified"
  | "Enterprise Verified"
  | "Top Rated"
  | "Rising Agent";

export type TrustBreakdown = {
  approvalRate: number;
  clientSatisfaction: number;
  deliveryReliability: number;
  disputeRate: number;
  repeatContractRate: number;
  responseSpeed: number;
};

export type AgentReview = {
  id: string;
  agentId?: string;
  agentName: string;
  contractId: string;
  contractTitle: string;
  organization: string;
  rating: number;
  review: string;
  createdAt: string;
};

export type ContractDisputeStatus = "Open" | "Under Review" | "Resolved";

export type ContractDispute = {
  id: string;
  contractId: string;
  reason: string;
  status: ContractDisputeStatus;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentSimulatedStatus =
  | "Available"
  | "Reviewing Opportunity"
  | "Applied"
  | "Negotiating"
  | "Active Contract"
  | "Awaiting Approval"
  | "Completed Work";

export type AgentActivityEvent = {
  id: string;
  agentId: string;
  agentName: string;
  type:
    | "application_submitted"
    | "contract_completed"
    | "deliverable_approved"
    | "deliverable_rejected"
    | "deliverable_submitted"
    | "hire_request_submitted"
    | "negotiation_started"
    | "status_changed";
  message: string;
  createdAt: string;
};

export type LocalActionToastState = {
  id: string;
  message: string;
};

export type AgentExchangePersistedState = {
  agentActivities: AgentActivityEvent[];
  agentReviews: AgentReview[];
  applications: Application[];
  contractWorkspaces: ContractWorkspace[];
  contractDisputes: ContractDispute[];
  createdAgents: CreatedAgent[];
  createdOpportunities: CreatedOpportunity[];
  hireRequests: HireRequest[];
  localContracts: LocalContract[];
  negotiations: Negotiation[];
  savedOpportunities: SavedOpportunity[];
};

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { deriveWorkspaceStatus } from "../data/contractWorkspace";
import { agents } from "../data/agents";
import type { SuggestedAgentAction } from "../data/agentRecommendations";
import { opportunities } from "../data/marketplace";
import {
  loadAgentExchangeState,
  saveAgentExchangeState,
} from "../lib/repositories/activityRepository";
import { createAgent as createAgentRecord } from "../lib/repositories/agentsRepository";
import {
  acceptApplication as acceptApplicationRecord,
  createApplication as createApplicationRecord,
} from "../lib/repositories/applicationsRepository";
import {
  createContract as createContractRecord,
  createDeliverable as createDeliverableRecord,
  createMessage as createMessageRecord,
  createMilestone as createMilestoneRecord,
  updateDeliverable as updateDeliverableRecord,
  updateMilestone as updateMilestoneRecord,
} from "../lib/repositories/contractsRepository";
import { createHireRequest as createHireRequestRecord } from "../lib/repositories/hireRequestsRepository";
import { createNegotiation as createNegotiationRecord } from "../lib/repositories/negotiationsRepository";
import { createOpportunity as createOpportunityRecord } from "../lib/repositories/opportunitiesRepository";
import { isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import type {
  AgentActivityEvent,
  AgentExchangePersistedState,
  Application,
  ContractMessageSender,
  ContractDisputeStatus,
  ContractWorkspace,
  CreateAgentInput,
  CreatedAgent,
  CreatedOpportunity,
  CreateOpportunityInput,
  LocalActionToastState,
  LocalContract,
  Negotiation,
} from "./marketplaceTypes";

type PersistedState = AgentExchangePersistedState;

type SubmitApplicationInput = {
  opportunityId: string;
  opportunityTitle: string;
  agentId: string;
  agentName: string;
  proposal: string;
};

type SubmitNegotiationInput = {
  opportunityId: string;
  opportunityTitle: string;
  agentId?: string;
  agentName?: string;
  rate: string;
  timeline: string;
  milestoneNotes: string;
};

type SubmitHireRequestInput = {
  agentId: string;
  agentName: string;
  opportunityId?: string;
  opportunityTitle: string;
  quickJobTitle?: string;
};

type AgentExchangeContextValue = PersistedState & {
  addContractDeliverable: (
    contractId: string,
    title: string,
    notes: string,
  ) => void;
  addContractMilestone: (
    contractId: string,
    title: string,
    notes: string,
  ) => void;
  addAgentReview: (
    contractId: string,
    agentName: string,
    contractTitle: string,
    organization: string,
    rating: number,
    review: string,
  ) => void;
  toast: LocalActionToastState | null;
  acceptApplication: (applicationId: string) => void;
  acceptHireRequest: (hireRequestId: string) => void;
  acceptNegotiation: (negotiationId: string) => void;
  approveSuggestedAgentAction: (action: SuggestedAgentAction) => void;
  clearToast: () => void;
  createAgent: (input: CreateAgentInput) => Promise<CreatedAgent>;
  createOpportunity: (input: CreateOpportunityInput) => Promise<CreatedOpportunity>;
  getApplicationForOpportunity: (opportunityId: string) => Application | undefined;
  getContractWorkspace: (contractId: string) => ContractWorkspace;
  getNegotiationForOpportunity: (opportunityId: string) => Negotiation | undefined;
  isOpportunitySaved: (opportunityId: string) => boolean;
  openContractDispute: (contractId: string, reason: string) => void;
  rejectApplication: (applicationId: string) => void;
  rejectNegotiation: (negotiationId: string) => void;
  setDeliverableStatus: (
    contractId: string,
    deliverableId: string,
    status: "submitted" | "approved" | "rejected",
    note?: string,
  ) => void;
  sendContractMessage: (
    contractId: string,
    senderType: ContractMessageSender,
    author: string,
    body: string,
  ) => void;
  submitApplication: (input: SubmitApplicationInput) => void;
  submitHireRequest: (input: SubmitHireRequestInput) => void;
  submitNegotiation: (input: SubmitNegotiationInput) => void;
  toggleMilestoneComplete: (contractId: string, milestoneId: string) => void;
  toggleSavedOpportunity: (opportunityId: string) => void;
  updateMilestoneNotes: (
    contractId: string,
    milestoneId: string,
    notes: string,
  ) => void;
  updateContractDispute: (
    contractId: string,
    disputeId: string,
    status: ContractDisputeStatus,
    resolutionNotes?: string,
  ) => void;
  counterNegotiation: (
    negotiationId: string,
    counterRate: string,
    counterTimeline: string,
    counterNote: string,
  ) => void;
  error: string | null;
  loading: boolean;
  saving: boolean;
};

const defaultPersistedState: PersistedState = {
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

const AgentExchangeContext = createContext<AgentExchangeContextValue | null>(
  null,
);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatLocalDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
  });
}

function formatActivityTimestamp() {
  return new Date().toLocaleString("en-US", {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

function createAgentActivity(
  agentId: string,
  agentName: string,
  type: AgentActivityEvent["type"],
  message: string,
): AgentActivityEvent {
  return {
    id: createId("agent-activity"),
    agentId,
    agentName,
    type,
    message,
    createdAt: new Date().toISOString(),
  };
}

function getSimulatedAgentForOpportunity(opportunityId: string) {
  const index = Math.abs(
    opportunityId.split("").reduce((total, character) => {
      return total + character.charCodeAt(0);
    }, 0),
  ) % agents.length;

  return agents[index] ?? agents[0];
}

function getOpportunityForState(
  current: PersistedState,
  opportunityId: string,
) {
  return [...current.createdOpportunities, ...opportunities].find(
    (opportunity) => opportunity.id === opportunityId,
  );
}

function createEmptyWorkspace(contractId: string): ContractWorkspace {
  const createdAt = new Date().toISOString();

  return {
    activity: [
      {
        id: createId("activity"),
        type: "workspace",
        createdAt,
        message: `Workspace opened ${formatActivityTimestamp()}.`,
      },
    ],
    contractId,
    deliverables: [],
    messages: [],
    milestones: [],
    updatedAt: createdAt,
  };
}

function normalizeWorkspace(workspace: ContractWorkspace): ContractWorkspace {
  return {
    ...workspace,
    activity: (workspace.activity ?? []).map((activity) => ({
      ...activity,
      type: activity.type ?? "workspace",
    })),
    deliverables: (workspace.deliverables ?? []).map((deliverable) => ({
      ...deliverable,
      decisions: deliverable.decisions ?? [],
    })),
    messages: workspace.messages ?? [],
    milestones: workspace.milestones ?? [],
  };
}

function withWorkspace(
  current: PersistedState,
  contractId: string,
  updater: (workspace: ContractWorkspace) => ContractWorkspace,
) {
  const existingWorkspace = current.contractWorkspaces.find(
    (workspace) => workspace.contractId === contractId,
  );
  const baseWorkspace = normalizeWorkspace(
    existingWorkspace ?? createEmptyWorkspace(contractId),
  );
  const updatedWorkspace = updater(baseWorkspace);
  const previousStatus = deriveWorkspaceStatus(baseWorkspace);
  const nextStatus = deriveWorkspaceStatus(updatedWorkspace);
  const relatedContract = current.localContracts.find(
    (contract) => contract.id === contractId,
  );
  const relatedApplication =
    relatedContract?.sourceType === "application"
      ? current.applications.find(
          (application) => application.id === relatedContract.sourceId,
        )
      : undefined;
  const relatedHireRequest =
    relatedContract?.sourceType === "hire-request"
      ? current.hireRequests.find(
          (hireRequest) => hireRequest.id === relatedContract.sourceId,
        )
      : undefined;
  const relatedAgentId =
    relatedApplication?.agentId ?? relatedHireRequest?.agentId ?? "";
  const relatedAgentName =
    relatedContract?.agent ??
    relatedApplication?.agentName ??
    relatedHireRequest?.agentName ??
    "";
  const nextWorkspace =
    previousStatus !== nextStatus
      ? {
          ...updatedWorkspace,
          activity: [
            {
              id: createId("activity"),
              type: "status_changed" as const,
              createdAt: new Date().toISOString(),
              message: `Status changed to ${nextStatus}.`,
            },
            ...updatedWorkspace.activity,
          ],
        }
      : updatedWorkspace;
  const nextAgentActivities =
    previousStatus !== nextStatus && relatedAgentId && relatedAgentName
      ? [
          createAgentActivity(
            relatedAgentId,
            relatedAgentName,
            nextStatus === "Completed"
              ? "contract_completed"
              : "status_changed",
            `${relatedAgentName} moved ${relatedContract?.title ?? "a contract"} to ${nextStatus}.`,
          ),
          ...current.agentActivities,
        ]
      : current.agentActivities;

  return {
    ...current,
    agentActivities: nextAgentActivities,
    contractWorkspaces: existingWorkspace
      ? current.contractWorkspaces.map((workspace) =>
          workspace.contractId === contractId ? nextWorkspace : workspace,
        )
      : [...current.contractWorkspaces, nextWorkspace],
  };
}

export function AgentExchangeProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<PersistedState>(defaultPersistedState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<LocalActionToastState | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadAgentExchangeState()
      .then((nextState) => {
        if (!isMounted) {
          return;
        }

        setState({
          ...nextState,
          contractWorkspaces: nextState.contractWorkspaces.map(
            normalizeWorkspace,
          ),
        });
        setError(null);
      })
      .catch(() => {
        if (isMounted) {
          setError("Unable to load AgentExchange data.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    setSaving(true);
    saveAgentExchangeState(state)
      .then(() => setError(null))
      .catch(() => setError("Unable to save AgentExchange data."))
      .finally(() => setSaving(false));
  }, [loading, state]);

  const showToast = useCallback((message: string) => {
    setToast({
      id: createId("toast"),
      message,
    });
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const requireAuthForPersistentWrite = useCallback(
    (action: string) => {
      if (isSupabaseConfigured && !isAuthenticated) {
        showToast(`Sign in required to ${action}.`);
        return false;
      }

      return true;
    },
    [isAuthenticated, showToast],
  );

  const createOpportunity = useCallback(
    async (input: CreateOpportunityInput) => {
      if (!requireAuthForPersistentWrite("create opportunities")) {
        const authRequiredOpportunity: CreatedOpportunity = {
          accent: "violet",
          budget: input.budget,
          cadence: input.duration,
          category: input.category,
          createdAt: new Date().toISOString(),
          id: "auth-required-opportunity",
          matchScore: 0,
          organization: input.organization,
          summary: input.description,
          tags: input.requiredSkills,
          title: input.title,
          trustLevel: "Auth Required",
        };

        return authRequiredOpportunity;
      }

      const createdOpportunity = isSupabaseConfigured
        ? await createOpportunityRecord(input)
        : {
            accent: "violet" as const,
            budget: input.budget,
            cadence: input.duration,
            category: input.category,
            createdAt: new Date().toISOString(),
            duration: input.duration,
            id: createId("opportunity"),
            matchScore: 91,
            organization: input.organization,
            requiredSkills: input.requiredSkills,
            successCriteria: input.successCriteria,
            summary: input.description,
            tags:
              input.requiredSkills.length > 0 ? input.requiredSkills : ["Custom"],
            title: input.title,
            trustLevel: "Local",
          };

      setState((current) => ({
        ...current,
        createdOpportunities: [
          createdOpportunity,
          ...current.createdOpportunities,
        ],
      }));
      showToast("Opportunity created.");

      return createdOpportunity;
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const createAgent = useCallback(
    async (input: CreateAgentInput) => {
      if (!requireAuthForPersistentWrite("create agents")) {
        const authRequiredAgent: CreatedAgent = {
          accent: "violet",
          availability: input.availability,
          avatarInitials: "AI",
          contractHistoryIds: [],
          createdAt: new Date().toISOString(),
          customSkills: input.skills,
          description: input.description,
          id: "auth-required-agent",
          name: input.name,
          revenue: "$0",
          skillIds: [],
          specialty: input.specialty,
          startingRate: input.startingRate,
          successRate: "New",
          tier: "Auth Required",
          toolAccess: input.toolAccess,
          trustScore: 0,
        };

        return authRequiredAgent;
      }

      const createdAgent = isSupabaseConfigured
        ? await createAgentRecord(input)
        : {
            accent: "violet" as const,
            availability: input.availability,
            avatarInitials:
              input.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "AI",
            contractHistoryIds: [],
            createdAt: new Date().toISOString(),
            customSkills: input.skills,
            description: input.description,
            id: createId("agent"),
            name: input.name,
            revenue: "$0",
            skillIds: [],
            specialty: input.specialty,
            startingRate: input.startingRate,
            successRate: "New",
            tier: "Local Agent",
            toolAccess: input.toolAccess,
            trustScore: 90,
          };

      setState((current) => ({
        ...current,
        createdAgents: [createdAgent, ...current.createdAgents],
      }));
      showToast("Agent created.");

      return createdAgent;
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const addContractMilestone = useCallback(
    async (contractId: string, title: string, notes: string) => {
      if (!requireAuthForPersistentWrite("update contracts")) {
        return;
      }

      const now = new Date().toISOString();
      const milestone = {
        id: createId("milestone"),
        completed: false,
        createdAt: now,
        notes,
        title,
      };
      if (isSupabaseConfigured) {
        await createMilestoneRecord(contractId, milestone);
      }

      setState((current) =>
        withWorkspace(current, contractId, (workspace) => {
          return {
            ...workspace,
            activity: [
              {
                id: createId("activity"),
                type: "workspace",
                createdAt: now,
                message: `Milestone added: ${title}.`,
              },
              ...workspace.activity,
            ],
            milestones: [...workspace.milestones, milestone],
            updatedAt: now,
          };
        }),
      );
      showToast("Milestone added.");
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const toggleMilestoneComplete = useCallback(
    async (contractId: string, milestoneId: string) => {
      if (!requireAuthForPersistentWrite("update contracts")) {
        return;
      }

      const workspace = state.contractWorkspaces.find(
        (candidate) => candidate.contractId === contractId,
      );
      const milestone = workspace?.milestones.find(
        (candidate) => candidate.id === milestoneId,
      );
      if (isSupabaseConfigured && milestone) {
        await updateMilestoneRecord(milestoneId, {
          completed: !milestone.completed,
          completedAt: milestone.completed ? undefined : new Date().toISOString(),
        });
      }

      setState((current) =>
        withWorkspace(current, contractId, (workspace) => {
          const now = new Date().toISOString();
          const milestone = workspace.milestones.find(
            (candidate) => candidate.id === milestoneId,
          );

          return {
            ...workspace,
            activity: milestone
              ? [
                  {
                    id: createId("activity"),
                    type: milestone.completed
                      ? "workspace"
                      : "milestone_completed",
                    createdAt: now,
                    message: `${milestone.completed ? "Reopened" : "Completed"} milestone: ${milestone.title}.`,
                  },
                  ...workspace.activity,
                ]
              : workspace.activity,
            milestones: workspace.milestones.map((candidate) =>
              candidate.id === milestoneId
                ? {
                    ...candidate,
                    completed: !candidate.completed,
                    completedAt: candidate.completed ? undefined : now,
                  }
                : candidate,
            ),
            updatedAt: now,
          };
        }),
      );
      showToast("Milestone updated.");
    },
    [requireAuthForPersistentWrite, showToast, state.contractWorkspaces],
  );

  const updateMilestoneNotes = useCallback(
    async (contractId: string, milestoneId: string, notes: string) => {
      if (!requireAuthForPersistentWrite("update contracts")) {
        return;
      }

      if (isSupabaseConfigured) {
        await updateMilestoneRecord(milestoneId, { notes });
      }

      setState((current) =>
        withWorkspace(current, contractId, (workspace) => {
          const now = new Date().toISOString();

          return {
            ...workspace,
            activity: [
              {
                id: createId("activity"),
                type: "workspace",
                createdAt: now,
                message: "Milestone notes updated.",
              },
              ...workspace.activity,
            ],
            milestones: workspace.milestones.map((candidate) =>
              candidate.id === milestoneId
                ? {
                    ...candidate,
                    notes,
                  }
                : candidate,
            ),
            updatedAt: now,
          };
        }),
      );
      showToast("Milestone notes saved.");
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const addContractDeliverable = useCallback(
    async (contractId: string, title: string, notes: string) => {
      if (!requireAuthForPersistentWrite("update contracts")) {
        return;
      }

      const now = new Date().toISOString();
      const deliverable = {
        id: createId("deliverable"),
        createdAt: now,
        decisions: [],
        notes,
        status: "draft" as const,
        title,
      };
      if (isSupabaseConfigured) {
        await createDeliverableRecord(contractId, deliverable);
      }

      setState((current) =>
        withWorkspace(current, contractId, (workspace) => {
          return {
            ...workspace,
            activity: [
              {
                id: createId("activity"),
                type: "workspace",
                createdAt: now,
                message: `Deliverable added: ${title}.`,
              },
              ...workspace.activity,
            ],
            deliverables: [...workspace.deliverables, deliverable],
            updatedAt: now,
          };
        }),
      );
      showToast("Deliverable added.");
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const setDeliverableStatus = useCallback(
    async (
      contractId: string,
      deliverableId: string,
      status: "submitted" | "approved" | "rejected",
      note = "",
    ) => {
      if (!requireAuthForPersistentWrite("update deliverables")) {
        return;
      }

      const workspace = state.contractWorkspaces.find(
        (candidate) => candidate.contractId === contractId,
      );
      const deliverable = workspace?.deliverables.find(
        (candidate) => candidate.id === deliverableId,
      );
      if (isSupabaseConfigured && deliverable) {
        const now = new Date().toISOString();
        await updateDeliverableRecord(deliverableId, {
          approvedAt: status === "approved" ? now : deliverable.approvedAt,
          decisions:
            status === "approved" || status === "rejected"
              ? [
                  ...(deliverable.decisions ?? []),
                  {
                    id: createId("decision"),
                    decidedAt: now,
                    note,
                    status,
                  },
                ]
              : deliverable.decisions,
          status: status === "rejected" ? "draft" : status,
          submittedAt:
            status === "submitted" || status === "approved"
              ? deliverable.submittedAt ?? now
              : deliverable.submittedAt,
        });
      }

      setState((current) =>
        {
          const relatedContract = current.localContracts.find(
            (contract) => contract.id === contractId,
          );
          const relatedApplication =
            relatedContract?.sourceType === "application"
              ? current.applications.find(
                  (application) => application.id === relatedContract.sourceId,
                )
              : undefined;
          const relatedHireRequest =
            relatedContract?.sourceType === "hire-request"
              ? current.hireRequests.find(
                  (hireRequest) => hireRequest.id === relatedContract.sourceId,
                )
              : undefined;
          const relatedAgentId =
            relatedApplication?.agentId ?? relatedHireRequest?.agentId;
          const relatedAgentName =
            relatedContract?.agent ??
            relatedApplication?.agentName ??
            relatedHireRequest?.agentName;

          const nextState = withWorkspace(current, contractId, (workspace) => {
          const now = new Date().toISOString();
          const deliverable = workspace.deliverables.find(
            (candidate) => candidate.id === deliverableId,
          );
          const nextDeliverableStatus =
            status === "rejected" ? "draft" : status;

          return {
            ...workspace,
            activity: deliverable
              ? [
                  {
                    id: createId("activity"),
                    type:
                      status === "approved"
                        ? "deliverable_approved"
                        : status === "rejected"
                          ? "deliverable_rejected"
                          : "deliverable_submitted",
                    createdAt: now,
                    message: `Deliverable ${status}: ${deliverable.title}.`,
                  },
                  ...workspace.activity,
                ]
              : workspace.activity,
            deliverables: workspace.deliverables.map((candidate) =>
              candidate.id === deliverableId
                ? {
                    ...candidate,
                    approvedAt: status === "approved" ? now : candidate.approvedAt,
                    decisions:
                      status === "approved" || status === "rejected"
                        ? [
                            ...(candidate.decisions ?? []),
                            {
                              id: createId("decision"),
                              decidedAt: now,
                              note,
                              status,
                            },
                          ]
                        : (candidate.decisions ?? []),
                    status: nextDeliverableStatus,
                    submittedAt:
                      status === "submitted" || status === "approved"
                        ? candidate.submittedAt ?? now
                        : candidate.submittedAt,
                  }
                : candidate,
            ),
            updatedAt: now,
          };
          });

          if (!relatedAgentId || !relatedAgentName) {
            return nextState;
          }

          const activityType =
            status === "approved"
              ? "deliverable_approved"
              : status === "rejected"
                ? "deliverable_rejected"
                : "deliverable_submitted";

          return {
            ...nextState,
            agentActivities: [
              createAgentActivity(
                relatedAgentId,
                relatedAgentName,
                activityType,
                `${relatedAgentName} ${status} deliverable ${deliverableId}.`,
              ),
              ...nextState.agentActivities,
            ],
          };
        }
      );
      showToast(
        status === "approved"
          ? "Deliverable approved."
          : status === "rejected"
            ? "Deliverable rejected."
            : "Deliverable submitted.",
      );
    },
    [requireAuthForPersistentWrite, showToast, state.contractWorkspaces],
  );

  const sendContractMessage = useCallback(
    async (
      contractId: string,
      senderType: ContractMessageSender,
      author: string,
      body: string,
    ) => {
      if (!requireAuthForPersistentWrite("send messages")) {
        return;
      }

      const now = new Date().toISOString();
      const message = {
        id: createId("message"),
        author,
        body,
        createdAt: now,
        senderType,
      };
      if (isSupabaseConfigured) {
        await createMessageRecord({ ...message, contractId });
      }

      setState((current) =>
        withWorkspace(current, contractId, (workspace) => {
          return {
            ...workspace,
            activity: [
              {
                id: createId("activity"),
                type: "message_sent",
                createdAt: now,
                message: `${senderType} message sent by ${author}.`,
              },
              ...workspace.activity,
            ],
            messages: [...workspace.messages, message],
            updatedAt: now,
          };
        }),
      );
      showToast("Message sent.");
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const addAgentReview = useCallback(
    (
      contractId: string,
      agentName: string,
      contractTitle: string,
      organization: string,
      rating: number,
      review: string,
    ) => {
      if (!requireAuthForPersistentWrite("create reviews")) {
        return;
      }

      setState((current) => {
        const relatedApplication = current.applications.find(
          (application) =>
            current.localContracts.some(
              (contract) =>
                contract.id === contractId &&
                contract.sourceId === application.id &&
                contract.sourceType === "application",
            ),
        );
        const relatedHireRequest = current.hireRequests.find((hireRequest) =>
          current.localContracts.some(
            (contract) =>
              contract.id === contractId &&
              contract.sourceId === hireRequest.id &&
              contract.sourceType === "hire-request",
          ),
        );
        const now = new Date().toISOString();
        const nextState = withWorkspace(current, contractId, (workspace) => ({
          ...workspace,
          activity: [
            {
              id: createId("activity"),
              type: "review_added",
              createdAt: now,
              message: `${organization} left a ${rating}/5 review for ${agentName}.`,
            },
            ...workspace.activity,
          ],
          updatedAt: now,
        }));

        return {
          ...nextState,
          agentReviews: [
            {
              id: createId("review"),
              agentId: relatedApplication?.agentId ?? relatedHireRequest?.agentId,
              agentName,
              contractId,
              contractTitle,
              createdAt: now,
              organization,
              rating,
              review,
            },
            ...nextState.agentReviews,
          ],
        };
      });
      showToast("Review saved.");
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const openContractDispute = useCallback(
    (contractId: string, reason: string) => {
      if (!requireAuthForPersistentWrite("open disputes")) {
        return;
      }

      setState((current) => {
        const now = new Date().toISOString();
        const nextState = withWorkspace(current, contractId, (workspace) => ({
          ...workspace,
          activity: [
            {
              id: createId("activity"),
              type: "dispute_opened",
              createdAt: now,
              message: `Dispute opened: ${reason}.`,
            },
            ...workspace.activity,
          ],
          updatedAt: now,
        }));

        return {
          ...nextState,
          contractDisputes: [
            {
              id: createId("dispute"),
              contractId,
              createdAt: now,
              reason,
              status: "Open",
              updatedAt: now,
            },
            ...nextState.contractDisputes,
          ],
        };
      });
      showToast("Dispute opened.");
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const updateContractDispute = useCallback(
    (
      contractId: string,
      disputeId: string,
      status: ContractDisputeStatus,
      resolutionNotes = "",
    ) => {
      if (!requireAuthForPersistentWrite("update disputes")) {
        return;
      }

      setState((current) => {
        const now = new Date().toISOString();
        const nextState = withWorkspace(current, contractId, (workspace) => ({
          ...workspace,
          activity: [
            {
              id: createId("activity"),
              type: "dispute_updated",
              createdAt: now,
              message: `Dispute moved to ${status}.`,
            },
            ...workspace.activity,
          ],
          updatedAt: now,
        }));

        return {
          ...nextState,
          contractDisputes: nextState.contractDisputes.map((dispute) =>
            dispute.id === disputeId
              ? {
                  ...dispute,
                  resolutionNotes:
                    resolutionNotes || dispute.resolutionNotes,
                  status,
                  updatedAt: now,
                }
              : dispute,
          ),
        };
      });
      showToast("Dispute updated.");
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const toggleSavedOpportunity = useCallback(
    (opportunityId: string) => {
      setState((current) => {
        const isSaved = current.savedOpportunities.some(
          (savedOpportunity) => savedOpportunity.opportunityId === opportunityId,
        );

        if (isSaved) {
          showToast("Opportunity removed from saved items.");
          return {
            ...current,
            savedOpportunities: current.savedOpportunities.filter(
              (savedOpportunity) =>
                savedOpportunity.opportunityId !== opportunityId,
            ),
          };
        }

        showToast("Opportunity saved.");
        return {
          ...current,
          savedOpportunities: [
            ...current.savedOpportunities,
            {
              opportunityId,
              savedAt: new Date().toISOString(),
            },
          ],
        };
      });
    },
    [showToast],
  );

  const submitApplication = useCallback(
    async (input: SubmitApplicationInput) => {
      if (!requireAuthForPersistentWrite("apply to opportunities")) {
        return;
      }

      const existingApplication = state.applications.find(
        (application) => application.opportunityId === input.opportunityId,
      );
      const draftApplication: Application = {
        id: existingApplication?.id ?? createId("application"),
        createdAt: existingApplication?.createdAt ?? new Date().toISOString(),
        status: "pending",
        ...input,
      };
      const nextApplication = isSupabaseConfigured
        ? await createApplicationRecord(draftApplication)
        : draftApplication;

      setState((current) => {
        return {
          ...current,
          agentActivities: [
            createAgentActivity(
              input.agentId,
              input.agentName,
              "application_submitted",
              `${input.agentName} applied to ${input.opportunityTitle}.`,
            ),
            ...current.agentActivities,
          ],
          applications: existingApplication
            ? current.applications.map((application) =>
                application.id === existingApplication.id
                  ? nextApplication
                  : application,
              )
            : [...current.applications, nextApplication],
        };
      });
      showToast("Application submitted.");
    },
    [requireAuthForPersistentWrite, showToast, state.applications],
  );

  const submitNegotiation = useCallback(
    async (input: SubmitNegotiationInput) => {
      if (!requireAuthForPersistentWrite("negotiate opportunities")) {
        return;
      }

      const simulatedAgent = getSimulatedAgentForOpportunity(input.opportunityId);
      const existingNegotiation = state.negotiations.find(
        (negotiation) => negotiation.opportunityId === input.opportunityId,
      );
      const draftNegotiation: Negotiation = {
        id: existingNegotiation?.id ?? createId("negotiation"),
        createdAt: existingNegotiation?.createdAt ?? new Date().toISOString(),
        status: "pending",
        ...input,
        agentId: existingNegotiation?.agentId ?? input.agentId ?? simulatedAgent?.id,
        agentName:
          existingNegotiation?.agentName ?? input.agentName ?? simulatedAgent?.name,
      };
      const nextNegotiation = isSupabaseConfigured
        ? await createNegotiationRecord(draftNegotiation)
        : draftNegotiation;

      setState((current) => {
        return {
          ...current,
          agentActivities: simulatedAgent
            ? [
                createAgentActivity(
                  simulatedAgent.id,
                  simulatedAgent.name,
                  "negotiation_started",
                  `${simulatedAgent.name} entered negotiation for ${input.opportunityTitle}.`,
                ),
                ...current.agentActivities,
              ]
            : current.agentActivities,
          negotiations: existingNegotiation
            ? current.negotiations.map((negotiation) =>
                negotiation.id === existingNegotiation.id
                  ? nextNegotiation
                  : negotiation,
              )
            : [...current.negotiations, nextNegotiation],
        };
      });
      showToast("Negotiation submitted.");
    },
    [requireAuthForPersistentWrite, showToast, state.negotiations],
  );

  const submitHireRequest = useCallback(
    async (input: SubmitHireRequestInput) => {
      if (!requireAuthForPersistentWrite("hire agents")) {
        return;
      }

      const draftHireRequest = {
        id: createId("hire"),
        createdAt: new Date().toISOString(),
        status: "pending" as const,
        ...input,
      };
      const nextHireRequest = isSupabaseConfigured
        ? await createHireRequestRecord(draftHireRequest)
        : draftHireRequest;

      setState((current) => ({
        ...current,
        agentActivities: [
          createAgentActivity(
            input.agentId,
            input.agentName,
            "hire_request_submitted",
            `${input.agentName} received a hire request for ${input.opportunityTitle}.`,
          ),
          ...current.agentActivities,
        ],
        hireRequests: [
          ...current.hireRequests,
          nextHireRequest,
        ],
      }));
      showToast("Hire request submitted.");
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const acceptApplication = useCallback(
    async (applicationId: string) => {
      if (!requireAuthForPersistentWrite("accept applications")) {
        return;
      }

      const application = state.applications.find(
        (candidate) => candidate.id === applicationId,
      );

      if (
        !application ||
        application.status !== "pending" ||
        state.localContracts.some(
          (contract) =>
            contract.sourceType === "application" &&
            contract.sourceId === application.id,
        )
      ) {
        return;
      }

      const opportunity = getOpportunityForState(
        state,
        application.opportunityId,
      );
      const draftContract: LocalContract = {
        id: createId("contract"),
        sourceId: application.id,
        sourceType: "application",
        organizationId:
          opportunity?.organizationId ??
          opportunity?.organization?.toLowerCase().replace(/\s+/g, "-") ??
          "local-organization",
        organization: opportunity?.organization ?? "Local Organization",
        agentId: application.agentId,
        agent: application.agentName,
        title: application.opportunityTitle,
        value: opportunity?.budget ?? "Custom scope",
        status: "Active",
        startDate: formatLocalDate(),
        dueDate: formatLocalDate(21),
        progress: 8,
        accent: "violet",
      };
      const localContract = isSupabaseConfigured
        ? await createContractRecord(draftContract)
        : draftContract;
      if (isSupabaseConfigured) {
        await acceptApplicationRecord(application.id);
      }

      setState((current) => {
        const currentApplication = current.applications.find(
          (candidate) => candidate.id === applicationId,
        );

        if (
          !currentApplication ||
          currentApplication.status !== "pending" ||
          current.localContracts.some(
            (contract) =>
              contract.sourceType === "application" &&
              contract.sourceId === currentApplication.id,
          )
        ) {
          return current;
        }

        return {
          ...current,
          applications: current.applications.map((candidate) =>
            candidate.id === applicationId
              ? {
                  ...candidate,
                  status: "accepted",
                }
              : candidate,
          ),
          localContracts: [...current.localContracts, localContract],
        };
      });
      showToast("Application accepted and contract created.");
    },
    [requireAuthForPersistentWrite, showToast, state],
  );

  const rejectApplication = useCallback(
    (applicationId: string) => {
      if (!requireAuthForPersistentWrite("reject applications")) {
        return;
      }

      setState((current) => {
        const application = current.applications.find(
          (candidate) => candidate.id === applicationId,
        );

        if (!application || application.status !== "pending") {
          return current;
        }

        return {
          ...current,
          agentActivities: [
            createAgentActivity(
              application.agentId,
              application.agentName,
              "status_changed",
              `${application.agentName}'s application to ${application.opportunityTitle} was rejected.`,
            ),
            ...current.agentActivities,
          ],
          applications: current.applications.map((candidate) =>
            candidate.id === applicationId
              ? {
                  ...candidate,
                  status: "rejected",
                }
              : candidate,
          ),
        };
      });
      showToast("Application rejected.");
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const acceptNegotiation = useCallback(
    async (negotiationId: string) => {
      if (!requireAuthForPersistentWrite("accept negotiations")) {
        return;
      }

      const negotiation = state.negotiations.find(
        (candidate) => candidate.id === negotiationId,
      );

      if (
        !negotiation ||
        (negotiation.status !== "pending" && negotiation.status !== "countered") ||
        state.localContracts.some(
          (contract) =>
            contract.sourceType === "negotiation" &&
            contract.sourceId === negotiation.id,
        )
      ) {
        return;
      }

      const opportunity = getOpportunityForState(state, negotiation.opportunityId);
      const agent =
        negotiation.agentId && negotiation.agentName
          ? {
              id: negotiation.agentId,
              name: negotiation.agentName,
            }
          : getSimulatedAgentForOpportunity(negotiation.opportunityId);
      const draftContract: LocalContract = {
        id: createId("contract"),
        sourceId: negotiation.id,
        sourceType: "negotiation",
        organizationId:
          opportunity?.organizationId ??
          opportunity?.organization?.toLowerCase().replace(/\s+/g, "-") ??
          "local-organization",
        organization: opportunity?.organization ?? "Local Organization",
        agentId: agent?.id,
        agent: agent?.name ?? "Recommended Agent",
        title: negotiation.opportunityTitle,
        value: negotiation.counterRate ?? negotiation.rate,
        status: "Active",
        startDate: formatLocalDate(),
        dueDate: formatLocalDate(21),
        progress: 5,
        accent: "violet",
      };
      const localContract = isSupabaseConfigured
        ? await createContractRecord(draftContract)
        : draftContract;

      setState((current) => {
        return {
          ...current,
          agentActivities: agent
            ? [
                createAgentActivity(
                  agent.id,
                  agent.name,
                  "status_changed",
                  `${agent.name}'s negotiation for ${negotiation.opportunityTitle} was accepted.`,
                ),
                ...current.agentActivities,
              ]
            : current.agentActivities,
          localContracts: [...current.localContracts, localContract],
          negotiations: current.negotiations.map((candidate) =>
            candidate.id === negotiationId
              ? {
                  ...candidate,
                  status: "accepted",
                }
              : candidate,
          ),
        };
      });
      showToast("Negotiation accepted and contract created.");
    },
    [requireAuthForPersistentWrite, showToast, state],
  );

  const rejectNegotiation = useCallback(
    (negotiationId: string) => {
      if (!requireAuthForPersistentWrite("reject negotiations")) {
        return;
      }

      setState((current) => ({
        ...current,
        negotiations: current.negotiations.map((candidate) =>
          candidate.id === negotiationId
            ? {
                ...candidate,
                status: "rejected",
              }
            : candidate,
        ),
      }));
      showToast("Negotiation rejected.");
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const counterNegotiation = useCallback(
    (
      negotiationId: string,
      counterRate: string,
      counterTimeline: string,
      counterNote: string,
    ) => {
      if (!requireAuthForPersistentWrite("counter negotiations")) {
        return;
      }

      setState((current) => ({
        ...current,
        negotiations: current.negotiations.map((candidate) =>
          candidate.id === negotiationId
            ? {
                ...candidate,
                counterNote,
                counterRate,
                counterTimeline,
                status: "countered",
              }
            : candidate,
        ),
      }));
      showToast("Counter negotiation saved.");
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const acceptHireRequest = useCallback(
    async (hireRequestId: string) => {
      if (!requireAuthForPersistentWrite("accept hire requests")) {
        return;
      }

      const hireRequest = state.hireRequests.find(
        (candidate) => candidate.id === hireRequestId,
      );

      if (
        !hireRequest ||
        hireRequest.status !== "pending" ||
        state.localContracts.some(
          (contract) =>
            contract.sourceType === "hire-request" &&
            contract.sourceId === hireRequest.id,
        )
      ) {
        return;
      }

      const opportunity = hireRequest.opportunityId
        ? getOpportunityForState(state, hireRequest.opportunityId)
        : undefined;
      const draftContract: LocalContract = {
        id: createId("contract"),
        sourceId: hireRequest.id,
        sourceType: "hire-request",
        organizationId:
          opportunity?.organizationId ??
          opportunity?.organization?.toLowerCase().replace(/\s+/g, "-") ??
          "local-organization",
        organization: opportunity?.organization ?? "Local Organization",
        agentId: hireRequest.agentId,
        agent: hireRequest.agentName,
        title: hireRequest.quickJobTitle || hireRequest.opportunityTitle,
        value: opportunity?.budget ?? "Custom scope",
        status: "Active",
        startDate: formatLocalDate(),
        dueDate: formatLocalDate(14),
        progress: 5,
        accent: "emerald",
      };
      const localContract = isSupabaseConfigured
        ? await createContractRecord(draftContract)
        : draftContract;

      setState((current) => {
        return {
          ...current,
          hireRequests: current.hireRequests.map((candidate) =>
            candidate.id === hireRequestId
              ? {
                  ...candidate,
                  status: "accepted",
                }
              : candidate,
          ),
          localContracts: [...current.localContracts, localContract],
        };
      });
      showToast("Hire request accepted and contract created.");
    },
    [requireAuthForPersistentWrite, showToast, state],
  );

  const approveSuggestedAgentAction = useCallback(
    (action: SuggestedAgentAction) => {
      if (!requireAuthForPersistentWrite("approve suggested actions")) {
        return;
      }

      if (action.type === "apply_to_opportunity" && action.opportunityId) {
        submitApplication({
          agentId: action.agentId,
          agentName: action.agentName,
          opportunityId: action.opportunityId,
          opportunityTitle: action.opportunityTitle ?? "Recommended opportunity",
          proposal:
            "Autonomous recommendation approved locally. This agent is a strong fit based on skills, availability, and trust score.",
        });
        return;
      }

      if (action.type === "start_negotiation" && action.opportunityId) {
        submitNegotiation({
          agentId: action.agentId,
          agentName: action.agentName,
          opportunityId: action.opportunityId,
          opportunityTitle: action.opportunityTitle ?? "Recommended opportunity",
          rate: "Recommended premium rate",
          timeline: "Recommended timeline",
          milestoneNotes:
            "Autonomous recommendation approved locally. Start negotiation with milestone-based delivery.",
        });
        return;
      }

      if (action.type === "send_follow_up" && action.contractId) {
        sendContractMessage(
          action.contractId,
          "Agent",
          action.agentName,
          "Following up on the submitted deliverable and pending approval.",
        );
        return;
      }

      if (action.type === "submit_deliverable" && action.contractId) {
        setState((current) => {
          const nextState = withWorkspace(
            current,
            action.contractId ?? "",
            (workspace) => {
              const now = new Date().toISOString();
              const title = `Autonomous progress update - ${action.contractTitle ?? "Contract"}`;

              return {
                ...workspace,
                activity: [
                  {
                    id: createId("activity"),
                    type: "deliverable_submitted",
                    createdAt: now,
                    message: `Deliverable submitted: ${title}.`,
                  },
                  ...workspace.activity,
                ],
                deliverables: [
                  ...workspace.deliverables,
                  {
                    id: createId("deliverable"),
                    approvedAt: undefined,
                    createdAt: now,
                    decisions: [],
                    notes:
                      "Placeholder deliverable submitted from an approved autonomous suggestion.",
                    status: "submitted",
                    submittedAt: now,
                    title,
                  },
                ],
                updatedAt: now,
              };
            },
          );

          return {
            ...nextState,
            agentActivities: [
              createAgentActivity(
                action.agentId,
                action.agentName,
                "deliverable_submitted",
                `${action.agentName} submitted a deliverable for ${action.contractTitle ?? "a contract"}.`,
              ),
              ...nextState.agentActivities,
            ],
          };
        });
        showToast("Suggested deliverable submitted.");
        return;
      }

      if (
        action.type === "complete_milestone" &&
        action.contractId &&
        action.milestoneId
      ) {
        toggleMilestoneComplete(action.contractId, action.milestoneId);
        return;
      }

      showToast("Suggested action recorded.");
    },
    [
      sendContractMessage,
      showToast,
      submitApplication,
      submitNegotiation,
      toggleMilestoneComplete,
      requireAuthForPersistentWrite,
    ],
  );

  const value = useMemo<AgentExchangeContextValue>(
    () => ({
      ...state,
      error,
      loading,
      saving,
      toast,
      acceptApplication,
      acceptHireRequest,
      acceptNegotiation,
      addAgentReview,
      approveSuggestedAgentAction,
      addContractDeliverable,
      addContractMilestone,
      clearToast,
      counterNegotiation,
      createAgent,
      createOpportunity,
      getApplicationForOpportunity: (opportunityId) =>
        state.applications.find(
          (application) => application.opportunityId === opportunityId,
        ),
      getContractWorkspace: (contractId) =>
        state.contractWorkspaces.find(
          (workspace) => workspace.contractId === contractId,
        ) ?? createEmptyWorkspace(contractId),
      getNegotiationForOpportunity: (opportunityId) =>
        state.negotiations.find(
          (negotiation) => negotiation.opportunityId === opportunityId,
        ),
      isOpportunitySaved: (opportunityId) =>
        state.savedOpportunities.some(
          (savedOpportunity) => savedOpportunity.opportunityId === opportunityId,
        ),
      openContractDispute,
      rejectApplication,
      rejectNegotiation,
      sendContractMessage,
      setDeliverableStatus,
      submitApplication,
      submitHireRequest,
      submitNegotiation,
      toggleMilestoneComplete,
      toggleSavedOpportunity,
      updateContractDispute,
      updateMilestoneNotes,
    }),
    [
      acceptApplication,
      acceptHireRequest,
      acceptNegotiation,
      addAgentReview,
      approveSuggestedAgentAction,
      addContractDeliverable,
      addContractMilestone,
      clearToast,
      counterNegotiation,
      createAgent,
      createOpportunity,
      error,
      loading,
      openContractDispute,
      rejectApplication,
      rejectNegotiation,
      saving,
      sendContractMessage,
      setDeliverableStatus,
      state,
      submitApplication,
      submitHireRequest,
      submitNegotiation,
      toast,
      toggleMilestoneComplete,
      toggleSavedOpportunity,
      updateContractDispute,
      updateMilestoneNotes,
    ],
  );

  return (
    <AgentExchangeContext.Provider value={value}>
      {children}
    </AgentExchangeContext.Provider>
  );
}

export function useAgentExchange() {
  const context = useContext(AgentExchangeContext);

  if (!context) {
    throw new Error("useAgentExchange must be used within AgentExchangeProvider");
  }

  return context;
}

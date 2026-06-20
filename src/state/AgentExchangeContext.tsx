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
import type {
  AgentActivityEvent,
  Application,
  ContractMessageSender,
  ContractWorkspace,
  CreateAgentInput,
  CreatedAgent,
  CreatedOpportunity,
  CreateOpportunityInput,
  HireRequest,
  LocalActionToastState,
  LocalContract,
  Negotiation,
  SavedOpportunity,
} from "./marketplaceTypes";

const STORAGE_KEY = "agentexchange-local-mvp";

type PersistedState = {
  agentActivities: AgentActivityEvent[];
  applications: Application[];
  contractWorkspaces: ContractWorkspace[];
  createdAgents: CreatedAgent[];
  createdOpportunities: CreatedOpportunity[];
  hireRequests: HireRequest[];
  localContracts: LocalContract[];
  negotiations: Negotiation[];
  savedOpportunities: SavedOpportunity[];
};

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
  toast: LocalActionToastState | null;
  acceptApplication: (applicationId: string) => void;
  acceptHireRequest: (hireRequestId: string) => void;
  clearToast: () => void;
  createAgent: (input: CreateAgentInput) => CreatedAgent;
  createOpportunity: (input: CreateOpportunityInput) => CreatedOpportunity;
  getApplicationForOpportunity: (opportunityId: string) => Application | undefined;
  getContractWorkspace: (contractId: string) => ContractWorkspace;
  getNegotiationForOpportunity: (opportunityId: string) => Negotiation | undefined;
  isOpportunitySaved: (opportunityId: string) => boolean;
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
};

const defaultPersistedState: PersistedState = {
  agentActivities: [],
  applications: [],
  contractWorkspaces: [],
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

function safeParseState(rawValue: string | null): PersistedState {
  if (!rawValue) {
    return defaultPersistedState;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedState>;

    return {
      agentActivities: parsed.agentActivities ?? [],
      applications: parsed.applications ?? [],
      contractWorkspaces: (parsed.contractWorkspaces ?? []).map(
        normalizeWorkspace,
      ),
      createdAgents: parsed.createdAgents ?? [],
      createdOpportunities: parsed.createdOpportunities ?? [],
      hireRequests: parsed.hireRequests ?? [],
      localContracts: parsed.localContracts ?? [],
      negotiations: parsed.negotiations ?? [],
      savedOpportunities: parsed.savedOpportunities ?? [],
    };
  } catch {
    return defaultPersistedState;
  }
}

export function AgentExchangeProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<PersistedState>(() => {
    if (typeof window === "undefined") {
      return defaultPersistedState;
    }

    return safeParseState(window.localStorage.getItem(STORAGE_KEY));
  });
  const [toast, setToast] = useState<LocalActionToastState | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const showToast = useCallback((message: string) => {
    setToast({
      id: createId("toast"),
      message,
    });
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const createOpportunity = useCallback(
    (input: CreateOpportunityInput) => {
      const createdOpportunity: CreatedOpportunity = {
        accent: "violet",
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
        tags: input.requiredSkills.length > 0 ? input.requiredSkills : ["Custom"],
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
    [showToast],
  );

  const createAgent = useCallback(
    (input: CreateAgentInput) => {
      const initials = input.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      const createdAgent: CreatedAgent = {
        accent: "violet",
        availability: input.availability,
        avatarInitials: initials || "AI",
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
    [showToast],
  );

  const addContractMilestone = useCallback(
    (contractId: string, title: string, notes: string) => {
      setState((current) =>
        withWorkspace(current, contractId, (workspace) => {
          const now = new Date().toISOString();
          const milestone = {
            id: createId("milestone"),
            completed: false,
            createdAt: now,
            notes,
            title,
          };

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
    [showToast],
  );

  const toggleMilestoneComplete = useCallback(
    (contractId: string, milestoneId: string) => {
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
    [showToast],
  );

  const updateMilestoneNotes = useCallback(
    (contractId: string, milestoneId: string, notes: string) => {
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
    [showToast],
  );

  const addContractDeliverable = useCallback(
    (contractId: string, title: string, notes: string) => {
      setState((current) =>
        withWorkspace(current, contractId, (workspace) => {
          const now = new Date().toISOString();
          const deliverable = {
            id: createId("deliverable"),
            createdAt: now,
            decisions: [],
            notes,
            status: "draft" as const,
            title,
          };

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
    [showToast],
  );

  const setDeliverableStatus = useCallback(
    (
      contractId: string,
      deliverableId: string,
      status: "submitted" | "approved" | "rejected",
      note = "",
    ) => {
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
    [showToast],
  );

  const sendContractMessage = useCallback(
    (
      contractId: string,
      senderType: ContractMessageSender,
      author: string,
      body: string,
    ) => {
      setState((current) =>
        withWorkspace(current, contractId, (workspace) => {
          const now = new Date().toISOString();
          const message = {
            id: createId("message"),
            author,
            body,
            createdAt: now,
            senderType,
          };

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
    [showToast],
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
    (input: SubmitApplicationInput) => {
      setState((current) => {
        const existingApplication = current.applications.find(
          (application) => application.opportunityId === input.opportunityId,
        );
        const nextApplication: Application = {
          id: existingApplication?.id ?? createId("application"),
          createdAt: existingApplication?.createdAt ?? new Date().toISOString(),
          status: "pending",
          ...input,
        };

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
    [showToast],
  );

  const submitNegotiation = useCallback(
    (input: SubmitNegotiationInput) => {
      setState((current) => {
        const simulatedAgent = getSimulatedAgentForOpportunity(input.opportunityId);
        const existingNegotiation = current.negotiations.find(
          (negotiation) => negotiation.opportunityId === input.opportunityId,
        );
        const nextNegotiation: Negotiation = {
          id: existingNegotiation?.id ?? createId("negotiation"),
          createdAt: existingNegotiation?.createdAt ?? new Date().toISOString(),
          status: "pending",
          ...input,
          agentId: existingNegotiation?.agentId ?? simulatedAgent?.id,
          agentName: existingNegotiation?.agentName ?? simulatedAgent?.name,
        };

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
    [showToast],
  );

  const submitHireRequest = useCallback(
    (input: SubmitHireRequestInput) => {
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
          {
            id: createId("hire"),
            createdAt: new Date().toISOString(),
            status: "pending",
            ...input,
          },
        ],
      }));
      showToast("Hire request submitted.");
    },
    [showToast],
  );

  const acceptApplication = useCallback(
    (applicationId: string) => {
      setState((current) => {
        const application = current.applications.find(
          (candidate) => candidate.id === applicationId,
        );

        if (!application || application.status === "accepted") {
          return current;
        }

        const localContract: LocalContract = {
          id: createId("contract"),
          sourceId: application.id,
          sourceType: "application",
          organizationId: "local-organization",
          organization: "Local Organization",
          agent: application.agentName,
          title: application.opportunityTitle,
          value: "Custom scope",
          status: "Active",
          startDate: formatLocalDate(),
          dueDate: formatLocalDate(21),
          progress: 8,
          accent: "violet",
        };

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
    [showToast],
  );

  const acceptHireRequest = useCallback(
    (hireRequestId: string) => {
      setState((current) => {
        const hireRequest = current.hireRequests.find(
          (candidate) => candidate.id === hireRequestId,
        );

        if (!hireRequest || hireRequest.status === "accepted") {
          return current;
        }

        const localContract: LocalContract = {
          id: createId("contract"),
          sourceId: hireRequest.id,
          sourceType: "hire-request",
          organizationId: "local-organization",
          organization: "Local Organization",
          agent: hireRequest.agentName,
          title: hireRequest.quickJobTitle || hireRequest.opportunityTitle,
          value: "Custom scope",
          status: "Active",
          startDate: formatLocalDate(),
          dueDate: formatLocalDate(14),
          progress: 5,
          accent: "emerald",
        };

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
    [showToast],
  );

  const value = useMemo<AgentExchangeContextValue>(
    () => ({
      ...state,
      toast,
      acceptApplication,
      acceptHireRequest,
      addContractDeliverable,
      addContractMilestone,
      clearToast,
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
      sendContractMessage,
      setDeliverableStatus,
      submitApplication,
      submitHireRequest,
      submitNegotiation,
      toggleMilestoneComplete,
      toggleSavedOpportunity,
      updateMilestoneNotes,
    }),
    [
      acceptApplication,
      acceptHireRequest,
      addContractDeliverable,
      addContractMilestone,
      clearToast,
      createAgent,
      createOpportunity,
      sendContractMessage,
      setDeliverableStatus,
      state,
      submitApplication,
      submitHireRequest,
      submitNegotiation,
      toast,
      toggleMilestoneComplete,
      toggleSavedOpportunity,
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

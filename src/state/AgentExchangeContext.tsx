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
  createActivityEvent,
  loadAgentExchangeState,
  saveAgentExchangeState,
} from "../lib/repositories/activityRepository";
import { createAgent as createAgentRecord } from "../lib/repositories/agentsRepository";
import {
  acceptApplication as acceptApplicationRecord,
  createApplication as createApplicationRecord,
  updateApplicationStatus as updateApplicationStatusRecord,
} from "../lib/repositories/applicationsRepository";
import {
  createContract as createContractRecord,
  createDeliverable as createDeliverableRecord,
  createMessage as createMessageRecord,
  createMilestone as createMilestoneRecord,
  updateDeliverable as updateDeliverableRecord,
  updateMilestone as updateMilestoneRecord,
} from "../lib/repositories/contractsRepository";
import {
  createDispute as createDisputeRecord,
  updateDispute as updateDisputeRecord,
} from "../lib/repositories/disputesRepository";
import {
  acceptHireRequest as acceptHireRequestRecord,
  createHireRequest as createHireRequestRecord,
  materializeHireRequestContract,
} from "../lib/repositories/hireRequestsRepository";
import {
  createNegotiation as createNegotiationRecord,
  updateNegotiation as updateNegotiationRecord,
} from "../lib/repositories/negotiationsRepository";
import { createOpportunity as createOpportunityRecord } from "../lib/repositories/opportunitiesRepository";
import { createReview as createReviewRecord } from "../lib/repositories/reviewsRepository";
import {
  saveOpportunity as saveOpportunityRecord,
  unsaveOpportunity as unsaveOpportunityRecord,
} from "../lib/repositories/savedOpportunitiesRepository";
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
  HireRequest,
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
  /**
   * The signed-in user's profile id in Supabase mode, null otherwise. Used
   * only to decide which actions to SHOW; the database decides what is
   * allowed.
   */
  currentProfileId: string | null;
  /** True when the marketplace is shared through Supabase (two-sided). */
  isSharedMode: boolean;
  /** Re-reads the marketplace so the other party's actions become visible. */
  refresh: () => Promise<void>;
  /** Organization side of the opportunity this application targets. */
  canManageApplication: (application: Application) => boolean;
  /** Organization side of the opportunity this negotiation targets. */
  canManageNegotiation: (negotiation: Negotiation) => boolean;
  /** Owner of the agent that was asked to take the job. */
  canAcceptHireRequest: (hireRequest: HireRequest) => boolean;
  /** Owner of the given agent (always true in demo mode). */
  ownsAgent: (agentId: string | undefined) => boolean;
  /** Poster of the given opportunity (always true in demo mode). */
  ownsOpportunity: (opportunityId: string | undefined) => boolean;
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

function isUuid(value: string | undefined) {
  return Boolean(
    value?.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ),
  );
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
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [state, setState] = useState<PersistedState>(defaultPersistedState);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<LocalActionToastState | null>(null);
  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    const nextState = await loadAgentExchangeState();
    setState({
      ...nextState,
      contractWorkspaces: nextState.contractWorkspaces.map(normalizeWorkspace),
    });
    setCurrentProfileId(nextState.currentProfileId);
  }, []);

  // Initial load, and a reload whenever the signed-in user changes: in
  // Supabase mode the visible marketplace is scoped by RLS to that user.
  useEffect(() => {
    if (authLoading) {
      return;
    }

    let isMounted = true;

    refresh()
      .then(() => {
        if (isMounted) {
          setError(null);
        }
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
  }, [authLoading, refresh, userId]);

  // In shared mode the other party acts in another browser, so re-read on
  // focus and on a slow interval. Demo mode has nothing to sync.
  useEffect(() => {
    if (!isSupabaseConfigured || loading) {
      return;
    }

    const quietRefresh = () => {
      void refresh().catch(() => undefined);
    };
    const interval = window.setInterval(quietRefresh, 30_000);
    window.addEventListener("focus", quietRefresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", quietRefresh);
    };
  }, [loading, refresh]);

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

  const reportError = useCallback(
    (thrown: unknown) => {
      const message =
        thrown instanceof Error ? thrown.message : "Something went wrong.";
      setError(message);
      showToast(message);
    },
    [showToast],
  );

  /**
   * In shared mode only real (UUID) rows can take part in a lifecycle. Seed
   * listings exist for browsing and are refused with a clear message instead
   * of failing inside Postgres with a uuid cast error.
   */
  const requireRealRecord = useCallback(
    (id: string | undefined, what: string) => {
      if (!isSupabaseConfigured) {
        return true;
      }

      if (!isUuid(id)) {
        showToast(`${what} is a demo listing. Create a real one to use it.`);
        return false;
      }

      return true;
    },
    [showToast],
  );

  /** Persists an agent timeline event in shared mode; in-memory otherwise. */
  const recordAgentActivity = useCallback((event: AgentActivityEvent) => {
    if (isSupabaseConfigured) {
      void createActivityEvent(event).catch(() => undefined);
    }
    return event;
  }, []);

  const ownsAgent = useCallback(
    (agentId: string | undefined) => {
      if (!isSupabaseConfigured) {
        return true;
      }
      if (!agentId || !currentProfileId) {
        return false;
      }
      return state.createdAgents.some(
        (agent) => agent.id === agentId && agent.ownerId === currentProfileId,
      );
    },
    [currentProfileId, state.createdAgents],
  );

  const ownsOpportunity = useCallback(
    (opportunityId: string | undefined) => {
      if (!isSupabaseConfigured) {
        return true;
      }
      if (!opportunityId || !currentProfileId) {
        return false;
      }
      return state.createdOpportunities.some(
        (opportunity) =>
          opportunity.id === opportunityId &&
          opportunity.ownerId === currentProfileId,
      );
    },
    [currentProfileId, state.createdOpportunities],
  );

  const canManageApplication = useCallback(
    (application: Application) => ownsOpportunity(application.opportunityId),
    [ownsOpportunity],
  );

  const canManageNegotiation = useCallback(
    (negotiation: Negotiation) => ownsOpportunity(negotiation.opportunityId),
    [ownsOpportunity],
  );

  const canAcceptHireRequest = useCallback(
    (hireRequest: HireRequest) => ownsAgent(hireRequest.agentId),
    [ownsAgent],
  );

  /** After a shared-mode write, converge on what the database now holds. */
  const settle = useCallback(() => {
    if (isSupabaseConfigured) {
      void refresh().catch(() => undefined);
    }
  }, [refresh]);

  const requireAuthForPersistentWrite = useCallback(
    (action: string) => {
      if (isSupabaseConfigured && !isAuthenticated) {
        const redirectTo = `${window.location.pathname}${window.location.search}`;
        setError(`Sign in required to ${action}.`);
        showToast(`Sign in required to ${action}.`);
        window.setTimeout(() => {
          window.location.assign(
            `/sign-in?redirect=${encodeURIComponent(redirectTo)}`,
          );
        }, 600);
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
      const persistedMilestone =
        isSupabaseConfigured && isUuid(contractId)
          ? await createMilestoneRecord(contractId, milestone)
          : milestone;

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
            milestones: [...workspace.milestones, persistedMilestone],
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
      if (isSupabaseConfigured && milestone && isUuid(milestoneId)) {
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

      if (isSupabaseConfigured && isUuid(milestoneId)) {
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
      const persistedDeliverable =
        isSupabaseConfigured && isUuid(contractId)
          ? await createDeliverableRecord(contractId, deliverable)
          : deliverable;

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
            deliverables: [...workspace.deliverables, persistedDeliverable],
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
      if (isSupabaseConfigured && deliverable && isUuid(deliverableId)) {
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
      if (isSupabaseConfigured && isUuid(contractId)) {
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
    async (
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

      const currentContract = state.localContracts.find(
        (contract) => contract.id === contractId,
      );
      const relatedApplication = state.applications.find(
        (application) =>
          currentContract?.sourceId === application.id &&
          currentContract.sourceType === "application",
      );
      const relatedHireRequest = state.hireRequests.find(
        (hireRequest) =>
          currentContract?.sourceId === hireRequest.id &&
          currentContract.sourceType === "hire-request",
      );
      const relatedNegotiation = state.negotiations.find(
        (negotiation) =>
          currentContract?.sourceId === negotiation.id &&
          currentContract.sourceType === "negotiation",
      );
      const now = new Date().toISOString();
      const reviewRecord = {
        id: createId("review"),
        agentId:
          relatedApplication?.agentId ??
          relatedHireRequest?.agentId ??
          relatedNegotiation?.agentId,
        agentName,
        contractId,
        contractTitle,
        createdAt: now,
        organization,
        rating,
        review,
      };

      const persistedReview =
        isSupabaseConfigured && isUuid(contractId)
          ? await createReviewRecord(reviewRecord)
          : reviewRecord;

      setState((current) => {
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
            persistedReview,
            ...nextState.agentReviews,
          ],
        };
      });
      showToast("Review saved.");
    },
    [requireAuthForPersistentWrite, showToast, state],
  );

  const openContractDispute = useCallback(
    async (contractId: string, reason: string) => {
      if (!requireAuthForPersistentWrite("open disputes")) {
        return;
      }

      const now = new Date().toISOString();
      const disputeRecord = {
        id: createId("dispute"),
        contractId,
        createdAt: now,
        reason,
        status: "Open" as const,
        updatedAt: now,
      };
      const persistedDispute =
        isSupabaseConfigured && isUuid(contractId)
          ? await createDisputeRecord(disputeRecord, {
              source: "contract_workspace",
            })
          : disputeRecord;

      setState((current) => {
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
            persistedDispute,
            ...nextState.contractDisputes,
          ],
        };
      });
      showToast("Dispute opened.");
    },
    [requireAuthForPersistentWrite, showToast],
  );

  const updateContractDispute = useCallback(
    async (
      contractId: string,
      disputeId: string,
      status: ContractDisputeStatus,
      resolutionNotes = "",
    ) => {
      if (!requireAuthForPersistentWrite("update disputes")) {
        return;
      }

      if (isSupabaseConfigured && isUuid(contractId) && isUuid(disputeId)) {
        await updateDisputeRecord(disputeId, status, resolutionNotes);
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
    async (opportunityId: string) => {
      const isRealSupabaseOpportunity = isUuid(opportunityId);
      if (
        isSupabaseConfigured &&
        isRealSupabaseOpportunity &&
        !requireAuthForPersistentWrite("save opportunities")
      ) {
        return;
      }

      setState((current) => {
        const isSaved = current.savedOpportunities.some(
          (savedOpportunity) => savedOpportunity.opportunityId === opportunityId,
        );

        if (isSaved) {
          if (isSupabaseConfigured && isRealSupabaseOpportunity) {
            void unsaveOpportunityRecord(opportunityId).catch((error) =>
              setError(error instanceof Error ? error.message : "Unable to unsave opportunity."),
            );
          }
          showToast("Opportunity removed from saved items.");
          return {
            ...current,
            savedOpportunities: current.savedOpportunities.filter(
              (savedOpportunity) =>
                savedOpportunity.opportunityId !== opportunityId,
            ),
          };
        }

        if (isSupabaseConfigured && isRealSupabaseOpportunity) {
          void saveOpportunityRecord(opportunityId).catch((error) =>
            setError(error instanceof Error ? error.message : "Unable to save opportunity."),
          );
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
    [requireAuthForPersistentWrite, showToast],
  );

  const submitApplication = useCallback(
    async (input: SubmitApplicationInput) => {
      if (!requireAuthForPersistentWrite("apply to opportunities")) {
        return;
      }
      if (
        !requireRealRecord(input.opportunityId, "That opportunity") ||
        !requireRealRecord(input.agentId, "That agent")
      ) {
        return;
      }
      if (!ownsAgent(input.agentId)) {
        showToast("You can only apply with an agent you operate.");
        return;
      }

      const existingApplication = state.applications.find(
        (application) =>
          application.opportunityId === input.opportunityId &&
          application.agentId === input.agentId,
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
      const activity = recordAgentActivity(
        createAgentActivity(
          input.agentId,
          input.agentName,
          "application_submitted",
          `${input.agentName} applied to ${input.opportunityTitle}.`,
        ),
      );

      setState((current) => {
        return {
          ...current,
          agentActivities: [activity, ...current.agentActivities],
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
      settle();
    },
    [
      ownsAgent,
      recordAgentActivity,
      requireAuthForPersistentWrite,
      requireRealRecord,
      settle,
      showToast,
      state.applications,
    ],
  );

  const submitNegotiation = useCallback(
    async (input: SubmitNegotiationInput) => {
      if (!requireAuthForPersistentWrite("negotiate opportunities")) {
        return;
      }
      if (!requireRealRecord(input.opportunityId, "That opportunity")) {
        return;
      }
      if (isSupabaseConfigured && !ownsAgent(input.agentId)) {
        showToast("Choose one of your own agents to negotiate with.");
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
      const negotiatingAgent =
        draftNegotiation.agentId && draftNegotiation.agentName
          ? { id: draftNegotiation.agentId, name: draftNegotiation.agentName }
          : simulatedAgent;
      const activity = negotiatingAgent
        ? recordAgentActivity(
            createAgentActivity(
              negotiatingAgent.id,
              negotiatingAgent.name,
              "negotiation_started",
              `${negotiatingAgent.name} entered negotiation for ${input.opportunityTitle}.`,
            ),
          )
        : null;

      setState((current) => {
        return {
          ...current,
          agentActivities: activity
            ? [activity, ...current.agentActivities]
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
      settle();
    },
    [
      ownsAgent,
      recordAgentActivity,
      requireAuthForPersistentWrite,
      requireRealRecord,
      settle,
      showToast,
      state.negotiations,
    ],
  );

  const submitHireRequest = useCallback(
    async (input: SubmitHireRequestInput) => {
      if (!requireAuthForPersistentWrite("hire agents")) {
        return;
      }
      if (!requireRealRecord(input.agentId, "That agent")) {
        return;
      }
      if (isSupabaseConfigured) {
        // A shared-mode hire request must name one of the requester's own
        // opportunities: the contract's organization is derived from it.
        if (!input.opportunityId) {
          showToast("Pick one of your posted opportunities to hire against.");
          return;
        }
        if (!requireRealRecord(input.opportunityId, "That opportunity")) {
          return;
        }
        if (!ownsOpportunity(input.opportunityId)) {
          showToast("You can only hire against an opportunity you posted.");
          return;
        }
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
      const activity = recordAgentActivity(
        createAgentActivity(
          input.agentId,
          input.agentName,
          "hire_request_submitted",
          `${input.agentName} received a hire request for ${input.opportunityTitle}.`,
        ),
      );

      setState((current) => ({
        ...current,
        agentActivities: [activity, ...current.agentActivities],
        hireRequests: [
          ...current.hireRequests,
          nextHireRequest,
        ],
      }));
      showToast("Hire request submitted.");
      settle();
    },
    [
      ownsOpportunity,
      recordAgentActivity,
      requireAuthForPersistentWrite,
      requireRealRecord,
      settle,
      showToast,
    ],
  );

  const acceptApplication = useCallback(
    async (applicationId: string) => {
      if (!requireAuthForPersistentWrite("accept applications")) {
        return;
      }
      if (!requireRealRecord(applicationId, "That application")) {
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
      settle();
    },
    [requireAuthForPersistentWrite, requireRealRecord, settle, showToast, state],
  );

  const rejectApplication = useCallback(
    async (applicationId: string) => {
      if (!requireAuthForPersistentWrite("reject applications")) {
        return;
      }
      if (!requireRealRecord(applicationId, "That application")) {
        return;
      }

      const application = state.applications.find(
        (candidate) => candidate.id === applicationId,
      );

      if (!application || application.status !== "pending") {
        return;
      }

      if (isSupabaseConfigured) {
        await updateApplicationStatusRecord(applicationId, "rejected");
      }
      const activity = recordAgentActivity(
        createAgentActivity(
          application.agentId,
          application.agentName,
          "status_changed",
          `${application.agentName}'s application to ${application.opportunityTitle} was rejected.`,
        ),
      );

      setState((current) => ({
        ...current,
        agentActivities: [activity, ...current.agentActivities],
        applications: current.applications.map((candidate) =>
          candidate.id === applicationId
            ? {
                ...candidate,
                status: "rejected",
              }
            : candidate,
        ),
      }));
      showToast("Application rejected.");
      settle();
    },
    [
      recordAgentActivity,
      requireAuthForPersistentWrite,
      requireRealRecord,
      settle,
      showToast,
      state.applications,
    ],
  );

  const acceptNegotiation = useCallback(
    async (negotiationId: string) => {
      if (!requireAuthForPersistentWrite("accept negotiations")) {
        return;
      }
      if (!requireRealRecord(negotiationId, "That negotiation")) {
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
      if (isSupabaseConfigured) {
        await updateNegotiationRecord(negotiationId, { status: "accepted" });
      }
      const activity = agent
        ? recordAgentActivity(
            createAgentActivity(
              agent.id,
              agent.name,
              "status_changed",
              `${agent.name}'s negotiation for ${negotiation.opportunityTitle} was accepted.`,
            ),
          )
        : null;

      setState((current) => {
        return {
          ...current,
          agentActivities: activity
            ? [activity, ...current.agentActivities]
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
      settle();
    },
    [
      recordAgentActivity,
      requireAuthForPersistentWrite,
      requireRealRecord,
      settle,
      showToast,
      state,
    ],
  );

  const rejectNegotiation = useCallback(
    async (negotiationId: string) => {
      if (!requireAuthForPersistentWrite("reject negotiations")) {
        return;
      }
      if (!requireRealRecord(negotiationId, "That negotiation")) {
        return;
      }
      if (isSupabaseConfigured) {
        await updateNegotiationRecord(negotiationId, { status: "rejected" });
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
      settle();
    },
    [requireAuthForPersistentWrite, requireRealRecord, settle, showToast],
  );

  const counterNegotiation = useCallback(
    async (
      negotiationId: string,
      counterRate: string,
      counterTimeline: string,
      counterNote: string,
    ) => {
      if (!requireAuthForPersistentWrite("counter negotiations")) {
        return;
      }
      if (!requireRealRecord(negotiationId, "That negotiation")) {
        return;
      }
      if (isSupabaseConfigured) {
        await updateNegotiationRecord(negotiationId, {
          counterNote,
          counterRate,
          counterTimeline,
          status: "countered",
        });
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
      settle();
    },
    [requireAuthForPersistentWrite, requireRealRecord, settle, showToast],
  );

  const acceptHireRequest = useCallback(
    async (hireRequestId: string) => {
      if (!requireAuthForPersistentWrite("accept hire requests")) {
        return;
      }
      if (!requireRealRecord(hireRequestId, "That hire request")) {
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
        organizationId: opportunity?.organizationId ?? "",
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

      // Agents are not authorized to insert contracts directly, so acceptance
      // and contract materialization are two separate server-authorized steps:
      // the agent accepts through RLS, then the database derives every contract
      // relationship field from that accepted hire request.
      let localContract: LocalContract | null = draftContract;
      if (isSupabaseConfigured) {
        await acceptHireRequestRecord(hireRequest.id);
        localContract = await materializeHireRequestContract(hireRequest.id);
      }

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
          localContracts: localContract
            ? [...current.localContracts, localContract]
            : current.localContracts,
        };
      });
      showToast("Hire request accepted and contract created.");
      settle();
    },
    [requireAuthForPersistentWrite, requireRealRecord, settle, showToast, state],
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

  /**
   * UI handlers are fire-and-forget, so a rejected write (an RLS refusal, a
   * network failure) would otherwise vanish as an unhandled rejection. Every
   * exposed action reports its failure to the user instead.
   */
  const safe = useCallback(
    <A extends unknown[]>(action: (...args: A) => unknown) =>
      (...args: A) => {
        try {
          const result = action(...args);
          if (result instanceof Promise) {
            result.catch(reportError);
          }
        } catch (thrown) {
          reportError(thrown);
        }
      },
    [reportError],
  );

  const value = useMemo<AgentExchangeContextValue>(
    () => ({
      ...state,
      error,
      loading,
      saving,
      toast,
      currentProfileId,
      isSharedMode: isSupabaseConfigured,
      refresh,
      canAcceptHireRequest,
      canManageApplication,
      canManageNegotiation,
      ownsAgent,
      ownsOpportunity,
      acceptApplication: safe(acceptApplication),
      acceptHireRequest: safe(acceptHireRequest),
      acceptNegotiation: safe(acceptNegotiation),
      addAgentReview: safe(addAgentReview),
      approveSuggestedAgentAction: safe(approveSuggestedAgentAction),
      addContractDeliverable: safe(addContractDeliverable),
      addContractMilestone: safe(addContractMilestone),
      clearToast,
      counterNegotiation: safe(counterNegotiation),
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
      openContractDispute: safe(openContractDispute),
      rejectApplication: safe(rejectApplication),
      rejectNegotiation: safe(rejectNegotiation),
      sendContractMessage: safe(sendContractMessage),
      setDeliverableStatus: safe(setDeliverableStatus),
      submitApplication: safe(submitApplication),
      submitHireRequest: safe(submitHireRequest),
      submitNegotiation: safe(submitNegotiation),
      toggleMilestoneComplete: safe(toggleMilestoneComplete),
      toggleSavedOpportunity: safe(toggleSavedOpportunity),
      updateContractDispute: safe(updateContractDispute),
      updateMilestoneNotes: safe(updateMilestoneNotes),
    }),
    [
      canAcceptHireRequest,
      canManageApplication,
      canManageNegotiation,
      currentProfileId,
      ownsAgent,
      ownsOpportunity,
      refresh,
      safe,
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

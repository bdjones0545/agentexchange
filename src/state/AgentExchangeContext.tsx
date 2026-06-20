import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import type {
  Application,
  HireRequest,
  LocalActionToastState,
  LocalContract,
  Negotiation,
  SavedOpportunity,
} from "./marketplaceTypes";

const STORAGE_KEY = "agentexchange-local-mvp";

type PersistedState = {
  applications: Application[];
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
  toast: LocalActionToastState | null;
  acceptApplication: (applicationId: string) => void;
  acceptHireRequest: (hireRequestId: string) => void;
  clearToast: () => void;
  getApplicationForOpportunity: (opportunityId: string) => Application | undefined;
  getNegotiationForOpportunity: (opportunityId: string) => Negotiation | undefined;
  isOpportunitySaved: (opportunityId: string) => boolean;
  submitApplication: (input: SubmitApplicationInput) => void;
  submitHireRequest: (input: SubmitHireRequestInput) => void;
  submitNegotiation: (input: SubmitNegotiationInput) => void;
  toggleSavedOpportunity: (opportunityId: string) => void;
};

const defaultPersistedState: PersistedState = {
  applications: [],
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

function safeParseState(rawValue: string | null): PersistedState {
  if (!rawValue) {
    return defaultPersistedState;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedState>;

    return {
      applications: parsed.applications ?? [],
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
        const existingNegotiation = current.negotiations.find(
          (negotiation) => negotiation.opportunityId === input.opportunityId,
        );
        const nextNegotiation: Negotiation = {
          id: existingNegotiation?.id ?? createId("negotiation"),
          createdAt: existingNegotiation?.createdAt ?? new Date().toISOString(),
          status: "pending",
          ...input,
        };

        return {
          ...current,
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
      clearToast,
      getApplicationForOpportunity: (opportunityId) =>
        state.applications.find(
          (application) => application.opportunityId === opportunityId,
        ),
      getNegotiationForOpportunity: (opportunityId) =>
        state.negotiations.find(
          (negotiation) => negotiation.opportunityId === opportunityId,
        ),
      isOpportunitySaved: (opportunityId) =>
        state.savedOpportunities.some(
          (savedOpportunity) => savedOpportunity.opportunityId === opportunityId,
        ),
      submitApplication,
      submitHireRequest,
      submitNegotiation,
      toggleSavedOpportunity,
    }),
    [
      acceptApplication,
      acceptHireRequest,
      clearToast,
      state,
      submitApplication,
      submitHireRequest,
      submitNegotiation,
      toast,
      toggleSavedOpportunity,
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

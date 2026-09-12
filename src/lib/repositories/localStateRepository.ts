import type { AgentExchangePersistedState } from "../../state/marketplaceTypes";

export const LOCAL_STATE_KEY = "agentexchange-local-mvp";

export const emptyAgentExchangeState: AgentExchangePersistedState = {
  agentActivities: [],
  agentReviews: [],
  applications: [],
  contractDisputes: [],
  contractWorkspaces: [],
  createdAgents: [],
  createdOpportunities: [],
  hireRequests: [],
  localContracts: [],
  negotiations: [],
  savedOpportunities: [],
};

export function normalizeAgentExchangeState(
  state: Partial<AgentExchangePersistedState> | null | undefined,
): AgentExchangePersistedState {
  return {
    ...emptyAgentExchangeState,
    ...(state ?? {}),
    agentActivities: state?.agentActivities ?? [],
    agentReviews: state?.agentReviews ?? [],
    applications: state?.applications ?? [],
    contractDisputes: state?.contractDisputes ?? [],
    contractWorkspaces: state?.contractWorkspaces ?? [],
    createdAgents: state?.createdAgents ?? [],
    createdOpportunities: state?.createdOpportunities ?? [],
    hireRequests: state?.hireRequests ?? [],
    localContracts: state?.localContracts ?? [],
    negotiations: state?.negotiations ?? [],
    savedOpportunities: state?.savedOpportunities ?? [],
  };
}

/**
 * Browser-local demo persistence. This is the ONLY store in localStorage
 * demo mode. In Supabase mode the normalized tables are the store and this
 * file is not consulted (see supabaseStateRepository.ts).
 */
export async function loadLocalState(): Promise<AgentExchangePersistedState> {
  if (typeof window === "undefined") {
    return emptyAgentExchangeState;
  }

  const rawValue = window.localStorage.getItem(LOCAL_STATE_KEY);

  if (!rawValue) {
    return emptyAgentExchangeState;
  }

  try {
    return normalizeAgentExchangeState(JSON.parse(rawValue));
  } catch {
    return emptyAgentExchangeState;
  }
}

export async function saveLocalState(
  state: AgentExchangePersistedState,
): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
}

import {
  supabase,
  isSupabaseConfigured,
  getSupabaseErrorMessage,
} from "../supabase";
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

export async function loadLocalState(): Promise<AgentExchangePersistedState> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("activity_events")
      .select("metadata")
      .eq("event_type", "agentexchange_state_snapshot")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load Supabase state: ${getSupabaseErrorMessage(error)}`);
    }

    if (data?.metadata) {
      return normalizeAgentExchangeState(
        data.metadata as Partial<AgentExchangePersistedState>,
      );
    }

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
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("activity_events").insert({
      event_type: "agentexchange_state_snapshot",
      message: "AgentExchange local MVP state snapshot",
      metadata: state,
    });

    if (error) {
      throw new Error(`Unable to save Supabase state: ${getSupabaseErrorMessage(error)}`);
    }
    return;
  }

  window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
}

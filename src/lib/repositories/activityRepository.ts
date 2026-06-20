import { supabase, isSupabaseConfigured } from "../supabase";
import type {
  AgentActivityEvent,
  AgentExchangePersistedState,
} from "../../state/marketplaceTypes";
import {
  loadLocalState,
  saveLocalState,
} from "./localStateRepository";

export async function loadAgentExchangeState(): Promise<AgentExchangePersistedState> {
  return loadLocalState();
}

export async function saveAgentExchangeState(
  state: AgentExchangePersistedState,
): Promise<void> {
  await saveLocalState(state);
}

export async function createActivityEvent(event: AgentActivityEvent) {
  if (isSupabaseConfigured && supabase) {
    await supabase.from("activity_events").insert({
      actor_id: event.agentId,
      actor_type: "agent",
      event_type: event.type,
      message: event.message,
      metadata: event,
    });
    return;
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    agentActivities: [event, ...state.agentActivities],
  });
}

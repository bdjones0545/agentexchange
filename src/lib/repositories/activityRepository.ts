import { supabase, isSupabaseConfigured, getSupabaseErrorMessage } from "../supabase";
import type {
  AgentActivityEvent,
  AgentExchangePersistedState,
} from "../../state/marketplaceTypes";
import {
  loadLocalState,
  saveLocalState,
} from "./localStateRepository";
import { loadSupabaseState, type SupabaseHydratedState } from "./supabaseStateRepository";

/**
 * Loads the whole marketplace state for the current mode.
 *
 * - Supabase mode: hydrates from the normalized tables, scoped by RLS to what
 *   the current session may see. This is shared, two-sided data.
 * - Demo mode: reads the single-browser localStorage snapshot.
 */
export async function loadAgentExchangeState(): Promise<SupabaseHydratedState> {
  if (isSupabaseConfigured) {
    return loadSupabaseState();
  }

  return { ...(await loadLocalState()), currentProfileId: null };
}

/**
 * Persists state for the current mode. In Supabase mode every action already
 * wrote its own rows, so there is deliberately nothing to do here: the old
 * per-user JSON snapshot in activity_events was a second source of truth that
 * nobody else could read.
 */
export async function saveAgentExchangeState(
  state: AgentExchangePersistedState,
): Promise<void> {
  if (isSupabaseConfigured) {
    return;
  }

  await saveLocalState(state);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createActivityEvent(event: AgentActivityEvent) {
  if (isSupabaseConfigured && supabase) {
    const agentEntityId = UUID_PATTERN.test(event.agentId) ? event.agentId : null;
    const { error } = await supabase.from("activity_events").insert({
      actor_id: agentEntityId,
      actor_type: "agent",
      // entity_type 'agent' makes the event publicly readable, which is what
      // an agent's public activity timeline needs.
      entity_id: agentEntityId,
      entity_type: "agent",
      event_type: event.type,
      message: event.message,
      metadata: event,
    });
    if (error) {
      throw new Error(`Unable to create activity event: ${getSupabaseErrorMessage(error)}`);
    }
    return;
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    agentActivities: [event, ...state.agentActivities],
  });
}

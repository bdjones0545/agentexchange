import { agents } from "./agents";
import { opportunities } from "./marketplace";
import { isSupabaseConfigured } from "../lib/supabase";
import type { CreatedAgent, CreatedOpportunity } from "../state/marketplaceTypes";

type Options = { sharedMode?: boolean };

/**
 * The agents a page should show. Demo mode mixes the seed roster in so the
 * marketplace has something to browse; shared mode shows only real listings,
 * because seed agents cannot be hired and their trust figures are fiction.
 */
export function getAllAgents(
  createdAgents: CreatedAgent[],
  { sharedMode = isSupabaseConfigured }: Options = {},
) {
  return sharedMode ? [...createdAgents] : [...createdAgents, ...agents];
}

export function getAllOpportunities(
  createdOpportunities: CreatedOpportunity[],
  { sharedMode = isSupabaseConfigured }: Options = {},
) {
  return sharedMode ? [...createdOpportunities] : [...createdOpportunities, ...opportunities];
}

import { isTestListing, publicListings } from "../lib/publicListings";
import type { Agent } from "./agents";
import type { Opportunity } from "./marketplace";
import type { CreatedAgent, CreatedOpportunity } from "../state/marketplaceTypes";

type Options = { sharedMode?: boolean };

/**
 * The agents a page should show: only real listings. The old demo roster was
 * fiction (unhireable agents with invented trust figures), so no mode mixes it in.
 */
export function getAllAgents(createdAgents: CreatedAgent[], _options: Options = {}): Array<CreatedAgent | Agent> {
  // Fixture agents ("[test] Research bot") stay out of the directory and match suggestions.
  return createdAgents.filter((agent) => !isTestListing({ title: agent.name }));
}

export function getAllOpportunities(createdOpportunities: CreatedOpportunity[], _options: Options = {}): Array<CreatedOpportunity | Opportunity> {
  return publicListings<CreatedOpportunity | Opportunity>([...createdOpportunities]);
}

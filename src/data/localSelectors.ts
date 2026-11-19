import { isTestListing, publicListings } from "../lib/publicListings";
import type { Agent } from "./agents";
import type { Opportunity } from "./marketplace";
import type { CreatedAgent, CreatedOpportunity } from "../state/marketplaceTypes";

type Options = { sharedMode?: boolean; includeClosed?: boolean };

/**
 * The agents a page should show: only real listings. The old demo roster was
 * fiction (unhireable agents with invented trust figures), so no mode mixes it in.
 */
export function getAllAgents(createdAgents: CreatedAgent[], _options: Options = {}): Array<CreatedAgent | Agent> {
  return [...createdAgents];
}

/** The public roster: fixture agents ("[test] Research bot") stay out of the directory, counts and match suggestions. */
export function getListedAgents(createdAgents: CreatedAgent[]): Array<CreatedAgent | Agent> {
  // An unlisted agent is visible only to its seller (RLS); keep it out of their own directory view too.
  return createdAgents.filter((agent) => !isTestListing({ title: agent.name }) && agent.listed !== false);
}

/** Open briefs only, unless includeClosed (the brief page itself, so a link to a closed brief still explains it). */
export function getAllOpportunities(createdOpportunities: CreatedOpportunity[], options: Options = {}): Array<CreatedOpportunity | Opportunity> {
  const visible = options.includeClosed ? createdOpportunities : createdOpportunities.filter((o) => o.status !== "closed");
  return publicListings<CreatedOpportunity | Opportunity>([...visible]);
}

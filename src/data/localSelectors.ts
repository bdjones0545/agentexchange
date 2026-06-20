import { agents } from "./agents";
import { opportunities } from "./marketplace";
import type { CreatedAgent, CreatedOpportunity } from "../state/marketplaceTypes";

export function getAllAgents(createdAgents: CreatedAgent[]) {
  return [...createdAgents, ...agents];
}

export function getAllOpportunities(createdOpportunities: CreatedOpportunity[]) {
  return [...createdOpportunities, ...opportunities];
}

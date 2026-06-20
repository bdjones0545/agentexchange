import { OrganizationCard } from "../components/OrganizationCard";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { getAllAgents, getAllOpportunities } from "../data/localSelectors";
import {
  getAllOrganizations,
  getOrganizationSummary,
} from "../data/organizations";
import { contracts } from "../data/operations";
import { useAgentExchange } from "../state/AgentExchangeContext";

export function OrganizationsPage() {
  const {
    agentReviews,
    applications,
    contractWorkspaces,
    createdAgents,
    createdOpportunities,
    hireRequests,
    localContracts,
    negotiations,
  } = useAgentExchange();
  const opportunities = getAllOpportunities(createdOpportunities);
  const allContracts = [...localContracts, ...contracts].map((contract) => {
    const workspace = contractWorkspaces.find(
      (candidate) => candidate.contractId === contract.id,
    );

    return workspace ? applyWorkspaceToContract(contract, workspace) : contract;
  });
  const context = {
    agents: getAllAgents(createdAgents),
    applications,
    contracts: allContracts,
    hireRequests,
    negotiations,
    opportunities,
    reviews: agentReviews,
  };
  const organizations = getAllOrganizations(opportunities).map((organization) =>
    getOrganizationSummary(organization, context),
  );

  return (
    <section className="space-y-8">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Organizations
        </p>
        <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
          Companies hiring autonomous agents.
        </h1>
        <p className="mt-3 max-w-2xl text-ae-text-muted">
          Browse verified and local buyer organizations, their spend, active
          agents, open opportunities, and ratings.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {organizations.map((organization) => (
          <OrganizationCard key={organization.id} organization={organization} />
        ))}
      </div>
    </section>
  );
}

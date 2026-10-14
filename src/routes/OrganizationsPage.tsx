import { Link } from "react-router-dom";

import { GlassCard } from "../components/GlassCard";
import { OrganizationCard } from "../components/OrganizationCard";
import { PageHeader } from "../components/PageHeader";
import { organizationFigures } from "../components/SpendSummaryCard";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { getAllAgents, getAllOpportunities } from "../data/localSelectors";
import {
  getAllOrganizations,
  getOrganizationContracts,
  getOrganizationOpportunities,
  getOrganizationSummary,
} from "../data/organizations";
import { useAgentExchange } from "../state/AgentExchangeContext";

export function OrganizationsPage() {
  const {
    agentReviews,
    applications,
    contractWorkspaces,
    createdAgents,
    createdOpportunities,
    hireRequests,
    loading,
    localContracts,
    negotiations,
  } = useAgentExchange();
  const opportunities = getAllOpportunities(createdOpportunities);
  const allContracts = localContracts.map((contract) => {
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
  // Only organizations with something real behind them: a posted opportunity
  // or a contract the viewer can see. The built-in sample organizations have
  // neither, so they never appear.
  const organizations = getAllOrganizations(opportunities)
    .map((organization) => ({
      contracts: getOrganizationContracts(organization, allContracts),
      opportunities: getOrganizationOpportunities(organization, opportunities),
      organization,
    }))
    .filter((entry) => entry.contracts.length > 0 || entry.opportunities.length > 0)
    .map((entry) =>
      organizationFigures(
        getOrganizationSummary(entry.organization, context),
        entry.contracts,
        agentReviews.filter((review) => review.organization === entry.organization.name).length,
      ),
    );

  return (
    <section className="space-y-10">
      <PageHeader
        actions={
          organizations.length > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-ae-primary/25 bg-ae-primary/10 px-4 py-2 font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-primary">
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {organizations.length} {organizations.length === 1 ? "organization" : "organizations"}
            </span>
          ) : undefined
        }
        description="Organizations that have posted opportunities or hold contracts you can see, with their contract value, hired agents and posted opportunities."
        eyebrow="Organizations"
        title="Companies hiring autonomous agents."
      />

      {organizations.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {organizations.map((organization) => (
            <OrganizationCard key={organization.id} organization={organization} />
          ))}
        </div>
      ) : loading ? null : (
        <GlassCard className="mx-auto max-w-2xl space-y-4 px-6 py-10 text-center sm:px-10">
          <h2 className="font-ae-display text-2xl font-semibold tracking-tight text-ae-text">No organizations yet</h2>
          <p className="mx-auto max-w-md text-sm leading-6 text-ae-text-muted">
            An organization appears here once it posts an opportunity on the marketplace.
          </p>
          <div className="pt-2">
            <Link
              className="inline-flex items-center justify-center rounded-xl bg-ae-primary-action px-5 py-3 font-ae-label text-sm font-semibold text-ae-primary-ink transition hover:-translate-y-0.5"
              to="/post-opportunity"
            >
              Post an opportunity
            </Link>
          </div>
        </GlassCard>
      )}
    </section>
  );
}

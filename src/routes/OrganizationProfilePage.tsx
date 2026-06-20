import { Navigate, useNavigate, useParams } from "react-router-dom";

import { ContractCard } from "../components/ContractCard";
import { OrganizationAgentRoster } from "../components/OrganizationAgentRoster";
import { OrganizationProfileHeader } from "../components/OrganizationProfileHeader";
import { OrganizationStats } from "../components/OrganizationStats";
import { PostedOpportunityCard } from "../components/PostedOpportunityCard";
import { SpendSummaryCard } from "../components/SpendSummaryCard";
import { GlassCard } from "../components/GlassCard";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { getAllAgents, getAllOpportunities } from "../data/localSelectors";
import {
  getAllOrganizations,
  getOrganizationContracts,
  getOrganizationOpportunities,
  getOrganizationSummary,
} from "../data/organizations";
import { contracts } from "../data/operations";
import { useAgentExchange } from "../state/AgentExchangeContext";

export function OrganizationProfilePage() {
  const navigate = useNavigate();
  const { id } = useParams();
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
  const organization = getAllOrganizations(opportunities).find(
    (candidate) => candidate.id === id,
  );

  if (!organization) {
    return <Navigate replace to="/organizations" />;
  }

  const summary = getOrganizationSummary(organization, context);
  const organizationOpportunities = getOrganizationOpportunities(
    organization,
    opportunities,
  );
  const organizationContracts = getOrganizationContracts(
    organization,
    allContracts,
  );
  const reviewsGiven = agentReviews.filter(
    (review) => review.organization === organization.name,
  );

  return (
    <section className="space-y-8">
      <button
        className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted transition hover:text-ae-primary"
        onClick={() => navigate("/organizations")}
        type="button"
      >
        Back to organizations
      </button>

      <OrganizationProfileHeader
        onOpenDashboard={() => navigate("/organization-dashboard")}
        organization={summary}
      />
      <OrganizationStats stats={summary} />
      <SpendSummaryCard organization={summary} />

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Posted Opportunities
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {organizationOpportunities.length > 0 ? (
            organizationOpportunities.map((opportunity) => (
              <PostedOpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
              />
            ))
          ) : (
            <GlassCard className="text-ae-text-muted">
              No posted opportunities yet.
            </GlassCard>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Active Contracts
        </h2>
        <div className="grid gap-4">
          {organizationContracts.length > 0 ? (
            organizationContracts.map((contract) => (
              <ContractCard contract={contract} key={contract.id} />
            ))
          ) : (
            <GlassCard className="text-ae-text-muted">
              No active contracts yet.
            </GlassCard>
          )}
        </div>
      </section>

      <OrganizationAgentRoster contracts={organizationContracts} />

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Reviews Given
        </h2>
        <div className="grid gap-3">
          {reviewsGiven.length > 0 ? (
            reviewsGiven.map((review) => (
              <GlassCard className="space-y-2" key={review.id}>
                <p className="font-ae-display text-xl font-semibold text-ae-text">
                  {review.rating}/5 for {review.agentName}
                </p>
                <p className="text-sm text-ae-text-muted">
                  {review.contractTitle}
                </p>
                <p className="text-sm leading-6 text-ae-text-muted">
                  {review.review}
                </p>
              </GlassCard>
            ))
          ) : (
            <GlassCard className="text-ae-text-muted">
              No reviews submitted yet.
            </GlassCard>
          )}
        </div>
      </section>
    </section>
  );
}

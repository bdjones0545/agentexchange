import { ContractCard } from "../components/ContractCard";
import { ApplicantReviewCard } from "../components/ApplicantReviewCard";
import { OrganizationStats } from "../components/OrganizationStats";
import { PostedOpportunityCard } from "../components/PostedOpportunityCard";
import { SpendSummaryCard } from "../components/SpendSummaryCard";
import { GlassCard } from "../components/GlassCard";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { getAllAgents, getAllOpportunities } from "../data/localSelectors";
import {
  getAllOrganizations,
  getOrganizationApplications,
  getOrganizationContracts,
  getOrganizationNegotiations,
  getOrganizationOpportunities,
  getOrganizationSummary,
} from "../data/organizations";
import { contracts } from "../data/operations";
import { useAgentExchange } from "../state/AgentExchangeContext";

export function OrganizationDashboardPage() {
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
  const organization = getAllOrganizations(opportunities)[0];
  const summary = getOrganizationSummary(organization, context);
  const postedOpportunities = getOrganizationOpportunities(
    organization,
    opportunities,
  );
  const receivedApplications = getOrganizationApplications(organization, context);
  const receivedNegotiations = getOrganizationNegotiations(organization, context);
  const organizationContracts = getOrganizationContracts(
    organization,
    allContracts,
  );
  const activeContracts = organizationContracts.filter(
    (contract) => contract.status !== "Completed",
  );
  const completedContracts = organizationContracts.filter(
    (contract) => contract.status === "Completed",
  );

  return (
    <section className="space-y-8">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Organization Dashboard
        </p>
        <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
          {organization.name}
        </h1>
        <p className="mt-3 max-w-2xl text-ae-text-muted">
          Review applications, negotiations, hire requests, contracts, and
          marketplace spend from the buyer side.
        </p>
      </div>

      <OrganizationStats stats={summary} />
      <SpendSummaryCard organization={summary} />

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Posted Opportunities
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {postedOpportunities.map((opportunity) => (
            <PostedOpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Applications Received
        </h2>
        <div className="grid gap-4">
          {receivedApplications.length > 0 ? (
            receivedApplications.map((application) => (
              <ApplicantReviewCard
                application={application}
                key={application.id}
                type="application"
              />
            ))
          ) : (
            <GlassCard className="text-ae-text-muted">
              No applications received yet.
            </GlassCard>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Negotiations Received
        </h2>
        <div className="grid gap-4">
          {receivedNegotiations.length > 0 ? (
            receivedNegotiations.map((negotiation) => (
              <ApplicantReviewCard
                key={negotiation.id}
                negotiation={negotiation}
                type="negotiation"
              />
            ))
          ) : (
            <GlassCard className="text-ae-text-muted">
              No negotiations received yet.
            </GlassCard>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
          Hire Requests
        </h2>
        <div className="grid gap-4">
          {hireRequests.length > 0 ? (
            hireRequests.map((request) => (
              <GlassCard className="space-y-2" key={request.id}>
                <p className="font-ae-display text-xl font-semibold text-ae-text">
                  {request.agentName}
                </p>
                <p className="text-sm text-ae-text-muted">
                  {request.opportunityTitle}
                </p>
                <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-primary">
                  {request.status}
                </p>
              </GlassCard>
            ))
          ) : (
            <GlassCard className="text-ae-text-muted">
              No hire requests yet.
            </GlassCard>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
            Active Contracts
          </h2>
          {activeContracts.length > 0 ? (
            activeContracts.map((contract) => (
              <ContractCard contract={contract} key={contract.id} />
            ))
          ) : (
            <GlassCard className="text-ae-text-muted">
              No active contracts.
            </GlassCard>
          )}
        </div>
        <div className="space-y-4">
          <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
            Completed Contracts
          </h2>
          {completedContracts.length > 0 ? (
            completedContracts.map((contract) => (
              <ContractCard contract={contract} key={contract.id} />
            ))
          ) : (
            <GlassCard className="text-ae-text-muted">
              No completed contracts.
            </GlassCard>
          )}
        </div>
      </section>
    </section>
  );
}

import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ContractCard } from "../components/ContractCard";
import { ApplicantReviewCard } from "../components/ApplicantReviewCard";
import { OrganizationStats } from "../components/OrganizationStats";
import { PageHeader } from "../components/PageHeader";
import { PostedOpportunityCard } from "../components/PostedOpportunityCard";
import { SpendSummaryCard, organizationFigures } from "../components/SpendSummaryCard";
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
  slugifyOrganization,
} from "../data/organizations";
import { useAgentExchange } from "../state/AgentExchangeContext";

function SectionTitle({ children, count }: { children: ReactNode; count: number }) {
  return (
    <h2 className="flex items-center gap-3 font-ae-display text-2xl font-semibold tracking-tight text-ae-text sm:text-3xl">
      {children}
      <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 font-ae-label text-xs font-semibold tabular-nums text-ae-text-muted">
        {count}
      </span>
    </h2>
  );
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <GlassCard className="border-dashed text-center text-sm text-ae-text-muted">
      {children}
    </GlassCard>
  );
}

export function OrganizationDashboardPage() {
  const [searchParams] = useSearchParams();
  const {
    agentReviews,
    applications,
    contractWorkspaces,
    createdAgents,
    createdOpportunities,
    hireRequests,
    isSharedMode,
    loading,
    localContracts,
    negotiations,
    ownsOpportunity,
  } = useAgentExchange();
  const opportunities = getAllOpportunities(createdOpportunities);
  // This is the buyer's own dashboard: on the shared marketplace only briefs the
  // signed-in user posted decide which organizations it can open.
  // The owner sees all of their own briefs here, including [test] ones the public lists hide.
  const ownOpportunities = isSharedMode
    ? createdOpportunities.filter((opportunity) => ownsOpportunity(opportunity.id))
    : opportunities;
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
    opportunities: ownOpportunities,
    reviews: agentReviews,
  };
  // Only organizations with a posted opportunity or a visible contract; the
  // built-in sample organizations have neither and are never shown.
  const organizations = getAllOrganizations(ownOpportunities).filter(
    (candidate) => getOrganizationOpportunities(candidate, ownOpportunities).length > 0,
  );
  const requestedOrganizationId = searchParams.get("organization");
  const latestCreatedOrganizationId = ownOpportunities[0]?.organization
    ? slugifyOrganization(ownOpportunities[0].organization)
    : undefined;
  const organization =
    organizations.find(
      (candidate) =>
        candidate.id === requestedOrganizationId ||
        candidate.id === latestCreatedOrganizationId,
    ) ?? organizations[0];

  if (!organization) {
    return (
      <section className="space-y-10">
        <PageHeader
          description="Review applications, negotiations, hire requests, contracts and contract value from the buyer side."
          eyebrow="Organization Dashboard"
          title="No organization yet"
        />
        {loading ? null : (
          <GlassCard className="mx-auto max-w-2xl space-y-4 px-6 py-10 text-center sm:px-10">
            <p className="mx-auto max-w-md text-sm leading-6 text-ae-text-muted">
              An organization is created when you post its first opportunity. Its applications, negotiations and contracts will appear here.
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

  const postedOpportunities = getOrganizationOpportunities(
    organization,
    ownOpportunities,
  );
  const receivedApplications = getOrganizationApplications(organization, context);
  const receivedNegotiations = getOrganizationNegotiations(organization, context);
  const organizationContracts = getOrganizationContracts(
    organization,
    allContracts,
  );
  const summary = organizationFigures(
    getOrganizationSummary(organization, context),
    organizationContracts,
    agentReviews.filter((review) => review.organization === organization.name).length,
  );
  const activeContracts = organizationContracts.filter(
    (contract) => contract.status !== "Completed",
  );
  const completedContracts = organizationContracts.filter(
    (contract) => contract.status === "Completed",
  );

  return (
    <section className="space-y-12">
      <PageHeader
        description="Review applications, negotiations, hire requests, contracts and contract value from the buyer side."
        eyebrow="Organization Dashboard"
        title={<span className="break-words">{organization.name}</span>}
      >
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["Applications", receivedApplications.length, "bg-ae-primary"],
            ["Negotiations", receivedNegotiations.length, "bg-ae-amber"],
            ["Active contracts", activeContracts.length, "bg-ae-emerald"],
          ].map(([label, count, dot]) => (
            <span
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ae-text-muted"
              key={label}
            >
              <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
              {label}
              <span className="font-semibold tabular-nums text-ae-text">{count}</span>
            </span>
          ))}
        </div>
      </PageHeader>

      <div className="space-y-4">
        <OrganizationStats stats={summary} />
        <SpendSummaryCard organization={summary} />
      </div>

      <section className="space-y-5">
        <SectionTitle count={postedOpportunities.length}>Posted Opportunities</SectionTitle>
        {postedOpportunities.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {postedOpportunities.map((opportunity) => (
              <PostedOpportunityCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        ) : (
          <EmptyCard>No posted opportunities yet.</EmptyCard>
        )}
      </section>

      <div className="grid items-start gap-12 xl:grid-cols-2 xl:gap-8">
        <section className="min-w-0 space-y-5">
          <SectionTitle count={receivedApplications.length}>Applications Received</SectionTitle>
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
              <EmptyCard>No applications received yet.</EmptyCard>
            )}
          </div>
        </section>

        <section className="min-w-0 space-y-5">
          <SectionTitle count={receivedNegotiations.length}>Negotiations Received</SectionTitle>
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
              <EmptyCard>No negotiations received yet.</EmptyCard>
            )}
          </div>
        </section>
      </div>

      <section className="space-y-5">
        <SectionTitle count={hireRequests.length}>Hire Requests</SectionTitle>
        {hireRequests.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {hireRequests.map((request) => (
              <GlassCard className="flex min-w-0 items-start justify-between gap-4" key={request.id}>
                <div className="min-w-0">
                  <p className="break-words font-ae-display text-lg font-semibold tracking-tight text-ae-text">
                    {request.agentName}
                  </p>
                  <p className="mt-0.5 break-words text-sm text-ae-text-muted">
                    {request.opportunityTitle}
                  </p>
                </div>
                <span className="inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-ae-primary/25 bg-ae-primary/10 px-2.5 py-1 font-ae-label text-xs font-semibold capitalize text-ae-primary">
                  <span aria-hidden className="size-1.5 rounded-full bg-current" />
                  {request.status}
                </span>
              </GlassCard>
            ))}
          </div>
        ) : (
          <EmptyCard>No hire requests yet.</EmptyCard>
        )}
      </section>

      <div className="grid items-start gap-12 xl:grid-cols-2 xl:gap-8">
        <section className="min-w-0 space-y-5">
          <SectionTitle count={activeContracts.length}>Active Contracts</SectionTitle>
          <div className="grid gap-4">
            {activeContracts.length > 0 ? (
              activeContracts.map((contract) => (
                <ContractCard contract={contract} key={contract.id} />
              ))
            ) : (
              <EmptyCard>No active contracts.</EmptyCard>
            )}
          </div>
        </section>
        <section className="min-w-0 space-y-5">
          <SectionTitle count={completedContracts.length}>Completed Contracts</SectionTitle>
          <div className="grid gap-4">
            {completedContracts.length > 0 ? (
              completedContracts.map((contract) => (
                <ContractCard contract={contract} key={contract.id} />
              ))
            ) : (
              <EmptyCard>No completed contracts.</EmptyCard>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

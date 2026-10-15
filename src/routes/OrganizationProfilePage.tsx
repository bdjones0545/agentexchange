import type { ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { ContractCard } from "../components/ContractCard";
import { OrganizationAgentRoster } from "../components/OrganizationAgentRoster";
import { OrganizationProfileHeader } from "../components/OrganizationProfileHeader";
import { OrganizationStats } from "../components/OrganizationStats";
import { PostedOpportunityCard } from "../components/PostedOpportunityCard";
import { SpendSummaryCard, organizationFigures } from "../components/SpendSummaryCard";
import { GlassCard } from "../components/GlassCard";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { getAllAgents, getAllOpportunities } from "../data/localSelectors";
import {
  getAllOrganizations,
  getOrganizationContracts,
  getOrganizationOpportunities,
  getOrganizationSummary,
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
    loading,
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
  // The built-in sample organizations have no opportunities or contracts, so
  // a profile only exists for an organization with something real behind it.
  const organization = getAllOrganizations(opportunities).find(
    (candidate) =>
      candidate.id === id &&
      (getOrganizationOpportunities(candidate, opportunities).length > 0 ||
        getOrganizationContracts(candidate, allContracts).length > 0),
  );

  if (!organization && loading) {
    return (
      <p className="w-fit rounded-xl border border-white/[0.08] bg-ae-surface/70 px-4 py-3 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text-muted motion-safe:animate-pulse">
        Loading
      </p>
    );
  }

  if (!organization) {
    return <Navigate replace to="/organizations" />;
  }

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
  const summary = organizationFigures(
    getOrganizationSummary(organization, context),
    organizationContracts,
    reviewsGiven.length,
  );

  return (
    <section className="space-y-10">
      <button
        className="inline-flex items-center gap-2 font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted transition hover:text-ae-primary"
        onClick={() => navigate("/organizations")}
        type="button"
      >
        <svg aria-hidden className="size-3.5" viewBox="0 0 16 16">
          <path d="M13 8H3M7 4L3 8l4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
        </svg>
        Back to organizations
      </button>

      <OrganizationProfileHeader
        onOpenDashboard={() =>
          navigate(`/organization-dashboard?organization=${summary.id}`)
        }
        organization={summary}
      />

      <div className="space-y-4">
        <OrganizationStats stats={summary} />
        <SpendSummaryCard organization={summary} />
      </div>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-8">
        <div className="min-w-0 space-y-10">
          <section className="space-y-5">
            <SectionTitle count={organizationOpportunities.length}>Posted Opportunities</SectionTitle>
            {organizationOpportunities.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {organizationOpportunities.map((opportunity) => (
                  <PostedOpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                  />
                ))}
              </div>
            ) : (
              <EmptyCard>No posted opportunities yet.</EmptyCard>
            )}
          </section>

          <section className="space-y-5">
            <SectionTitle count={organizationContracts.length}>Contracts</SectionTitle>
            <div className="grid gap-4">
              {organizationContracts.length > 0 ? (
                organizationContracts.map((contract) => (
                  <ContractCard contract={contract} key={contract.id} />
                ))
              ) : (
                <EmptyCard>No active contracts yet.</EmptyCard>
              )}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <OrganizationAgentRoster contracts={organizationContracts} />

          <GlassCard className="space-y-5 sm:p-6">
            <div>
              <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
                Reviews
              </p>
              <h2 className="mt-2 font-ae-display text-2xl font-semibold tracking-tight text-ae-text">
                Reviews Given
              </h2>
            </div>
            {reviewsGiven.length > 0 ? (
              <ul className="space-y-3">
                {reviewsGiven.map((review) => (
                  <li className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4" key={review.id}>
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ae-text">
                      <span className="rounded-full border border-ae-amber/25 bg-ae-amber/10 px-2 py-0.5 font-ae-label text-xs font-semibold tabular-nums text-ae-amber">
                        {review.rating}/5
                      </span>
                      <span className="min-w-0 break-words">for {review.agentName}</span>
                    </p>
                    <p className="break-words text-xs text-ae-text-muted">
                      {review.contractTitle}
                    </p>
                    <p className="break-words text-sm leading-6 text-ae-text-muted">
                      {review.review}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-5 text-center text-sm text-ae-text-muted">
                No reviews submitted yet.
              </p>
            )}
          </GlassCard>
        </aside>
      </div>
    </section>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ActivityFeed } from "../components/ActivityFeed";
import { ApplicationModal } from "../components/ApplicationModal";
import { CategoryCard } from "../components/CategoryCard";
import { GlassCard } from "../components/GlassCard";
import { MetricCard } from "../components/MetricCard";
import { NegotiationModal } from "../components/NegotiationModal";
import { OpportunityCard } from "../components/OpportunityCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import {
  categories,
  liveActivity,
  marketplaceMetrics,
  opportunities,
  type Opportunity,
} from "../data/marketplace";
import {
  getLiveActivity,
  getLiveCategories,
  getLiveMarketplaceMetrics,
} from "../data/liveMetrics";
import { useAgentExchange } from "../state/AgentExchangeContext";

export function HomePage() {
  const navigate = useNavigate();
  const {
    agentActivities,
    createdAgents,
    createdOpportunities,
    hireRequests,
    isSharedMode,
    localContracts,
  } = useAgentExchange();
  // Shared mode shows the marketplace as it is; demo mode shows the seed story.
  const metrics = isSharedMode
    ? getLiveMarketplaceMetrics({
        agents: createdAgents,
        contracts: localContracts,
        hireRequests,
        opportunities: createdOpportunities,
      })
    : marketplaceMetrics;
  const categoryCards = isSharedMode ? getLiveCategories(categories, createdOpportunities) : categories;
  const activity = isSharedMode ? getLiveActivity(agentActivities) : liveActivity;
  const featuredOpportunity: Opportunity | undefined = isSharedMode
    ? [...createdOpportunities].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    : opportunities[0];
  const [applicationOpportunity, setApplicationOpportunity] =
    useState<Opportunity | null>(null);
  const [negotiationOpportunity, setNegotiationOpportunity] =
    useState<Opportunity | null>(null);

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            AgentExchange marketplace
          </p>
          <div className="space-y-4">
            <h1 className="font-ae-display text-3xl font-bold leading-tight tracking-[-0.02em] text-ae-text sm:text-6xl">
              Deploy, trade, and scale enterprise AI agents.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-ae-text-muted sm:text-lg">
              {isSharedMode
                ? "Post a brief, hire an agent, and get the work delivered into the contract. Agents marked as Hermes workers do the job themselves."
                : "A dark-mode marketplace home for discovering autonomous talent, high-trust opportunities, and local client-side marketplace workflows."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <PrimaryButton
              className="w-full sm:w-auto"
              onClick={() => navigate("/marketplace")}
            >
              Launch Marketplace
            </PrimaryButton>
            <SecondaryButton
              className="w-full sm:w-auto"
              onClick={() => navigate("/post-opportunity")}
            >
              Post Opportunity
            </SecondaryButton>
            <SecondaryButton
              className="w-full sm:w-auto"
              onClick={() => navigate(isSharedMode ? "/for-agents" : "/create-agent")}
            >
              {isSharedMode ? "I'm an agent" : "Create Agent"}
            </SecondaryButton>
          </div>
        </div>

        {isSharedMode ? null : (
          <GlassCard className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
                  Network throughput
                </p>
                <p className="mt-2 font-ae-display text-4xl font-semibold text-ae-text">
                  12.4 GB/s
                </p>
              </div>
              <span className="rounded-full border border-ae-emerald/20 bg-ae-emerald/10 px-3 py-1 font-ae-label text-xs font-semibold text-ae-emerald">
                Online
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-ae-primary to-ae-cyan" />
            </div>
            <p className="text-sm leading-6 text-ae-text-muted">
              Static visual telemetry placeholder for the future network hub.
            </p>
          </GlassCard>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
              Categories
            </p>
            <h2 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text">
              Browse autonomous work
            </h2>
          </div>
          <SecondaryButton onClick={() => navigate("/marketplace")}>
            View all
          </SecondaryButton>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {categoryCards.map((category) => (
            <CategoryCard category={category} key={category.id} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        {featuredOpportunity ? (
          <div className="space-y-4">
            <div>
              <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
                Featured opportunity
              </p>
              <h2 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text">
                {isSharedMode ? "Newest brief" : "High-fit enterprise brief"}
              </h2>
            </div>
            <OpportunityCard
              defaultExpanded
              onApply={setApplicationOpportunity}
              onNegotiate={setNegotiationOpportunity}
              opportunity={featuredOpportunity}
            />
          </div>
        ) : null}
        <ActivityFeed items={activity} />
      </section>
      <ApplicationModal
        isOpen={Boolean(applicationOpportunity)}
        onClose={() => setApplicationOpportunity(null)}
        opportunity={applicationOpportunity}
      />
      <NegotiationModal
        isOpen={Boolean(negotiationOpportunity)}
        onClose={() => setNegotiationOpportunity(null)}
        opportunity={negotiationOpportunity}
      />
    </div>
  );
}

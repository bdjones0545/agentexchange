import { ContractLifecycle } from "../components/ContractLifecycle";
import { ListingSkeleton } from "../components/ListingResults";
import { publicContracts, publicListings, showHomeCounters } from "../lib/publicListings";
import { useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ActivityFeed } from "../components/ActivityFeed";
import { ApplicationModal } from "../components/ApplicationModal";
import { CategoryCard } from "../components/CategoryCard";
import { MetricCard } from "../components/MetricCard";
import { NegotiationModal } from "../components/NegotiationModal";
import { OpportunityCard } from "../components/OpportunityCard";
import { SecondaryButton } from "../components/SecondaryButton";
import { BriefComposer } from "../components/landing/BriefComposer";
import { ContractDemo } from "../components/landing/ContractDemo";
import { BriefMarquee, ControlBento, DeveloperSection, Faq, FinalCta, PathCards, SectionHeading } from "../components/landing/LandingSections";
import { NetworkCanvas } from "../components/landing/NetworkCanvas";
import { categories, type Opportunity } from "../data/marketplace";
import { getAllAgents } from "../data/localSelectors";
import {
  getLiveActivity,
  getLiveCategories,
  getLiveMarketplaceMetrics,
} from "../data/liveMetrics";
import { useAgentExchange } from "../state/AgentExchangeContext";

const rise = (ms: number) => ({ "--ax-delay": `${ms}ms` }) as CSSProperties;

function HeroBackdrop() {
  return <div aria-hidden className="pointer-events-none absolute -top-8 bottom-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden">
    <div className="ax-grid-bg absolute inset-0" />
    <div className="ax-aurora absolute -top-48 right-[-12%] size-[44rem] rounded-full bg-ae-primary/[0.14] blur-[120px]" />
    <div className="ax-aurora absolute left-[-18%] top-1/3 size-[36rem] rounded-full bg-ae-cyan/10 blur-[120px]" style={{ animationDelay: "-9s" }} />
    <NetworkCanvas className="absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_80%_70%_at_60%_40%,#000_35%,transparent_80%)]" />
    <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-ae-background" />
  </div>;
}

export function HomePage() {
  const navigate = useNavigate();
  const {
    agentActivities,
    createdAgents,
    createdOpportunities,
    hireRequests,
    isSharedMode,
    localContracts,
    loading,
  } = useAgentExchange();
  // Every number and listing here comes from rows the visitor can see; nothing is seeded.
  const listedAgents = getAllAgents(createdAgents);
  const metrics = getLiveMarketplaceMetrics({
    agents: listedAgents as typeof createdAgents,
    contracts: localContracts,
    hireRequests,
    opportunities: createdOpportunities,
  });
  const categoryCards = getLiveCategories(categories, createdOpportunities);
  const activity = getLiveActivity(agentActivities);
  const featuredOpportunity: Opportunity | undefined = publicListings(createdOpportunities).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const [applicationOpportunity, setApplicationOpportunity] =
    useState<Opportunity | null>(null);
  const [negotiationOpportunity, setNegotiationOpportunity] =
    useState<Opportunity | null>(null);

  return (
    <div className="space-y-24 sm:space-y-32">
      <div className="space-y-10">
        <section className="relative isolate grid gap-14 pb-6 pt-4 sm:pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:pb-12 lg:pt-14">
          <HeroBackdrop />
          <div className="space-y-7">
            <p className="ax-rise inline-flex items-center gap-2.5 rounded-full border border-ae-primary/25 bg-ae-primary/[0.07] px-3.5 py-1.5 text-xs font-medium text-ae-primary backdrop-blur" style={rise(0)}>
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-ae-primary/60" /><span className="relative inline-flex size-2 rounded-full bg-ae-primary" /></span>
              The marketplace for agent-powered work
            </p>
            <h1 className="ax-rise-text max-w-3xl font-ae-display text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.05em] text-balance sm:text-6xl lg:text-[4.25rem]" style={rise(90)}>
              Hire AI agents for fixed-price work. <span className="ax-gradient-text">Pay only when you approve it.</span>
            </h1>
            <p className="ax-rise-text max-w-xl text-base leading-7 text-ae-text-muted sm:text-lg sm:leading-8" style={rise(180)}>
              Post a brief, agree on the price up front, and review the delivery before payment is released. Your agents can hire and work here too — within the limits you set.
            </p>
            <div className="ax-rise max-w-xl" style={rise(270)}><BriefComposer /></div>
            <div className="ax-rise flex flex-wrap items-center gap-x-6 gap-y-3 text-sm" style={rise(360)}>
              <Link to="/agents" className="group inline-flex items-center gap-1.5 font-semibold text-ae-text transition hover:text-ae-primary">Browse agents <span aria-hidden className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span></Link>
              <Link to="/for-agents" className="group inline-flex items-center gap-1.5 font-semibold text-ae-text transition hover:text-ae-primary">I build agents <span aria-hidden className="transition group-hover:translate-x-0.5">→</span></Link>
              <Link to="/marketplace" className="group inline-flex items-center gap-1.5 text-ae-text-muted transition hover:text-ae-primary">Find work <span aria-hidden className="transition group-hover:translate-x-0.5">→</span></Link>
            </div>
            <ul className="ax-rise flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.07] pt-5 text-xs text-ae-text-muted sm:text-sm" style={rise(450)}>
              {["Free to post", "Price agreed up front", "Approve before release"].map((item) => <li key={item} className="flex items-center gap-2"><svg aria-hidden viewBox="0 0 16 16" className="size-4 text-ae-primary"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>{item}</li>)}
            </ul>
          </div>
          <div className="ax-rise mx-auto w-full max-w-lg lg:max-w-none" style={rise(300)}><ContractDemo /></div>
        </section>

        <BriefMarquee />

        {!loading && isSharedMode && showHomeCounters(listedAgents.length, publicContracts(localContracts).length) ? <section aria-label="Marketplace activity" className="grid gap-4 md:grid-cols-3">{metrics.map(metric=><MetricCard key={metric.id} metric={metric}/>)}</section> : !isSharedMode ? <p className="rounded-xl border border-ae-amber/20 bg-ae-amber/5 px-4 py-3 text-sm text-ae-amber">Local preview · Live marketplace data loads when Supabase is configured.</p> : null}
      </div>

      <PathCards />

      <ContractLifecycle />

      <ControlBento />

      <section aria-labelledby="live-title" className="space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading id="live-title" eyebrow="On the marketplace" title="See what’s being posted right now.">Browse by category, open a brief, or watch agents work in the activity feed.</SectionHeading>
          <SecondaryButton className="ax-reveal" onClick={() => navigate("/marketplace")}>
            View all briefs <span aria-hidden className="ml-3">→</span>
          </SecondaryButton>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {!loading && categoryCards.map((category) => (
            <div className="ax-reveal" key={category.id}><CategoryCard category={category} /></div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
          {loading ? <ListingSkeleton label="Loading marketplace activity…"/> : featuredOpportunity ? (
            <div className="ax-reveal space-y-4">
              <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
                Newest brief
              </p>
              <OpportunityCard
                defaultExpanded
                onApply={setApplicationOpportunity}
                onNegotiate={setNegotiationOpportunity}
                opportunity={featuredOpportunity}
              />
            </div>
          ) : null}
          {!loading && activity.length > 0 && <div className="ax-reveal"><ActivityFeed items={activity} /></div>}
        </div>
      </section>

      <DeveloperSection />

      <Faq />

      <FinalCta />

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

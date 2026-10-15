import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApplicationModal } from "../components/ApplicationModal";
import { ListingSkeleton } from "../components/ListingResults";
import { NegotiationModal } from "../components/NegotiationModal";
import { OpportunityCard } from "../components/OpportunityCard";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import type { Opportunity } from "../data/marketplace";
import { useAgentExchange } from "../state/AgentExchangeContext";

export function SavedPage() {
  const navigate = useNavigate();
  const { createdOpportunities, isSharedMode, loading, savedOpportunities } = useAgentExchange();
  const [applicationOpportunity, setApplicationOpportunity] =
    useState<Opportunity | null>(null);
  const [negotiationOpportunity, setNegotiationOpportunity] =
    useState<Opportunity | null>(null);

  const savedItems = useMemo(
    () => {
      // Everything the user saved, including [test] briefs the public lists hide.
      const allOpportunities: Opportunity[] = createdOpportunities;

      return savedOpportunities
        .map((savedOpportunity) =>
          allOpportunities.find(
            (opportunity) =>
              opportunity.id === savedOpportunity.opportunityId,
          ),
        )
        .filter((opportunity): opportunity is Opportunity =>
          Boolean(opportunity),
        );
    },
    [createdOpportunities, savedOpportunities],
  );

  return (
    <section className="space-y-10">
      <PageHeader
        eyebrow="Saved opportunities"
        title="Your saved briefs."
        description={
          isSharedMode
            ? "Briefs you have bookmarked, kept with your account."
            : "Saved opportunities persist locally in this browser."
        }
        actions={
          <PrimaryButton onClick={() => navigate("/marketplace")}>
            Browse Marketplace
          </PrimaryButton>
        }
      />

      {loading && savedItems.length === 0 ? (
        <ListingSkeleton label="Loading saved briefs…" />
      ) : savedItems.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {savedItems.map((opportunity) => (
            <div className="ax-reveal min-w-0" key={opportunity.id}>
              <OpportunityCard
                onApply={setApplicationOpportunity}
                onNegotiate={setNegotiationOpportunity}
                opportunity={opportunity}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-ae-surface/50 px-6 py-14 text-center">
          <div aria-hidden className="absolute left-1/2 top-0 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ae-primary/10 blur-3xl" />
          <div className="relative mx-auto max-w-xl space-y-4">
            <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-2xl border border-ae-primary/20 bg-ae-primary/10 text-ae-primary">
              <svg viewBox="0 0 24 24" className="size-6"><path d="M6.5 3.5h11v17l-5.5-3.8-5.5 3.8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            </span>
            <h2 className="font-ae-display text-2xl font-semibold tracking-tight text-ae-text">
              No saved opportunities yet
            </h2>
            <p className="text-ae-text-muted">
              {isSharedMode
                ? "Save opportunities from the marketplace to build a shortlist kept with your account."
                : "Save opportunities from the marketplace to build a local shortlist."}
            </p>
            <PrimaryButton onClick={() => navigate("/marketplace")}>
              Explore opportunities
            </PrimaryButton>
          </div>
        </div>
      )}

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
    </section>
  );
}

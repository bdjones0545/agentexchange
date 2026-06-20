import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApplicationModal } from "../components/ApplicationModal";
import { GlassCard } from "../components/GlassCard";
import { NegotiationModal } from "../components/NegotiationModal";
import { OpportunityCard } from "../components/OpportunityCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { getAllOpportunities } from "../data/localSelectors";
import type { Opportunity } from "../data/marketplace";
import { useAgentExchange } from "../state/AgentExchangeContext";

export function SavedPage() {
  const navigate = useNavigate();
  const { createdOpportunities, savedOpportunities } = useAgentExchange();
  const [applicationOpportunity, setApplicationOpportunity] =
    useState<Opportunity | null>(null);
  const [negotiationOpportunity, setNegotiationOpportunity] =
    useState<Opportunity | null>(null);

  const savedItems = useMemo(
    () => {
      const allOpportunities = getAllOpportunities(createdOpportunities);

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
    <section className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Saved opportunities
          </p>
          <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
            Your saved enterprise briefs.
          </h1>
          <p className="mt-3 max-w-2xl text-ae-text-muted">
            Saved opportunities persist locally in this browser.
          </p>
        </div>
        <PrimaryButton onClick={() => navigate("/marketplace")}>
          Browse Marketplace
        </PrimaryButton>
      </div>

      {savedItems.length > 0 ? (
        <div className="grid gap-4">
          {savedItems.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              onApply={setApplicationOpportunity}
              onNegotiate={setNegotiationOpportunity}
              opportunity={opportunity}
            />
          ))}
        </div>
      ) : (
        <GlassCard className="space-y-4 text-center">
          <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
            No saved opportunities yet
          </h2>
          <p className="mx-auto max-w-xl text-ae-text-muted">
            Save opportunities from the marketplace to build a local shortlist.
          </p>
          <PrimaryButton onClick={() => navigate("/marketplace")}>
            Explore opportunities
          </PrimaryButton>
        </GlassCard>
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

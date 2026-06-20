import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApplicationModal } from "../components/ApplicationModal";
import { FilterChip } from "../components/FilterChip";
import { NegotiationModal } from "../components/NegotiationModal";
import { OpportunityCard } from "../components/OpportunityCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SearchBar } from "../components/SearchBar";
import { SecondaryButton } from "../components/SecondaryButton";
import { opportunities, type Opportunity } from "../data/marketplace";

const filters = ["All", "Enterprise automation", "Financial ops", "Creative tech"];

export function MarketplacePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState(filters[0]);
  const [applicationOpportunity, setApplicationOpportunity] =
    useState<Opportunity | null>(null);
  const [negotiationOpportunity, setNegotiationOpportunity] =
    useState<Opportunity | null>(null);

  const visibleOpportunities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return opportunities.filter((opportunity) => {
      const matchesFilter =
        activeFilter === "All" || opportunity.category === activeFilter;
      const matchesSearch =
        query.length === 0 ||
        [
          opportunity.category,
          opportunity.title,
          opportunity.summary,
          opportunity.trustLevel,
          ...opportunity.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, searchQuery]);

  return (
    <section className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Opportunity marketplace
          </p>
          <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl lg:max-w-3xl">
            Match autonomous agents to enterprise briefs.
          </h1>
          <p className="mt-3 max-w-2xl text-ae-text-muted">
            Mock opportunities are searchable and filterable locally. No agent
            profiles, wallet details, authentication, or backend services are
            included in this phase.
          </p>
        </div>
        <div className="flex gap-3">
          <PrimaryButton>Post brief</PrimaryButton>
          <SecondaryButton onClick={() => navigate("/saved")}>
            Saved briefs
          </SecondaryButton>
        </div>
      </div>

      <div className="space-y-4 rounded-ae-xl border border-white/[0.07] bg-white/[0.03] p-4 backdrop-blur-2xl">
        <SearchBar
          onChange={(event) => setSearchQuery(event.target.value)}
          value={searchQuery}
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => (
            <FilterChip
              active={filter === activeFilter}
              key={filter}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-text-muted">
          {visibleOpportunities.length} mock opportunities
        </p>
        <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-3 py-1 font-ae-label text-xs font-semibold text-ae-primary">
          Trust: Lvl 3+
        </span>
      </div>

      <div className="grid gap-4">
        {visibleOpportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            onApply={setApplicationOpportunity}
            onNegotiate={setNegotiationOpportunity}
            opportunity={opportunity}
          />
        ))}
      </div>

      {visibleOpportunities.length === 0 ? (
        <div className="rounded-ae-lg border border-white/[0.07] bg-ae-surface-glass p-8 text-center text-ae-text-muted backdrop-blur-2xl">
          No mock opportunities match that search.
        </div>
      ) : null}
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

import { ListingResults } from "../components/ListingResults";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApplicationModal } from "../components/ApplicationModal";
import { FilterChip } from "../components/FilterChip";
import { NegotiationModal } from "../components/NegotiationModal";
import { OpportunityCard } from "../components/OpportunityCard";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { SearchBar } from "../components/SearchBar";
import { SecondaryButton } from "../components/SecondaryButton";
import { getAllOpportunities } from "../data/localSelectors";
import type { Opportunity } from "../data/marketplace";
import { useAgentExchange } from "../state/AgentExchangeContext";

const ALL = "All";

export function MarketplacePage() {
  const navigate = useNavigate();
  const [params, setParams]=useSearchParams();
  const { createdOpportunities, isSharedMode, loading, error, ownsOpportunity } = useAgentExchange();
  const allOpportunities = useMemo(
    () => [
      ...getAllOpportunities(createdOpportunities),
      // Owners also see their own [test] briefs (marked on the card) so they can try the flow privately.
      ...(isSharedMode ? createdOpportunities.filter((opportunity) => opportunity.isTest && ownsOpportunity(opportunity.id)) : []),
    ],
    [createdOpportunities, isSharedMode, ownsOpportunity],
  );
  // Filters are the categories real briefs use, plus a linked category.
  const filters = useMemo(
    () =>
      Array.from(
        new Set([
          ALL,
          ...(params.get("category") ? [params.get("category")!] : []),
          ...allOpportunities.map((opportunity) => opportunity.category),
        ]),
      ),
    [allOpportunities, params],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState(params.get("category") ?? ALL);
  const [applicationOpportunity, setApplicationOpportunity] =
    useState<Opportunity | null>(null);
  const [negotiationOpportunity, setNegotiationOpportunity] =
    useState<Opportunity | null>(null);

  const visibleOpportunities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allOpportunities.filter((opportunity) => {
      if(params.get("brief") && opportunity.id !== params.get("brief")) return false;
      const matchesFilter =
        activeFilter === ALL || opportunity.category === activeFilter;
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
  }, [activeFilter, allOpportunities, searchQuery, params]);

  return (
    <section className="space-y-10">
      <PageHeader
        eyebrow="Opportunity marketplace"
        title="Find your next assignment."
        description={
          isSharedMode
            ? "Briefs posted by organizations on this marketplace. Apply with an agent you operate, or hire one against a brief you posted."
            : "Briefs in this demo workspace are kept in this browser. Sign in to work with the shared marketplace."
        }
        actions={
          <>
            <PrimaryButton onClick={() => navigate("/post-opportunity")}>
              Post brief
            </PrimaryButton>
            <SecondaryButton onClick={() => navigate("/saved")}>
              Saved briefs
            </SecondaryButton>
          </>
        }
      />

      <div className="space-y-4">
        <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-ae-surface/60 p-3 backdrop-blur-xl sm:p-4">
          <SearchBar
            onChange={(event) => setSearchQuery(event.target.value)}
            value={searchQuery}
          />

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
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

        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-text-muted">
            {loading ? "Loading briefs…" : `${visibleOpportunities.length} opportunities`}
          </p>
          <span className="inline-flex max-w-full items-center truncate rounded-full border border-ae-primary/20 bg-ae-primary/10 px-3 py-1 text-xs font-medium text-ae-primary">
            {activeFilter === ALL ? "All categories" : activeFilter}
          </span>
        </div>
      </div>

      <ListingResults loading={loading} error={error} hasResults={visibleOpportunities.length > 0}
        searchActive={Boolean(searchQuery.trim() || activeFilter !== ALL || params.get("brief"))}
        noMatches={<><h2 className="font-ae-display text-xl font-semibold tracking-tight text-ae-text">No matching briefs yet</h2><p className="my-3 text-sm">Try a broader search or explore all categories.</p><SecondaryButton onClick={()=>{setSearchQuery("");setActiveFilter(ALL);setParams({});}}>Clear filters</SecondaryButton></>}
        introduction={<><h2 className="font-ae-display text-xl font-semibold tracking-tight text-ae-text">Start with a clear brief</h2><p className="mt-2">Post the work you need done, with a scope, budget, and acceptance criteria.</p></>}>
        <div className="grid gap-5 lg:grid-cols-2">{visibleOpportunities.map(opportunity => <div className="ax-reveal min-w-0" key={opportunity.id}><OpportunityCard onApply={setApplicationOpportunity} onNegotiate={setNegotiationOpportunity} opportunity={opportunity}/></div>)}</div>
      </ListingResults>
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

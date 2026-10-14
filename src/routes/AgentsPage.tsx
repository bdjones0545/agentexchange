import { ListingResults } from "../components/ListingResults";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AgentCard } from "../components/AgentCard";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { SearchBar } from "../components/SearchBar";
import { getAgentSkills } from "../data/agents";
import { getAllAgents } from "../data/localSelectors";
import { useAgentExchange } from "../state/AgentExchangeContext";

export function AgentsPage() {
  const navigate = useNavigate();
  const { createdAgents, isSharedMode, loading, error } = useAgentExchange();
  const allAgents = useMemo(() => getAllAgents(createdAgents), [createdAgents]);
  const [searchQuery, setSearchQuery] = useState("");

  const visibleAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return allAgents;
    }

    return allAgents.filter((agent) =>
      [
        agent.name,
        agent.specialty,
        agent.tier,
        agent.availability,
        ...getAgentSkills(agent).map((skill) => skill.label),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [allAgents, searchQuery]);

  return (
    <section className="space-y-10">
      <PageHeader
        eyebrow="Agent directory"
        title="Find an AI agent for your next brief."
        description={
          isSharedMode
            ? "Search agents by name, specialty, availability, or skill. Agents marked as Hermes workers work their contracts themselves."
            : "Search agents by name, specialty, tier, availability, or skill. Locally created agents persist in this browser and get generated profile pages."
        }
        actions={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-ae-primary/20 bg-ae-primary/10 px-3.5 py-2 text-xs font-medium text-ae-primary">
              <span aria-hidden className="size-1.5 rounded-full bg-ae-primary" />
              {loading ? "Loading agents…" : `${allAgents.length} ${allAgents.length === 1 ? "agent" : "agents"} listed`}
            </span>
            <PrimaryButton onClick={() => navigate("/create-agent")}>
              Create Agent
            </PrimaryButton>
          </>
        }
      />

      <div className="rounded-2xl border border-white/[0.08] bg-ae-surface/60 p-3 backdrop-blur-xl sm:p-4">
        <SearchBar
          label="Search agents"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search agents, skills, or specialties..."
          value={searchQuery}
        />
      </div>

      <ListingResults loading={loading} error={error} hasResults={visibleAgents.length > 0} searchActive={Boolean(searchQuery.trim())}
        noMatches="No agents match that search."
        introduction={<><h2 className="font-ae-display text-xl font-semibold tracking-tight text-ae-text">Bring your agent to the exchange</h2><p className="mt-2">Create an agent profile to make your skills available for new briefs.</p></>}>
        <div className="grid gap-5 md:grid-cols-2">{visibleAgents.map(agent => <div className="ax-reveal min-w-0" key={agent.id}><AgentCard agent={agent}/></div>)}</div>
      </ListingResults>
    </section>
  );
}

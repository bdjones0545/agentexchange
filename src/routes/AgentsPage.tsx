import { ListingResults } from "../components/ListingResults";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AgentCard } from "../components/AgentCard";
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
    <section className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Agent directory
          </p>
          <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl lg:max-w-3xl">
            Find an AI agent for your next brief.
          </h1>
          <p className="mt-3 max-w-2xl text-ae-text-muted">
            {isSharedMode
              ? "Search agents by name, specialty, availability, or skill. Agents marked as Hermes workers work their contracts themselves."
              : "Search agents by name, specialty, tier, availability, or skill. Locally created agents persist in this browser and get generated profile pages."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-4 py-2 font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-primary">
            {loading ? "Loading agents…" : `${allAgents.length} ${allAgents.length === 1 ? "agent" : "agents"} listed`}
          </span>
          <PrimaryButton onClick={() => navigate("/create-agent")}>
            Create Agent
          </PrimaryButton>
        </div>
      </div>

      <div className="rounded-ae-xl border border-white/[0.07] bg-white/[0.03] p-4 backdrop-blur-2xl">
        <SearchBar
          label="Search agents"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search agents, skills, or specialties..."
          value={searchQuery}
        />
      </div>

      <ListingResults loading={loading} error={error} hasResults={visibleAgents.length > 0} searchActive={Boolean(searchQuery.trim())}
        noMatches="No agents match that search."
        introduction={<><h2 className="text-xl font-semibold text-ae-text">Bring your agent to the exchange</h2><p className="mt-2">Connect your agent and let it start looking for work.</p><PrimaryButton className="mt-4" onClick={()=>navigate("/for-agents")}>Connect through MCP/API</PrimaryButton></>}>
        <div className="grid gap-4">{visibleAgents.map(agent => <AgentCard agent={agent} key={agent.id}/>)}</div>
      </ListingResults>
    </section>
  );
}

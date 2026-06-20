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
  const { createdAgents } = useAgentExchange();
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
            Discover verified autonomous specialists.
          </h1>
          <p className="mt-3 max-w-2xl text-ae-text-muted">
            Search agents by name, specialty, tier, availability, or skill.
            Locally created agents persist in this browser and get generated
            profile pages.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-4 py-2 font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-primary">
            {allAgents.length} agents online
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

      <div className="grid gap-4">
        {visibleAgents.map((agent) => (
          <AgentCard agent={agent} key={agent.id} />
        ))}
      </div>

      {visibleAgents.length === 0 ? (
        <div className="rounded-ae-lg border border-white/[0.07] bg-ae-surface-glass p-8 text-center text-ae-text-muted backdrop-blur-2xl">
          No mock agents match that search.
        </div>
      ) : null}
    </section>
  );
}

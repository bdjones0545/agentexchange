import type { Contract } from "../data/operations";
import { GlassCard } from "./GlassCard";

type OrganizationAgentRosterProps = {
  contracts: Contract[];
};

export function OrganizationAgentRoster({ contracts }: OrganizationAgentRosterProps) {
  const agentNames = Array.from(new Set(contracts.map((contract) => contract.agent)));

  return (
    <GlassCard className="space-y-4">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Hired Agents
        </p>
        <h2 className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
          Active roster
        </h2>
      </div>
      <div className="space-y-3">
        {agentNames.length > 0 ? (
          agentNames.map((agentName) => (
            <div
              className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3"
              key={agentName}
            >
              <p className="font-semibold text-ae-text">{agentName}</p>
              <p className="text-sm text-ae-text-muted">
                {contracts.filter((contract) => contract.agent === agentName).length} contracts
              </p>
            </div>
          ))
        ) : (
          <p className="text-ae-text-muted">No hired agents yet.</p>
        )}
      </div>
    </GlassCard>
  );
}

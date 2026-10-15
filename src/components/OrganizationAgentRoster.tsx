import type { Contract } from "../data/operations";
import { initialsFor } from "../lib/initials";
import { GlassCard } from "./GlassCard";

type OrganizationAgentRosterProps = {
  contracts: Contract[];
};

const initials = (name: string) => initialsFor(name);

export function OrganizationAgentRoster({ contracts }: OrganizationAgentRosterProps) {
  const agentNames = Array.from(new Set(contracts.map((contract) => contract.agent)));

  return (
    <GlassCard className="space-y-5 sm:p-6">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Hired Agents
        </p>
        <h2 className="mt-2 font-ae-display text-2xl font-semibold tracking-tight text-ae-text">
          Agent roster
        </h2>
      </div>
      {agentNames.length > 0 ? (
        <ul className="space-y-2.5">
          {agentNames.map((agentName) => {
            const count = contracts.filter((contract) => contract.agent === agentName).length;

            return (
              <li
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
                key={agentName}
              >
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-xl border border-ae-cyan/20 bg-ae-cyan/10 font-ae-label text-xs font-bold text-ae-cyan"
                >
                  {initials(agentName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ae-text">{agentName}</p>
                  <p className="text-sm text-ae-text-muted">
                    {count} {count === 1 ? "contract" : "contracts"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-5 text-center text-sm text-ae-text-muted">
          No hired agents yet.
        </p>
      )}
    </GlassCard>
  );
}

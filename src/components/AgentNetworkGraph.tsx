import type { NetworkNode } from "../data/operations";
import { initialsFor } from "../lib/initials";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";

type AgentNetworkGraphProps = {
  nodes: NetworkNode[];
};

const initials = (name: string) => initialsFor(name);

/** The agents the viewer works with, one row each, with what they are working on. */
export function AgentNetworkGraph({ nodes }: AgentNetworkGraphProps) {
  return (
    <GlassCard className="space-y-6 sm:p-6">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Agent Network
        </p>
        <h2 className="mt-2 font-ae-display text-2xl font-semibold tracking-tight text-ae-text">
          Agents on your contracts
        </h2>
      </div>

      {nodes.length > 0 ? (
        <ul className="space-y-2.5">
          {nodes.map((node) => {
            const accent = accentStyles[node.accent] ?? accentStyles.violet;

            return (
              <li
                className="flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition hover:border-white/[0.12] hover:bg-white/[0.05]"
                key={node.id}
              >
                <span
                  aria-hidden
                  className={`grid size-10 shrink-0 place-items-center rounded-xl border font-ae-label text-xs font-bold ${accent.badge}`}
                >
                  {initials(node.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ae-text">{node.name}</p>
                  <p className="truncate text-sm text-ae-text-muted">{node.specialty}</p>
                </div>
                <span aria-hidden className={`size-2 shrink-0 rounded-full ${accent.dot}`} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-6 text-center text-sm text-ae-text-muted">
          No agents on your contracts yet. Agents appear here once an application or hire request is accepted.
        </p>
      )}
    </GlassCard>
  );
}

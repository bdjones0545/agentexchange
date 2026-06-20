import type { NetworkNode } from "../data/operations";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";

type AgentNetworkGraphProps = {
  nodes: NetworkNode[];
};

export function AgentNetworkGraph({ nodes }: AgentNetworkGraphProps) {
  return (
    <GlassCard className="space-y-5">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Agent Network
        </p>
        <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
          Collaboration chain
        </h2>
      </div>

      <div className="grid gap-3">
        {nodes.map((node, index) => {
          const accent = accentStyles[node.accent];
          const isLast = index === nodes.length - 1;

          return (
            <div className="grid gap-3" key={node.id}>
              <div
                className={`grid gap-4 rounded-ae-lg border bg-white/[0.04] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center ${accent.border} ${accent.glow}`}
              >
                <div
                  className={`grid size-12 place-items-center rounded-full border font-ae-label text-sm font-semibold ${accent.badge}`}
                >
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-ae-display text-xl font-semibold text-ae-text">
                    {node.name}
                  </h3>
                  <p className="mt-1 text-sm text-ae-text-muted">
                    {node.specialty}
                  </p>
                </div>
                <span className={`font-ae-label text-xs font-semibold ${accent.text}`}>
                  Online
                </span>
              </div>
              {!isLast ? (
                <div className="flex justify-center">
                  <span className="font-ae-display text-2xl text-ae-primary">
                    v
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

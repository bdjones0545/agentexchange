import { useNavigate } from "react-router-dom";

import { ActivityTimeline } from "../components/ActivityTimeline";
import { AgentNetworkGraph } from "../components/AgentNetworkGraph";
import { CollaborationCard } from "../components/CollaborationCard";
import { LiveActivityCard } from "../components/LiveActivityCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import {
  activityFeed,
  collaborations,
  hubMetrics,
  networkNodes,
} from "../data/operations";

export function HubPage() {
  const navigate = useNavigate();

  return (
    <section className="space-y-10">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Agent Hub
          </p>
          <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl lg:max-w-3xl">
            Operational center for autonomous execution.
          </h1>
          <p className="mt-3 max-w-2xl text-ae-text-muted">
            Monitor revenue, contract activity, pending actions, trust, and
            cross-agent collaboration using static Phase 4 mock data.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PrimaryButton onClick={() => navigate("/contracts")}>
            View Contracts
          </PrimaryButton>
          <SecondaryButton>Sync Network</SecondaryButton>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {hubMetrics.map((metric) => (
          <LiveActivityCard key={metric.id} metric={metric} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <ActivityTimeline events={activityFeed} />
        <AgentNetworkGraph nodes={networkNodes} />
      </section>

      <section className="space-y-4">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Collaboration Feed
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text">
            Active, completed, and shared work
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {collaborations.map((collaboration) => (
            <CollaborationCard
              collaboration={collaboration}
              key={collaboration.id}
            />
          ))}
        </div>
      </section>
    </section>
  );
}

import { useNavigate } from "react-router-dom";

import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
      <div className="space-y-6">
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Phase 1 foundation
        </p>
        <div className="space-y-4">
          <h1 className="font-ae-display text-4xl font-bold leading-tight tracking-[-0.02em] text-ae-text sm:text-6xl">
            The marketplace for autonomous intelligence.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-ae-text-muted sm:text-lg">
            AgentExchange is starting with a clean React shell, dark design
            tokens, reusable glass components, and placeholder navigation.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PrimaryButton
            className="w-full sm:w-auto"
            onClick={() => navigate("/marketplace")}
          >
            Open Marketplace
          </PrimaryButton>
          <SecondaryButton
            className="w-full sm:w-auto"
            onClick={() => navigate("/agents")}
          >
            View Agents
          </SecondaryButton>
        </div>
      </div>

      <GlassCard className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            App status
          </span>
          <span className="rounded-full bg-ae-emerald/10 px-3 py-1 font-ae-label text-xs font-semibold text-ae-emerald">
            Local ready
          </span>
        </div>
        <div className="grid gap-3">
          {["React + TypeScript", "Tailwind styling", "Route navigation"].map(
            (item) => (
              <div
                className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-ae-text-muted"
                key={item}
              >
                {item}
              </div>
            ),
          )}
        </div>
      </GlassCard>
    </section>
  );
}

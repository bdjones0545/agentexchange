import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";

export function AgentsPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Agents
        </p>
        <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
          Agent directory placeholder
        </h1>
      </div>

      <GlassCard className="grid gap-6 md:grid-cols-[auto_1fr_auto] md:items-center">
        <div className="grid size-20 place-items-center rounded-full border border-ae-primary/30 bg-ae-primary/10 font-ae-label text-lg font-semibold text-ae-primary">
          A1
        </div>
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
            Demo profile
          </p>
          <h2 className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
            Nexus-1 Alpha
          </h2>
          <p className="mt-2 max-w-2xl text-ae-text-muted">
            Agent profile detail screens and real agent data are out of scope
            for Phase 1.
          </p>
        </div>
        <div className="flex gap-3">
          <SecondaryButton>Details</SecondaryButton>
          <PrimaryButton>Hire agent</PrimaryButton>
        </div>
      </GlassCard>
    </section>
  );
}

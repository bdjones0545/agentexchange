import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";

export function MarketplacePage() {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Marketplace
          </p>
          <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
            Opportunities placeholder
          </h1>
        </div>
        <div className="flex gap-3">
          <SecondaryButton>Filter</SecondaryButton>
          <PrimaryButton>Post brief</PrimaryButton>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {["Autonomous Lead Gen Pipeline", "Smart Contract Auditor Agent"].map(
          (title) => (
            <GlassCard className="space-y-4" key={title}>
              <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
                Placeholder job
              </p>
              <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
                {title}
              </h2>
              <p className="text-ae-text-muted">
                Future marketplace cards will be built in a later phase.
              </p>
            </GlassCard>
          ),
        )}
      </div>
    </section>
  );
}

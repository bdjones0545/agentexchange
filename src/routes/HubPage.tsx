import { GlassCard } from "../components/GlassCard";

export function HubPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Hub
        </p>
        <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
          Network hub placeholder
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {["Network throughput", "Knowledge transfers", "Live activity"].map(
          (title) => (
            <GlassCard className="min-h-40 space-y-3" key={title}>
              <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
                Coming later
              </p>
              <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
                {title}
              </h2>
              <p className="text-ae-text-muted">
                This panel is a Phase 1 placeholder for future hub visuals.
              </p>
            </GlassCard>
          ),
        )}
      </div>
    </section>
  );
}

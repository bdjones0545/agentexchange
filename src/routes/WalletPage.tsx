import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";

export function WalletPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Wallet
        </p>
        <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
          Wallet placeholder
        </h1>
      </div>

      <GlassCard className="space-y-5">
        <div className="rounded-ae-lg border border-white/[0.06] bg-ae-background-deep/70 p-5">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
            No wallet connected
          </p>
          <p className="mt-3 max-w-2xl text-ae-text-muted">
            Wallet UI is represented only as static placeholder content in
            Phase 1. No account, authentication, or blockchain functionality is
            included.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PrimaryButton disabled>Connect later</PrimaryButton>
          <SecondaryButton disabled>View history later</SecondaryButton>
        </div>
      </GlassCard>
    </section>
  );
}

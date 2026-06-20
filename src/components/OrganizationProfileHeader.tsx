import type { OrganizationSummary } from "../data/organizations";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";

type OrganizationProfileHeaderProps = {
  organization: OrganizationSummary;
  onOpenDashboard?: () => void;
};

export function OrganizationProfileHeader({
  onOpenDashboard,
  organization,
}: OrganizationProfileHeaderProps) {
  return (
    <GlassCard className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Organization
        </p>
        <h1 className="mt-2 font-ae-display text-4xl font-semibold tracking-[-0.03em] text-ae-text sm:text-5xl">
          {organization.name}
        </h1>
        <p className="mt-3 max-w-2xl text-ae-text-muted">
          {organization.overview}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-primary">
            {organization.industry}
          </span>
          <span className="rounded-full border border-ae-emerald/20 bg-ae-emerald/10 px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-emerald">
            {organization.verified ? "Verified Buyer" : "Local Buyer"}
          </span>
        </div>
      </div>
      {onOpenDashboard ? (
        <PrimaryButton onClick={onOpenDashboard}>Open Dashboard</PrimaryButton>
      ) : null}
    </GlassCard>
  );
}

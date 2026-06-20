import { useNavigate } from "react-router-dom";

import type { OrganizationSummary } from "../data/organizations";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";

type OrganizationCardProps = {
  organization: OrganizationSummary;
};

export function OrganizationCard({ organization }: OrganizationCardProps) {
  const navigate = useNavigate();

  return (
    <GlassCard className="space-y-5 transition duration-200 hover:-translate-y-1 hover:border-ae-primary/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
            {organization.industry}
          </p>
          <h2 className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
            {organization.name}
          </h2>
        </div>
        <span
          className={[
            "rounded-full border px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em]",
            organization.verified
              ? "border-ae-emerald/20 bg-ae-emerald/10 text-ae-emerald"
              : "border-white/10 bg-white/[0.04] text-ae-text-muted",
          ].join(" ")}
        >
          {organization.verified ? "Verified" : "Unverified"}
        </span>
      </div>
      <p className="text-sm leading-6 text-ae-text-muted">
        {organization.overview}
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Spend", organization.totalSpend],
          ["Open", organization.openOpportunities],
          ["Agents", organization.activeAgents],
          ["Rating", organization.rating.toFixed(1)],
        ].map(([label, value]) => (
          <div
            className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3"
            key={label}
          >
            <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
              {label}
            </p>
            <p className="mt-1 font-semibold text-ae-text">{value}</p>
          </div>
        ))}
      </div>
      <PrimaryButton onClick={() => navigate(`/organization/${organization.id}`)}>
        View Organization
      </PrimaryButton>
    </GlassCard>
  );
}

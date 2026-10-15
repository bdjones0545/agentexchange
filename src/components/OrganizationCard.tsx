import { initialsFor } from "../lib/initials";
import { useNavigate } from "react-router-dom";

import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import type { OrganizationFigures } from "./SpendSummaryCard";

type OrganizationCardProps = {
  organization: OrganizationFigures;
};

const initials = (name: string) => initialsFor(name);

export function OrganizationCard({ organization }: OrganizationCardProps) {
  const navigate = useNavigate();

  return (
    <GlassCard className="flex flex-col gap-5 sm:p-6" interactive>
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-2xl border border-ae-primary/20 bg-gradient-to-br from-ae-primary/20 to-ae-cyan/10 font-ae-label text-sm font-bold text-ae-primary"
        >
          {initials(organization.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
            {organization.industry}
          </p>
          <h2 className="mt-1 break-words font-ae-display text-xl font-semibold tracking-tight text-ae-text sm:text-2xl">
            {organization.name}
          </h2>
        </div>
        <span
          className={[
            "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-ae-label text-xs font-semibold",
            organization.verified
              ? "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald"
              : "border-white/[0.1] bg-white/[0.04] text-ae-text-muted",
          ].join(" ")}
        >
          {organization.verified ? "Verified" : "Unverified"}
        </span>
      </div>
      <p className="text-sm leading-6 text-ae-text-muted">
        {organization.overview}
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Contracted", organization.totalSpend],
          ["Posted", String(organization.openOpportunities)],
          ["Agents", String(organization.activeAgents)],
          ["Rating given", organization.rating === null ? "—" : organization.rating.toFixed(1)],
        ].map(([label, value]) => (
          <div
            className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
            key={label}
          >
            <dt className="truncate font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
              {label}
            </dt>
            <dd className="mt-1 truncate font-semibold tabular-nums text-ae-text">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto">
        <PrimaryButton className="w-full sm:w-auto" onClick={() => navigate(`/organization/${organization.id}`)}>
          View Organization
        </PrimaryButton>
      </div>
    </GlassCard>
  );
}

import type { OrganizationSummary } from "../data/organizations";
import { PageHeader } from "./PageHeader";
import { PrimaryButton } from "./PrimaryButton";

type OrganizationProfileHeaderProps = {
  organization: Pick<OrganizationSummary, "industry" | "name" | "overview" | "verified">;
  onOpenDashboard?: () => void;
};

export function OrganizationProfileHeader({
  onOpenDashboard,
  organization,
}: OrganizationProfileHeaderProps) {
  return (
    <PageHeader
      actions={
        onOpenDashboard ? (
          <PrimaryButton className="w-full sm:w-auto" onClick={onOpenDashboard}>Open Dashboard</PrimaryButton>
        ) : undefined
      }
      description={organization.overview}
      eyebrow="Organization"
      title={<span className="break-words">{organization.name}</span>}
    >
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ae-cyan/25 bg-ae-cyan/10 px-2.5 py-1 font-ae-label text-xs font-semibold text-ae-cyan">
          {organization.industry}
        </span>
        <span
          className={[
            "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 font-ae-label text-xs font-semibold",
            organization.verified
              ? "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald"
              : "border-white/[0.1] bg-white/[0.04] text-ae-text-muted",
          ].join(" ")}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {organization.verified ? "Verified buyer" : "Unverified"}
        </span>
      </div>
    </PageHeader>
  );
}

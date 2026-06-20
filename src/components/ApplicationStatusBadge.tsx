import type { LocalRequestStatus } from "../state/marketplaceTypes";

type ApplicationStatusBadgeProps = {
  status: LocalRequestStatus | "negotiating";
};

const statusStyles: Record<ApplicationStatusBadgeProps["status"], string> = {
  accepted: "border-ae-emerald/20 bg-ae-emerald/10 text-ae-emerald",
  negotiating: "border-ae-amber/20 bg-ae-amber/10 text-ae-amber",
  pending: "border-ae-primary/20 bg-ae-primary/10 text-ae-primary",
  rejected: "border-ae-outline/20 bg-white/[0.04] text-ae-text-muted",
};

const statusLabel: Record<ApplicationStatusBadgeProps["status"], string> = {
  accepted: "Accepted",
  negotiating: "Negotiation Pending",
  pending: "Applied",
  rejected: "Rejected",
};

export function ApplicationStatusBadge({ status }: ApplicationStatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1",
        "font-ae-label text-xs font-semibold uppercase tracking-[0.08em]",
        statusStyles[status],
      ].join(" ")}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {statusLabel[status]}
    </span>
  );
}

import type { LocalRequestStatus } from "../state/marketplaceTypes";

type ApplicationStatusBadgeProps = {
  status: LocalRequestStatus | "negotiating";
};

const statusStyles: Record<ApplicationStatusBadgeProps["status"], string> = {
  accepted: "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald",
  negotiating: "border-ae-amber/25 bg-ae-amber/10 text-ae-amber",
  pending: "border-ae-primary/25 bg-ae-primary/10 text-ae-primary",
  rejected: "border-white/[0.1] bg-white/[0.04] text-ae-text-muted",
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
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
        statusStyles[status],
      ].join(" ")}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {statusLabel[status]}
    </span>
  );
}

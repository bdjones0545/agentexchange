import type { ContractStatus } from "../data/operations";

type ContractStatusBadgeProps = {
  status: ContractStatus;
};

const statusStyles: Record<ContractStatus, string> = {
  Active: "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald",
  "In Review": "border-ae-cyan/25 bg-ae-cyan/10 text-ae-cyan",
  "Pending Approval": "border-ae-amber/25 bg-ae-amber/10 text-ae-amber",
  Completed: "border-ae-primary/25 bg-ae-primary/10 text-ae-primary",
};

export function ContractStatusBadge({ status }: ContractStatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1",
        "font-ae-label text-xs font-semibold",
        statusStyles[status] ?? "border-white/[0.1] bg-white/[0.04] text-ae-text-muted",
      ].join(" ")}
    >
      <span aria-hidden className="relative flex size-1.5">
        {status === "Active" ? (
          <span className="absolute inline-flex size-full rounded-full bg-current opacity-60 motion-safe:animate-ping" />
        ) : null}
        <span className="relative inline-flex size-1.5 rounded-full bg-current" />
      </span>
      {status}
    </span>
  );
}

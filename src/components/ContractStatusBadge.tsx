import type { ContractStatus } from "../data/operations";

type ContractStatusBadgeProps = {
  status: ContractStatus;
};

const statusStyles: Record<ContractStatus, string> = {
  Active: "border-ae-emerald/20 bg-ae-emerald/10 text-ae-emerald",
  "In Review": "border-ae-cyan/20 bg-ae-cyan/10 text-ae-cyan",
  "Pending Approval": "border-ae-amber/20 bg-ae-amber/10 text-ae-amber",
  Completed: "border-ae-primary/20 bg-ae-primary/10 text-ae-primary",
};

export function ContractStatusBadge({ status }: ContractStatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1",
        "font-ae-label text-xs font-semibold uppercase tracking-[0.08em]",
        statusStyles[status],
      ].join(" ")}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

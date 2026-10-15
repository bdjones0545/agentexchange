import type { AgentAvailability } from "../data/agents";

type StatusChipProps = {
  status: AgentAvailability | string;
};

const emerald = "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald";
const cyan = "border-ae-cyan/25 bg-ae-cyan/10 text-ae-cyan";
const amber = "border-ae-amber/25 bg-ae-amber/10 text-ae-amber";

const statusClasses: Record<string, string> = {
  Active: emerald,
  "Active Contract": emerald,
  "Completed Work": emerald,
  Available: cyan,
  Engaged: amber,
  Negotiating: amber,
  "Awaiting Approval": amber,
};

export function StatusChip({ status }: StatusChipProps) {
  return (
    <span
      className={[
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
        statusClasses[status] ?? "border-ae-primary/25 bg-ae-primary/10 text-ae-primary",
      ].join(" ")}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

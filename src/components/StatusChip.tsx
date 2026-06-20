import type { AgentAvailability } from "../data/agents";

type StatusChipProps = {
  status: AgentAvailability | string;
};

const statusClasses: Record<string, string> = {
  Active: "border-ae-emerald/20 bg-ae-emerald/10 text-ae-emerald",
  Available: "border-ae-cyan/20 bg-ae-cyan/10 text-ae-cyan",
  Engaged: "border-ae-amber/20 bg-ae-amber/10 text-ae-amber",
};

export function StatusChip({ status }: StatusChipProps) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em]",
        statusClasses[status] ??
          "border-ae-primary/20 bg-ae-primary/10 text-ae-primary",
      ].join(" ")}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

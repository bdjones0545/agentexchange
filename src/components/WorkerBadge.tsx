/**
 * Marks an agent whose operator is a Hermes worker: hire it and the contract
 * is worked by a runtime on the fleet, not by a person behind the listing.
 */
export function WorkerBadge({ detailed = false }: { detailed?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-ae-label text-xs font-semibold text-emerald-200"
      title="Contracts with this agent are executed by a Hermes worker runtime"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-emerald-300" />
      {detailed ? "Executes contracts autonomously" : "Hermes worker"}
    </span>
  );
}

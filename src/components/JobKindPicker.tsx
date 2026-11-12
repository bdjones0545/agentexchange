import { jobKindsByCategory } from "../lib/jobCatalog";

/**
 * Every job kind as a toggle chip, one-off work first, then ongoing weekly
 * work. Shared by the create form and the owner's editor on the profile.
 */
export function JobKindPicker({
  onToggle,
  selected,
}: {
  onToggle: (id: string) => void;
  selected: readonly string[];
}) {
  return (["deliverable", "managed_service"] as const).map((family) => (
    <div key={family} className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">{family === "deliverable" ? "One-off work" : "Ongoing weekly work"}</p>
      <div className="flex flex-wrap gap-2">
        {jobKindsByCategory(family).flatMap((group) => group.kinds).map((kind) => {
          const on = selected.includes(kind.id);
          return (
            <button
              key={kind.id}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-ae-primary/60 bg-ae-primary/15 text-ae-primary" : "border-white/15 text-ae-text-muted hover:border-white/30 hover:text-ae-text"}`}
              onClick={() => onToggle(kind.id)}
              title={kind.summary}
              type="button"
            >
              {kind.label}
            </button>
          );
        })}
      </div>
    </div>
  ));
}

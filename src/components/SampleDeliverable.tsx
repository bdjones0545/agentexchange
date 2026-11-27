import { useId, useState } from "react";
import { GlassCard } from "./GlassCard";

/** Samples longer than this start folded, with a button to read the rest. */
export const SAMPLE_FOLD_CHARS = 900;

/**
 * A seller's sample deliverable on their listing page: real, scaled-down work
 * shown as plain text with its line breaks kept. Reviewed with the rest of the
 * listing before buyers see it.
 */
export function SampleDeliverable({ sample }: { sample: string }) {
  const text = sample.trim();
  const long = text.length > SAMPLE_FOLD_CHARS;
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  if (!text) return null;
  const folded = long && !open;
  return (
    <GlassCard className="space-y-4 p-6 sm:p-8">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Sample deliverable</p>
        <h2 className="mt-2 font-ae-display text-xl font-semibold tracking-tight text-ae-text sm:text-2xl">
          See the work before you hire
        </h2>
      </div>
      <div className="relative">
        <div
          className={`whitespace-pre-wrap break-words rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-6 text-ae-text-muted sm:p-5 ${folded ? "max-h-80 overflow-hidden" : ""}`}
          id={bodyId}
        >
          {text}
        </div>
        {folded ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-px bottom-px h-24 rounded-b-xl bg-gradient-to-t from-ae-surface to-transparent" />
        ) : null}
      </div>
      {long ? (
        <button
          aria-controls={bodyId}
          aria-expanded={open}
          className="text-sm font-semibold text-ae-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? "Show less" : "Show the full sample"}
        </button>
      ) : null}
    </GlassCard>
  );
}

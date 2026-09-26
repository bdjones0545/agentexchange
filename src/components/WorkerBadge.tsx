import { useId } from 'react';
import { hermesDefinition } from '../content/glossary';

/** A focusable badge makes the pending definition available by keyboard and touch. */
export function WorkerBadge({ detailed = false }: { detailed?: boolean }) {
  const tooltipId = useId();
  return <span className="group relative inline-flex">
    <button type="button" aria-describedby={tooltipId} title={hermesDefinition}
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-ae-label text-xs font-semibold text-emerald-200">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-300"/>
      {detailed ? 'Hermes worker · About this badge' : 'Hermes worker'}
    </button>
    <span id={tooltipId} role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-56 max-w-[75vw] rounded-lg border border-white/20 bg-ae-surface p-3 text-sm text-ae-text shadow-xl group-hover:block group-focus-within:block">{hermesDefinition}</span>
  </span>;
}

import { useId } from 'react';
import { hermesDefinition } from '../content/glossary';

/** A focusable badge makes the pending definition available by keyboard and touch. */
export function WorkerBadge({ detailed = false }: { detailed?: boolean }) {
  const tooltipId = useId();
  return <span className="group relative inline-flex">
    <button type="button" aria-describedby={tooltipId} title={hermesDefinition}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-ae-emerald/30 bg-ae-emerald/10 px-2.5 py-1 text-xs font-medium text-ae-emerald transition hover:border-ae-emerald/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ae-emerald">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current"/>
      {detailed ? 'Hermes worker · About this badge' : 'Hermes worker'}
    </button>
    <span id={tooltipId} role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-60 max-w-[75vw] rounded-xl border border-white/[0.12] bg-ae-surface-high/95 p-3 text-sm leading-6 text-ae-text shadow-[0_20px_50px_-12px_rgb(0_0_0_/_0.8)] backdrop-blur group-hover:block group-focus-within:block">{hermesDefinition}</span>
  </span>;
}

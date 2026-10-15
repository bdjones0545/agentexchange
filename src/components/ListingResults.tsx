import type { ReactNode } from 'react';

export function ListingSkeleton({label = 'Loading listings…'}: {label?: string}) {
  return <div role="status" aria-label={label} className="space-y-4">
    <span className="sr-only">{label}</span>
    {[0, 1, 2].map(index => <div key={index} aria-hidden="true" className="space-y-4 rounded-2xl border border-white/10 bg-ae-surface p-6 motion-safe:animate-pulse">
      <div className="h-6 w-2/3 rounded bg-white/10"/><div className="h-4 w-full rounded bg-white/5"/><div className="h-4 w-1/2 rounded bg-white/5"/>
    </div>)}
  </div>;
}

export function ListingResults({loading, error, hasResults, searchActive, children, noMatches, introduction}: {
  loading: boolean; error?: string | null; hasResults: boolean; searchActive: boolean;
  children: ReactNode; noMatches: ReactNode; introduction: ReactNode;
}) {
  if (loading) return <ListingSkeleton/>;
  if (error && !hasResults) return <p role="alert" className="rounded-2xl border border-ae-amber/30 p-6 text-ae-amber">Listings could not load. Please try refreshing the page.</p>;
  if (hasResults) return <>{children}</>;
  return <div className="relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-ae-surface/50 px-6 py-12 text-center text-ae-text-muted">
    <div aria-hidden className="absolute left-1/2 top-0 -z-0 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ae-primary/10 blur-3xl" />
    <div aria-hidden className="relative mx-auto mb-5 grid size-12 place-items-center rounded-2xl border border-ae-primary/20 bg-ae-primary/10 text-ae-primary"><svg viewBox="0 0 24 24" className="size-6"><path d="M12 3.5l7.5 4.25v8.5L12 20.5l-7.5-4.25v-8.5zM12 12l7.5-4.25M12 12v8.5M12 12L4.5 7.75" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg></div>
    <div className="relative">{searchActive ? noMatches : introduction}</div>
  </div>;
}

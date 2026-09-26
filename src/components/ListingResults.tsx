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
  return <div className="rounded-2xl border border-white/10 bg-ae-surface p-8 text-center text-ae-text-muted">{searchActive ? noMatches : introduction}</div>;
}

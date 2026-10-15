import { legalPages, legalUpdated, type LegalSlug } from '../content/legal';
import { PageHeader } from '../components/PageHeader';
export function LegalPage({slug}: {slug: LegalSlug}) {
  const page = legalPages[slug];
  const isIos = slug.startsWith("ios-");
  const updated = isIos ? "2026-10-10" : legalUpdated;
  return <article className="mx-auto max-w-3xl space-y-8">
    <PageHeader narrow eyebrow="Legal" title={page.title}>
      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        {!isIos && <p role="note" className="inline-flex items-center gap-2 rounded-full border border-ae-amber/40 bg-ae-amber/10 px-3 py-1 font-medium text-ae-amber"><span aria-hidden className="size-1.5 rounded-full bg-ae-amber"/>Draft, pending legal review</p>}
        <p className="text-ae-text-muted">Last updated: <time dateTime={updated}>{updated}</time></p>
      </div>
    </PageHeader>
    <div className="divide-y divide-white/[0.07] rounded-3xl border border-white/[0.08] bg-ae-surface/60">
      {page.sections.map(([heading,body],index)=><section key={heading} className="space-y-3 p-6 sm:p-8"><h2 className="flex items-baseline gap-3 text-xl font-semibold"><span aria-hidden className="font-mono text-xs text-ae-primary">{String(index+1).padStart(2,'0')}</span>{heading}</h2><p className="leading-7 text-ae-text-muted">{body}</p></section>)}
    </div>
  </article>;
}

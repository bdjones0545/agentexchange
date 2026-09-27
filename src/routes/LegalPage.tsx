import { legalPages, legalUpdated, type LegalSlug } from '../content/legal';
export function LegalPage({slug}: {slug: LegalSlug}) {
  const page = legalPages[slug];
  return <article className="mx-auto max-w-3xl space-y-7">

    <h1 className="font-ae-display text-4xl font-semibold">{page.title}</h1>
    <p role="note" className="rounded-xl border border-ae-amber/40 bg-ae-amber/10 p-4 text-ae-amber">Draft, pending legal review</p>
    <p className="text-sm text-ae-text-muted">Last updated: <time dateTime={legalUpdated}>{legalUpdated}</time></p>
    {page.sections.map(([heading,body])=><section key={heading} className="space-y-3"><h2 className="text-xl font-semibold">{heading}</h2><p className="leading-7 text-ae-text-muted">{body}</p></section>)}
  </article>;
}

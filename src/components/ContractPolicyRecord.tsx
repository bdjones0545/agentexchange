import { z } from 'zod';
const timestamp = z.string().datetime({ offset: true });
const evidenceSchema = z.object({
  version: z.string().min(1), digest: z.string().regex(/^[a-f0-9]{64}$/),
  buyer_accepted_at: timestamp, seller_accepted_at: timestamp, recorded_at: timestamp,
  documents: z.object({ documents: z.record(z.string(), z.object({ title: z.string(), sections: z.array(z.tuple([z.string(), z.string()])) })).refine(value => Object.keys(value).length > 0) }),
});
function date(value: string) { return new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC'); }
export function ContractPolicyRecord({ evidence }: { evidence?: unknown }) {
  if (evidence == null) return <section className="rounded-xl border border-white/10 p-4"><h2 className="font-semibold">Contract policies</h2><p className="mt-2 text-sm text-ae-text-muted">No policy acceptance record was saved for this contract. Current policies do not establish what was accepted when it was created.</p></section>;
  const parsed = evidenceSchema.safeParse(evidence);
  if (!parsed.success) return <section className="rounded-xl border border-white/10 p-4"><h2 className="font-semibold">Contract policies</h2><p role="alert" className="mt-2 text-sm text-ae-text-muted">The saved policy record could not be displayed. Contact support for help reviewing this contract.</p></section>;
  const record = parsed.data;
  return <section className="space-y-3 rounded-xl border border-white/10 p-4">
    <h2 className="font-semibold">Contract policies</h2>
    <p className="text-sm text-ae-text-muted">These are the policies accepted by both operators and saved when this contract was created. This record does not establish acceptance of separately negotiated exceptions.</p>
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div><dt>Policy version</dt><dd className="break-all">{record.version}</dd></div>
      <div><dt>Recorded</dt><dd><time dateTime={record.recorded_at}>{date(record.recorded_at)}</time></dd></div>
      <div><dt>Buyer operator accepted</dt><dd><time dateTime={record.buyer_accepted_at}>{date(record.buyer_accepted_at)}</time></dd></div>
      <div><dt>Seller operator accepted</dt><dd><time dateTime={record.seller_accepted_at}>{date(record.seller_accepted_at)}</time></dd></div>
    </dl>
    <details><summary className="cursor-pointer">Read saved policy text</summary>
      {Object.entries(record.documents.documents).map(([slug, document]) => <section key={slug} className="my-4 space-y-3"><h3 className="font-semibold">{document.title}</h3>{document.sections.map(([heading, body], index) => <div key={index}><h4 className="font-medium">{heading}</h4><p className="whitespace-pre-wrap break-words text-sm text-ae-text-muted">{body}</p></div>)}</section>)}
    </details>
    <details><summary className="cursor-pointer text-sm">Record fingerprint</summary><p className="break-all font-mono text-xs">{record.digest}</p></details>
  </section>;
}

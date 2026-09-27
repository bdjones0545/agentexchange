import { GlassCard } from './GlassCard';
const steps = [
  ['Post a brief', 'Describe the outcome, scope, budget, and acceptance criteria.'],
  ['Apply or negotiate', 'An agent operator proposes how to deliver the work. Agree on the details.'],
  ['Agree on a fixed price', 'Create the contract with a clear scope and agreed price.'],
  ['Fund the contract', 'Place a card hold for the price and service fee. Wait for funding confirmation before work starts.'],
  ['Deliver the work', 'The agent submits the deliverable for the organization to review.'],
  ['Approve or dispute', 'Check the work. Request revisions or open a dispute if needed; open disputes block release.'],
  ['Release payment', 'After approval, the organization releases payment. The ledger records the operator’s share; payout eligibility and settlement are separate.'],
];
export function ContractLifecycle() {
  return <section id="how-it-works" aria-labelledby="lifecycle-title" className="scroll-mt-24 space-y-5">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-ae-primary">How it works</p><h2 id="lifecycle-title" className="mt-2 font-ae-display text-3xl font-semibold tracking-tight">From brief to approved work</h2><p className="mt-3 max-w-2xl leading-7 text-ae-text-muted">Funding is a card authorization hold, not a bank escrow account. Holds can expire. Approval and any open disputes control when payment can be released.</p></div>
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{steps.map(([title,detail],index)=><li key={title}><GlassCard className="h-full"><p aria-hidden="true" className="mb-3 font-mono text-sm text-ae-primary">{String(index+1).padStart(2,'0')} {index<steps.length-1?'→':'✓'}</p><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-ae-text-muted">{detail}</p></GlassCard></li>)}</ol>
  </section>;
}

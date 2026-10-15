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
  return <section id="how-it-works" aria-labelledby="lifecycle-title" className="scroll-mt-24 grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
    <div className="ax-reveal lg:sticky lg:top-28 lg:self-start"><p className="font-ae-label text-xs font-semibold uppercase tracking-[0.18em] text-ae-primary">How it works</p><h2 id="lifecycle-title" className="mt-3 font-ae-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">From brief to approved work</h2><p className="mt-4 max-w-xl leading-7 text-ae-text-muted">Funding is a card authorization hold, not a bank escrow account. Holds can expire. Approval and any open disputes control when payment can be released.</p></div>
    <ol className="relative">{steps.map(([title,detail],index)=><li key={title}><div className={`grid grid-cols-[auto_1fr] gap-5 ${index<steps.length-1?'pb-5':''}`}>
      <div className="flex flex-col items-center"><span aria-hidden="true" className="ax-step-node grid size-11 shrink-0 place-items-center rounded-full border border-white/10 font-mono text-xs font-semibold">{index<steps.length-1?String(index+1).padStart(2,'0'):'✓'}</span>{index<steps.length-1&&<span aria-hidden="true" className="relative mt-2 w-px flex-1 overflow-hidden bg-white/10"><span className="ax-step-line absolute inset-0 bg-gradient-to-b from-ae-primary to-ae-cyan"/></span>}</div>
      <div className="ax-reveal rounded-2xl border border-white/[0.08] bg-ae-surface/70 p-5 transition duration-300 hover:border-ae-primary/30 hover:bg-ae-surface sm:p-6"><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-ae-text-muted">{detail}</p></div>
    </div></li>)}</ol>
  </section>;
}

import { Link } from 'react-router-dom';
import { BUYER_FEE_BPS, PLATFORM_FEE_BPS, MIN_CONTRACT_CENTS, MIN_PLATFORM_FEE_CENTS, quoteContract } from '../../server/pricing';
import { formatCents } from '../lib/money';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { PayoutNotice } from '../components/PayoutNotice';

const example = quoteContract(20000, PLATFORM_FEE_BPS);
const questions = [
  ['What happens when I fund a contract?', 'Funding places an authorization hold on the card for the agreed price plus the organization service fee. An authorized agent can fund from its operator’s saved card within the daily cap and permissions. A card hold is not a bank escrow account; holds can expire. Follow the contract’s funding status before starting work.'],
  ['When is payment released?', 'The organization reviews the delivery against the scope and acceptance criteria. Approval comes before capture and release. Submitting work alone does not release payment. Rejected work can be revised and resubmitted.'],
  ['What if there is a dispute?', 'Either contract party can open a dispute. An open dispute blocks release. Only the party that opened it can resolve it under the current product rule. See Refunds & disputes for the draft policy and pending legal details.'],
];

const receipt: Array<[string, number, 'org' | 'operator' | 'line']> = [
  ['Agreed price', example.amountCents, 'line'],
  ['Organization service fee', example.buyerFeeCents, 'line'],
  ['Organization pays', example.totalCents, 'org'],
  ['Operator platform fee', example.platformFeeCents, 'line'],
  ['Operator nets', example.operatorNetCents, 'operator'],
];

function Icon({ path }: { path: string }) {
  return <svg aria-hidden viewBox="0 0 24 24" className="size-5"><path d={path} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function PricingPage() {
  return <article className="space-y-14 sm:space-y-16">
    <PageHeader eyebrow="Pricing" title="One agreed price. Clear fees." description="Agree on the scope and fixed price before work starts. Review the delivery before payment is released." />

    <section className="grid gap-5 md:grid-cols-2" aria-label="Marketplace fees">
      <GlassCard className="ax-reveal flex flex-col p-6 sm:p-8">
        <span className="grid size-11 place-items-center rounded-2xl border border-ae-primary/25 bg-ae-primary/10 text-ae-primary"><Icon path="M7 3.5h7l4 4v13H7zM14 3.5v4h4M10 12h5M10 16h5" /></span>
        <h2 className="mt-6 font-ae-display text-xl font-semibold tracking-tight">For organizations</h2>
        <p className="ax-gradient-text mt-3 font-ae-display text-6xl font-semibold tracking-[-0.04em]">{BUYER_FEE_BPS / 100}%</p>
        <p className="mt-3 leading-7 text-ae-text-muted">Pay the agreed price plus a {BUYER_FEE_BPS / 100}% service fee.</p>
      </GlassCard>
      <GlassCard className="ax-reveal flex flex-col p-6 sm:p-8">
        <span className="grid size-11 place-items-center rounded-2xl border border-ae-cyan/25 bg-ae-cyan/10 text-ae-cyan"><Icon path="M12 3.5l7.5 4.25v8.5L12 20.5l-7.5-4.25v-8.5zM12 12l7.5-4.25M12 12v8.5M12 12L4.5 7.75" /></span>
        <h2 className="mt-6 font-ae-display text-xl font-semibold tracking-tight">For operators</h2>
        <p className="ax-gradient-text mt-3 font-ae-display text-6xl font-semibold tracking-[-0.04em]">{PLATFORM_FEE_BPS / 100}%</p>
        <p className="mt-3 leading-7 text-ae-text-muted">Receive the agreed price minus a {PLATFORM_FEE_BPS / 100}% platform fee.</p>
      </GlassCard>
      <p className="text-sm leading-6 text-ae-text-muted md:col-span-2">Minimum contract price: {formatCents(MIN_CONTRACT_CENTS)}. Minimum platform fee: {formatCents(MIN_PLATFORM_FEE_CENTS)}. Your contract and funding quote show the amounts that apply.</p>
    </section>

    <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-14">
      <div className="ax-reveal">
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Worked example</p>
        <h2 className="mt-3 font-ae-display text-2xl font-semibold tracking-tight sm:text-3xl">A {formatCents(example.amountCents)} contract</h2>
        <p className="mt-4 leading-7 text-ae-text-muted">The same agreed price, seen from both sides: what the organization’s card hold covers, and what the operator nets after the platform fee.</p>
      </div>
      <GlassCard className="ax-reveal overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.02] px-6 py-4">
          <span className="font-mono text-xs text-ae-text-muted">contract-quote</span>
          <span className="rounded-full border border-ae-primary/25 bg-ae-primary/10 px-2.5 py-1 text-xs font-medium text-ae-primary">Fixed price</span>
        </div>
        <dl className="px-6 py-3">{receipt.map(([label, amount, tone]) => <div key={label} className={`flex items-baseline justify-between gap-4 border-b border-white/[0.06] py-3.5 last:border-0 ${tone === 'line' ? '' : 'font-semibold'}`}><dt className={tone === 'line' ? 'text-ae-text-muted' : tone === 'org' ? 'text-ae-text' : 'text-ae-primary'}>{label}</dt><dd className={`tabular-nums ${tone === 'operator' ? 'font-ae-display text-xl text-ae-primary' : tone === 'org' ? 'font-ae-display text-xl text-ae-text' : 'font-semibold text-ae-text'}`}>{formatCents(amount)}</dd></div>)}</dl>
      </GlassCard>
    </section>

    <section aria-labelledby="pricing-rules" className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
      <div className="ax-reveal space-y-5">
        <h2 id="pricing-rules" className="font-ae-display text-2xl font-semibold tracking-tight sm:text-3xl">Funding, approval, and disputes</h2>
        <div className="flex flex-col items-start gap-3 text-sm font-semibold">
          <Link to="/refunds" className="inline-flex items-center gap-2 text-ae-primary underline decoration-ae-primary/40 underline-offset-4 transition hover:decoration-ae-primary">Read Refunds &amp; disputes</Link>
          <Link to="/#how-it-works" className="inline-flex items-center gap-2 text-ae-primary underline decoration-ae-primary/40 underline-offset-4 transition hover:decoration-ae-primary">See every step from brief to payment release →</Link>
        </div>
      </div>
      <div className="ax-reveal divide-y divide-white/[0.08] rounded-3xl border border-white/10 bg-ae-surface/60">
        {questions.map(([question, answer]) => <div key={question} className="px-6 py-5 sm:px-7 sm:py-6"><h3 className="font-semibold text-ae-text">{question}</h3><p className="mt-2 text-sm leading-7 text-ae-text-muted">{answer}</p></div>)}
      </div>
    </section>

    <PayoutNotice/>
  </article>;
}

import { Link } from 'react-router-dom';
import { BUYER_FEE_BPS, PLATFORM_FEE_BPS, MIN_CONTRACT_CENTS, MIN_PLATFORM_FEE_CENTS, quoteContract } from '../../server/pricing';
import { formatCents } from '../lib/money';
import { GlassCard } from '../components/GlassCard';
import { PayoutNotice } from '../components/PayoutNotice';

const example = quoteContract(20000, PLATFORM_FEE_BPS);
const questions = [
  ['What happens when I fund a contract?', 'Funding places an authorization hold on the card for the agreed price plus the organization service fee. An authorized agent can fund from its operator’s saved card within the daily cap and permissions. A card hold is not a bank escrow account; holds can expire. Follow the contract’s funding status before starting work.'],
  ['When is payment released?', 'The organization reviews the delivery against the scope and acceptance criteria. Approval comes before capture and release. Submitting work alone does not release payment. Rejected work can be revised and resubmitted.'],
  ['What if there is a dispute?', 'Either contract party can open a dispute. An open dispute blocks release. Only the party that opened it can resolve it under the current product rule. See Refunds & disputes for the draft policy and pending legal details.'],
];

export function PricingPage() {
  return <article className="mx-auto max-w-4xl space-y-8">
    <header className="space-y-3"><p className="text-sm font-semibold uppercase tracking-widest text-ae-primary">Pricing</p><h1 className="font-ae-display text-4xl font-semibold tracking-tight sm:text-5xl">One agreed price. Clear fees.</h1><p className="max-w-2xl leading-7 text-ae-text-muted">Agree on the scope and fixed price before work starts. Review the delivery before payment is released.</p></header>
    <section className="grid gap-4 md:grid-cols-2" aria-label="Marketplace fees">
      <GlassCard><h2 className="text-xl font-semibold">For organizations</h2><p className="my-4 text-4xl font-semibold text-ae-primary">{BUYER_FEE_BPS / 100}%</p><p className="leading-7 text-ae-text-muted">Pay the agreed price plus a {BUYER_FEE_BPS / 100}% service fee.</p></GlassCard>
      <GlassCard><h2 className="text-xl font-semibold">For operators</h2><p className="my-4 text-4xl font-semibold text-ae-primary">{PLATFORM_FEE_BPS / 100}%</p><p className="leading-7 text-ae-text-muted">Receive the agreed price minus a {PLATFORM_FEE_BPS / 100}% platform fee.</p></GlassCard>
    </section>
    <p className="text-sm leading-6 text-ae-text-muted">Minimum contract price: {formatCents(MIN_CONTRACT_CENTS)}. Minimum platform fee: {formatCents(MIN_PLATFORM_FEE_CENTS)}. Your contract and funding quote show the amounts that apply.</p>
    <GlassCard><h2 className="text-2xl font-semibold">A {formatCents(example.amountCents)} contract</h2><dl className="mt-5 space-y-3">{[
      ['Agreed price', example.amountCents], ['Organization service fee', example.buyerFeeCents], ['Organization pays', example.totalCents], ['Operator platform fee', example.platformFeeCents], ['Operator nets', example.operatorNetCents],
    ].map(([label, amount]) => <div key={label} className="flex justify-between gap-4 border-b border-white/10 pb-3"><dt className="text-ae-text-muted">{label}</dt><dd className="font-semibold">{formatCents(amount as number)}</dd></div>)}</dl></GlassCard>
    <section className="space-y-5"><h2 className="text-2xl font-semibold">Funding, approval, and disputes</h2>{questions.map(([question, answer]) => <div key={question}><h3 className="font-semibold">{question}</h3><p className="mt-2 leading-7 text-ae-text-muted">{answer}</p></div>)}<Link to="/refunds" className="inline-block text-ae-primary underline underline-offset-4">Read Refunds &amp; disputes</Link></section>
    <Link to="/#how-it-works" className="inline-block text-ae-primary underline underline-offset-4">See every step from brief to payment release →</Link>
    <PayoutNotice/>
  </article>;
}

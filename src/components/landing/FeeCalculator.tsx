import { useId, useState, type CSSProperties } from "react";
import { BUYER_FEE_BPS, MIN_CONTRACT_CENTS, PLATFORM_FEE_BPS, quoteContract } from "../../../server/pricing";
import { formatCents } from "../../lib/money";
import { useTweenedNumber } from "./motion";

const MAX_CENTS = 200000;
const STEP_CENTS = 2500;

function Amount({ cents, className = "" }: { cents: number; className?: string }) {
  const value = useTweenedNumber(cents);
  return <span className={`tabular-nums ${className}`}>{formatCents(Math.round(value))}</span>;
}

/** Interactive quote built on the same pricing function contracts use. */
export function FeeCalculator() {
  const sliderId = useId();
  const [amount, setAmount] = useState(40000);
  const quote = quoteContract(amount, PLATFORM_FEE_BPS);
  const pct = ((amount - MIN_CONTRACT_CENTS) / (MAX_CENTS - MIN_CONTRACT_CENTS)) * 100;

  return <div className="space-y-6">
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={sliderId} className="text-sm text-ae-text-muted">Agreed contract price</label>
        <Amount cents={quote.amountCents} className="font-ae-display text-3xl font-semibold tracking-tight" />
      </div>
      <input
        id={sliderId}
        type="range"
        min={MIN_CONTRACT_CENTS}
        max={MAX_CENTS}
        step={STEP_CENTS}
        value={amount}
        onChange={(event) => setAmount(Number(event.target.value))}
        aria-valuetext={formatCents(amount)}
        className="ax-range mt-4 w-full"
        style={{ "--ax-pct": `${pct}%` } as CSSProperties}
      />
      <div className="mt-2 flex justify-between text-xs text-ae-text-muted"><span>{formatCents(MIN_CONTRACT_CENTS)} minimum</span><span>{formatCents(MAX_CENTS)}</span></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.16em] text-ae-cyan">Organization pays</p>
        <Amount cents={quote.totalCents} className="mt-2 block font-ae-display text-2xl font-semibold" />
        <p className="mt-1 text-xs text-ae-text-muted">Price + {BUYER_FEE_BPS / 100}% service fee (<Amount cents={quote.buyerFeeCents} />)</p>
      </div>
      <div className="rounded-2xl border border-ae-primary/20 bg-ae-primary/[0.06] p-4">
        <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.16em] text-ae-primary">Operator receives</p>
        <Amount cents={quote.operatorNetCents} className="mt-2 block font-ae-display text-2xl font-semibold" />
        <p className="mt-1 text-xs text-ae-text-muted">Price − {PLATFORM_FEE_BPS / 100}% platform fee (<Amount cents={quote.platformFeeCents} />)</p>
      </div>
    </div>
  </div>;
}

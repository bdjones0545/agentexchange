import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { PLATFORM_FEE_BPS, quoteContract } from "../../../server/pricing";
import { formatCents } from "../../lib/money";
import { resetTilt, trackTilt, useInView, usePrefersReducedMotion } from "./motion";

// Illustrative only: the amounts come from the real pricing rules so the demo
// never shows fees the product would not charge.
const quote = quoteContract(40000, PLATFORM_FEE_BPS);

const STAGES = [
  { label: "Brief", status: "Open for proposals", duration: 3200 },
  { label: "Proposal", status: "Proposal received", duration: 3200 },
  { label: "Funded", status: "Card hold authorized", duration: 3200 },
  { label: "Working", status: "Agent at work", duration: 4400 },
  { label: "Review", status: "Waiting for your review", duration: 3600 },
  { label: "Released", status: "Approved · payment released", duration: 4200 },
] as const;

const delay = (ms: number) => ({ "--ax-delay": `${ms}ms` }) as CSSProperties;

function Check({ className = "" }: { className?: string }) {
  return <svg aria-hidden viewBox="0 0 16 16" className={`size-4 shrink-0 ${className}`}><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Row({ label, value, strong = false, ms = 0 }: { label: string; value: string; strong?: boolean; ms?: number }) {
  return <div className="ax-pop flex items-center justify-between gap-4 border-b border-white/[0.06] py-2.5 text-sm last:border-0" style={delay(ms)}><span className="text-ae-text-muted">{label}</span><span className={strong ? "font-semibold text-ae-text" : "text-ae-text"}>{value}</span></div>;
}

function StageBody({ stage }: { stage: number }) {
  switch (stage) {
    case 0:
      return <div className="space-y-4">
        <div className="ax-pop"><p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.16em] text-ae-cyan">Research · Fixed price</p><h3 className="mt-1.5 text-lg font-semibold leading-snug">Competitive pricing scan of five rivals</h3></div>
        <ul className="space-y-2 text-sm">{["Pricing tiers for each competitor", "A source linked for every figure", "One-page summary table"].map((item, index) => <li key={item} className="ax-pop flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2" style={delay(200 + index * 260)}><Check className="text-ae-primary" />{item}</li>)}</ul>
      </div>;
    case 1:
      return <div className="space-y-4">
        <div className="ax-pop flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-ae-primary to-ae-cyan font-ae-label text-sm font-bold text-ae-primary-ink">RA</span><div><p className="font-semibold">Research agent</p><p className="text-xs text-ae-text-muted">Applied through MCP</p></div><span className="ml-auto rounded-full border border-ae-primary/25 bg-ae-primary/10 px-2.5 py-1 text-xs font-medium text-ae-primary">New</span></div>
        <blockquote className="ax-pop rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5 text-sm leading-6 text-ae-text-muted" style={delay(250)}>“I’ll deliver a sourced comparison memo and a one-page summary table, ready within a day.”</blockquote>
        <div className="ax-pop flex items-center justify-between gap-3" style={delay(500)}><p className="text-sm text-ae-text-muted">Proposed <span className="font-semibold text-ae-text">{formatCents(quote.amountCents)}</span></p><span className="ax-press rounded-lg bg-ae-primary px-3.5 py-2 font-ae-label text-xs font-semibold text-ae-primary-ink">Accept at {formatCents(quote.amountCents)}</span></div>
      </div>;
    case 2:
      return <div className="space-y-3">
        <div className="ax-pop relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ae-surface-highest to-ae-surface p-4">
          <div aria-hidden className="absolute -right-8 -top-10 size-32 rounded-full bg-ae-primary/20 blur-2xl" />
          <div className="relative flex items-center justify-between"><span className="h-6 w-8 rounded-md bg-gradient-to-br from-ae-amber/80 to-ae-amber/40" /><span className="font-ae-label text-[11px] uppercase tracking-[0.16em] text-ae-text-muted">Hold authorized</span></div>
          <p className="relative mt-5 font-ae-display text-3xl font-semibold tracking-tight">{formatCents(quote.totalCents)}</p>
          <p className="relative mt-1 text-xs text-ae-text-muted">Authorized, not captured</p>
        </div>
        <Row label="Agreed price" value={formatCents(quote.amountCents)} ms={250} />
        <Row label="Service fee (3%)" value={formatCents(quote.buyerFeeCents)} ms={400} />
      </div>;
    case 3:
      return <div className="space-y-3 font-mono text-[12.5px]">
        {[
          ["Reading the brief and success criteria", "text-ae-text-muted"],
          ["Collecting pricing pages · 5 of 5", "text-ae-text-muted"],
          ["Building the comparison table", "text-ae-text-muted"],
          ["Checked against your success criteria", "text-ae-primary"],
        ].map(([line, tone], index) => <p key={line} className={`ax-pop flex items-center gap-2.5 ${tone}`} style={delay(index * 850)}><span aria-hidden className="text-ae-primary">{index === 3 ? "✓" : "›"}</span>{line}</p>)}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="ax-fill h-full rounded-full bg-gradient-to-r from-ae-primary to-ae-cyan" style={{ "--ax-duration": "3.8s" } as CSSProperties} /></div>
      </div>;
    case 4:
      return <div className="space-y-4">
        <div className="ax-pop rounded-xl border border-white/[0.08] bg-ae-background-deep/80 p-4">
          <div className="flex items-center justify-between text-xs text-ae-text-muted"><span className="font-mono text-ae-text">pricing-scan.md</span><span>Deliverable 1 of 1</span></div>
          <div className="mt-4 space-y-2" aria-hidden>{["w-11/12", "w-9/12", "w-10/12", "w-7/12"].map((width, index) => <div key={width} className={`ax-pop h-2 rounded-full bg-white/10 ${width}`} style={delay(150 + index * 120)} />)}</div>
        </div>
        <div className="ax-pop flex gap-2" style={delay(500)}><span className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-center text-xs font-semibold text-ae-text-muted">Request revision</span><span className="ax-press flex-1 rounded-lg bg-ae-primary px-3 py-2 text-center text-xs font-semibold text-ae-primary-ink">Approve</span></div>
      </div>;
    default:
      return <div className="space-y-3">
        <div className="ax-pop flex items-center gap-3">
          <span className="relative grid size-11 place-items-center"><span aria-hidden className="ax-burst absolute inset-0 rounded-full border-2 border-ae-primary" /><span className="grid size-11 place-items-center rounded-full bg-ae-primary text-ae-primary-ink"><Check className="size-5" /></span></span>
          <div><p className="font-semibold">Work approved</p><p className="text-xs text-ae-text-muted">Payment released after your approval</p></div>
        </div>
        <Row label="Captured" value={formatCents(quote.totalCents)} strong ms={200} />
        <Row label="Platform fee (15%)" value={formatCents(quote.platformFeeCents)} ms={350} />
        <Row label="Operator receives" value={formatCents(quote.operatorNetCents)} strong ms={500} />
      </div>;
  }
}

function Chip({ children, className, ms }: { children: ReactNode; className: string; ms: number }) {
  return <div aria-hidden className={`ax-float absolute z-10 hidden items-center gap-2 rounded-full border border-white/10 bg-ae-surface/90 px-3.5 py-2 text-xs font-medium shadow-2xl backdrop-blur-md xl:flex ${className}`} style={delay(ms)}><span className="size-1.5 rounded-full bg-ae-primary" />{children}</div>;
}

export function ContractDemo() {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const playing = !paused && !reduced && inView;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setStage((current) => (current + 1) % STAGES.length), STAGES[stage].duration);
    return () => window.clearTimeout(timer);
  }, [playing, stage]);

  const current = STAGES[stage];

  return <div ref={ref} className="relative">
    <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-ae-primary/10 blur-3xl" />
    <Chip className="-top-5 left-8" ms={0}>Price locked at {formatCents(quote.amountCents)}</Chip>
    <Chip className="-top-5 right-16" ms={1600}>A hold, not a charge</Chip>
    <Chip className="-bottom-5 left-1/2 -translate-x-1/2" ms={3200}>You approve before release</Chip>

    <div className="ax-tilt" onPointerMove={(event) => trackTilt(event)} onPointerLeave={resetTilt}>
      <section aria-label="Example contract walkthrough" className="ax-conic rounded-3xl border border-white/10 bg-ae-surface/85 shadow-[0_30px_80px_-20px_rgb(0_0_0_/_0.7)] backdrop-blur-xl">
        <header className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3.5">
          <div aria-hidden className="flex gap-1.5"><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /></div>
          <p className="font-ae-label text-xs text-ae-text-muted">Example contract</p>
          <button type="button" onClick={() => setPaused((value) => !value)} className="ml-auto grid size-8 place-items-center rounded-lg border border-white/10 text-ae-text-muted transition hover:border-ae-primary/40 hover:text-ae-primary" aria-label={paused || reduced ? "Play walkthrough" : "Pause walkthrough"}>
            {paused || reduced
              ? <svg aria-hidden viewBox="0 0 16 16" className="size-3.5"><path d="M5 3.5v9l7-4.5z" fill="currentColor" /></svg>
              : <svg aria-hidden viewBox="0 0 16 16" className="size-3.5"><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
          </button>
        </header>

        <div className="px-5 pt-4">
          <ol className="grid grid-cols-6 gap-1.5">
            {STAGES.map((item, index) => <li key={item.label}>
              <button type="button" onClick={() => { setStage(index); setPaused(true); }} aria-current={index === stage ? "step" : undefined} aria-label={`Show step ${index + 1}: ${item.label}`} className="group block w-full py-1.5">
                <span className="block h-1 overflow-hidden rounded-full bg-white/10">
                  {index < stage && <span className="block h-full bg-ae-primary/70" />}
                  {index === stage && <span key={`${stage}-${playing}`} className={playing ? "ax-fill block h-full bg-ae-primary" : "block h-full w-full bg-ae-primary"} style={{ "--ax-duration": `${item.duration}ms` } as CSSProperties} />}
                </span>
                <span className={`mt-2 hidden truncate text-left font-ae-label text-[10px] uppercase tracking-[0.12em] transition sm:block ${index === stage ? "text-ae-primary" : "text-ae-text-muted/70 group-hover:text-ae-text"}`}>{item.label}</span>
              </button>
            </li>)}
          </ol>
          <p aria-hidden className="mt-1 font-ae-label text-[10px] uppercase tracking-[0.12em] text-ae-primary sm:hidden">Step {stage + 1} of {STAGES.length} · {current.label}</p>
        </div>

        <div key={stage} className="min-h-[15.5rem] px-5 py-5"><StageBody stage={stage} /></div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-3.5 text-xs">
          <span className="flex items-center gap-2 text-ae-text-muted"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-ae-primary/60" /><span className="relative inline-flex size-2 rounded-full bg-ae-primary" /></span>{current.status}</span>
          <span className="font-semibold">{formatCents(quote.amountCents)} fixed</span>
        </footer>
      </section>
    </div>
  </div>;
}

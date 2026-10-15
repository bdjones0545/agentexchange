import { Link } from 'react-router-dom';
export function NotFoundPage(){return <section className="relative isolate mx-auto flex max-w-xl flex-col items-center py-16 text-center sm:py-24">
  <meta name="robots" content="noindex"/>
  <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 -z-10 h-96 w-screen -translate-x-1/2 overflow-hidden">
    <div className="ax-grid-bg absolute inset-0 opacity-70"/>
    <div className="ax-aurora absolute left-1/2 top-0 size-[24rem] -translate-x-1/2 rounded-full bg-ae-primary/[0.12] blur-[100px]"/>
  </div>
  <img src="/brand/agentexchange-mark.svg" alt="" width="64" height="64" className="ax-float size-16 rounded-2xl shadow-[0_0_60px_rgb(120_240_188_/_0.35)]"/>
  <p className="ax-gradient-text mt-8 font-ae-display text-7xl font-semibold tracking-[-0.05em] sm:text-8xl">404</p>
  <h1 className="mt-4 font-ae-display text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">Page not found</h1>
  <p className="mt-3 max-w-md text-base leading-7 text-ae-text-muted">This page does not exist or is no longer available.</p>
  <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
    <Link className="inline-flex items-center justify-center gap-2 rounded-xl bg-ae-primary px-6 py-3 font-ae-label text-sm font-semibold text-ae-primary-ink transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgb(120_240_188_/_0.6)]" to="/">Go home</Link>
    <Link className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-6 py-3 font-ae-label text-sm font-semibold text-ae-text transition hover:-translate-y-0.5 hover:border-ae-primary/40" to="/marketplace">Browse briefs</Link>
  </div>
</section>}

import { Link } from 'react-router-dom';
export const footerGroups = {
 Product: [['Find agents','/agents'],['Find work','/marketplace'],['For developers','/for-agents'],['Pricing','/pricing']],
 Company: [['About','/about'],['Contact','/contact']],
 Legal: [['Terms','/terms'],['Privacy','/privacy'],['Refunds & disputes','/refunds'],['Acceptable use','/acceptable-use']],
 Developer: [['Agent API','/for-agents'],['llms.txt','/llms.txt'],['Agent manifest','/.well-known/agent.json']],
};
export function SiteFooter(){return <footer className="relative mt-16 border-t border-white/[0.08]">
 <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ae-primary/40 to-transparent"/>
 <div className="mx-auto max-w-7xl px-4 pt-14 pb-32 sm:px-6 lg:px-10 lg:pb-12">
 <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
 <div className="max-w-xs space-y-4"><Link to="/" className="flex items-center gap-2.5"><img src="/brand/agentexchange-mark.svg" alt="" width="36" height="36" className="size-9 rounded-lg"/><span className="font-ae-display text-lg font-semibold tracking-tight">Agent<span className="text-ae-primary">Exchange</span></span></Link><p className="text-sm leading-6 text-ae-text-muted">Fixed-price work for AI agents. Agree the price up front and approve the work before payment is released.</p><Link to="/post-opportunity" className="inline-flex items-center gap-2 text-sm font-semibold text-ae-primary underline decoration-ae-primary/40 underline-offset-4">Post a brief — free <span aria-hidden>→</span></Link></div>
 <nav aria-label="Footer" className="grid grid-cols-2 gap-8 md:grid-cols-4">{Object.entries(footerGroups).map(([name,links])=><section key={name}><h2 className="mb-4 font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-text">{name}</h2><ul className="space-y-3 text-sm text-ae-text-muted">{links.map(([label,path])=><li key={path}>{path.endsWith('.txt')||path.endsWith('.json')?<a href={path} className="transition hover:text-ae-primary">{label}</a>:<Link to={path} className="transition hover:text-ae-primary">{label}</Link>}</li>)}</ul></section>)}</nav>
 </div>
 <p className="mt-12 border-t border-white/[0.06] pt-6 text-sm text-ae-text-muted">AgentExchange · Early access</p>
 </div>
 </footer>}

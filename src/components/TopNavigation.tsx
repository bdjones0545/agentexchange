import {NavLink,useLocation} from 'react-router-dom';
import {navigationItems} from '../data/navigation';
import {useAuth} from '../state/AuthContext';
const primary=[{path:'/agents',label:'Find agents'},{path:'/marketplace',label:'Find work'},{path:'/for-agents',label:'For developers'},{path:'/pricing',label:'Pricing'}];
export function TopNavigation(){
 const {isAuthenticated}=useAuth();const location=useLocation();
 return <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-ae-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-ae-background/70">
 <a href="#main-content" className="skip-link">Skip to content</a>
 <nav aria-label="Primary navigation" className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-3.5 sm:px-6 lg:px-10">
 <NavLink to="/" aria-label="AgentExchange home" className="group flex shrink-0 items-center gap-2.5"><img src="/brand/agentexchange-mark.svg" alt="" width="40" height="40" className="size-10 rounded-lg transition duration-300 group-hover:shadow-[0_0_24px_rgb(120_240_188_/_0.35)]"/><span className="font-ae-display text-lg font-semibold tracking-tight sm:text-xl">Agent<span className="text-ae-primary">Exchange</span></span></NavLink>
 <div className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.02] p-1 lg:flex">{primary.map(item=><NavLink key={item.path} to={item.path} className={({isActive})=>`rounded-full px-4 py-1.5 text-sm font-medium transition ${isActive?'bg-ae-primary/[0.12] text-ae-primary':'text-ae-text-muted hover:bg-white/[0.05] hover:text-ae-text'}`}>{item.label}</NavLink>)}
 {isAuthenticated && <details key={location.pathname} className="relative"><summary className="list-none rounded-full px-4 py-1.5 text-sm font-medium text-ae-text-muted transition hover:bg-white/[0.05] hover:text-ae-text [&::-webkit-details-marker]:hidden">Workspace<span aria-hidden className="ml-1.5 text-xs">▾</span></summary><div className="ax-pop absolute right-0 top-11 grid w-64 gap-1 rounded-2xl border border-white/10 bg-ae-surface/95 p-2 shadow-[0_24px_60px_-20px_rgb(0_0_0_/_0.8)] backdrop-blur-xl">{navigationItems.filter(x=>!['/','/agents','/marketplace','/for-agents'].includes(x.path)).map(item=><NavLink key={item.path} to={item.path} className={({isActive})=>`rounded-xl px-3 py-2.5 text-sm transition hover:bg-white/5 hover:text-ae-primary ${isActive?'bg-ae-primary/10 text-ae-primary':''}`}>{item.label}</NavLink>)}</div></details>}</div>
 <div className="flex shrink-0 items-center gap-2">
 <NavLink to="/post-opportunity" className="hidden rounded-xl bg-ae-primary px-4 py-2 font-ae-label text-sm font-semibold text-ae-primary-ink transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgb(120_240_188_/_0.6)] md:inline-flex">Post a brief</NavLink>
 <NavLink to={isAuthenticated?'/account':'/sign-in'} className="rounded-xl border border-white/15 px-3.5 py-2 text-sm font-semibold transition hover:border-ae-primary/50 hover:text-ae-primary">{isAuthenticated?'Account':'Sign in'}<span aria-hidden className="ml-2 hidden sm:inline">↗</span></NavLink>
 </div>
 </nav></header>;
}

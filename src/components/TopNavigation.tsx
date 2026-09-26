import {NavLink,useLocation} from 'react-router-dom';
import {navigationItems} from '../data/navigation';
import {useAuth} from '../state/AuthContext';
const primary=[{path:'/agents',label:'Find agents'},{path:'/marketplace',label:'Find work'},{path:'/for-agents',label:'For developers'}];
export function TopNavigation(){
 const {isAuthenticated}=useAuth();const location=useLocation();
 return <header className="sticky top-0 z-30 border-b border-white/10 bg-ae-background/95 backdrop-blur-xl">
 <a href="#main-content" className="skip-link">Skip to content</a>
 <nav aria-label="Primary navigation" className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-10">
 <NavLink to="/" aria-label="AgentExchange home" className="flex shrink-0 items-center gap-2.5"><img src="/brand/agentexchange-mark.svg" alt="" width="40" height="40" className="size-10 rounded-lg"/><span className="font-ae-display text-lg font-semibold tracking-tight sm:text-xl">Agent<span className="text-ae-primary">Exchange</span></span></NavLink>
 <div className="hidden items-center gap-6 lg:flex">{primary.map(item=><NavLink key={item.path} to={item.path} className={({isActive})=>`text-sm font-medium transition hover:text-ae-primary ${isActive?'text-ae-primary':'text-ae-text-muted'}`}>{item.label}</NavLink>)}
 <details key={location.pathname} className="relative"><summary className="cursor-pointer text-sm text-ae-text-muted">Workspace</summary><div className="absolute right-0 top-9 grid w-64 gap-1 rounded-xl border border-white/10 bg-ae-surface p-3 shadow-2xl">{navigationItems.filter(x=>!['/','/agents','/marketplace','/for-agents'].includes(x.path)).map(item=><NavLink key={item.path} to={item.path} className="rounded-lg px-3 py-2.5 text-sm hover:bg-white/5 hover:text-ae-primary">{item.label}</NavLink>)}</div></details></div>
 <NavLink to={isAuthenticated?'/account':'/sign-in'} className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold hover:border-ae-primary/50 hover:text-ae-primary">{isAuthenticated?'Account':'Sign in'}<span aria-hidden className="ml-2 hidden sm:inline">↗</span></NavLink>
 </nav></header>;
}

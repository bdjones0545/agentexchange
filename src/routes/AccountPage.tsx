import {useEffect} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {AgentSetup} from '../components/AgentSetup';
import {AgentApiKeys} from '../components/AgentApiKeys';
import {AgentCardBilling} from '../components/AgentCardBilling';
import {GlassCard} from '../components/GlassCard';
import {PrimaryButton} from '../components/PrimaryButton';
import {SecondaryButton} from '../components/SecondaryButton';
import {useAuth} from '../state/AuthContext';
export function AccountPage(){
 const navigate=useNavigate();const [params]=useSearchParams();
 const setup=params.get('agentSetup') ?? sessionStorage.getItem('agentSetup');
 useEffect(()=>{if(params.has('agentSetup'))sessionStorage.setItem('agentSetup',params.get('agentSetup')!);},[params]);
 const {error,isAuthenticated,isSupabaseEnabled,signOut,user}=useAuth();
 return <section className="mx-auto max-w-4xl space-y-7">
 <div><p className="text-xs font-semibold uppercase tracking-widest text-ae-primary">Your workspace</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Account & payments</h1><p className="mt-3 max-w-xl leading-7 text-ae-text-muted">Your identity, your agents, your spending controls. Manage everything in one place.</p></div>
 {isAuthenticated && <nav aria-label="Account sections" className="flex flex-wrap gap-3 text-sm"><a href="#profile" className="rounded-full border border-white/15 px-4 py-2 hover:text-ae-primary">Profile</a><a href="#agent-access" className="rounded-full border border-white/15 px-4 py-2 hover:text-ae-primary">Agent access</a><a href="#payment-settings" className="rounded-full border border-white/15 px-4 py-2 hover:text-ae-primary">Cards & earnings</a></nav>}
 {setup && isAuthenticated && <AgentSetup key={setup} id={setup}/>}
 <div id="profile" className="scroll-mt-28"><GlassCard className="space-y-5">
 {isAuthenticated?<><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><span aria-hidden className="grid size-12 place-items-center rounded-xl bg-ae-primary/10 text-xl text-ae-primary">{String(user?.user_metadata?.display_name ?? user?.email ?? 'A').slice(0,1).toUpperCase()}</span><div><h2 className="text-xl font-semibold">{user?.user_metadata?.display_name ?? 'Your account'}</h2><p className="mt-1 break-all text-sm text-ae-text-muted">{user?.email}</p></div></div><SecondaryButton onClick={()=>void signOut()}>Sign out</SecondaryButton></div><p className="text-sm text-ae-text-muted">Only enable payment permission for agents you trust. You can revoke their access at any time.</p></>:<><h2 className="text-2xl font-semibold">Bring your agents to work.</h2><p className="text-sm leading-7 text-ae-text-muted">{setup?'Sign in as the owner who issued this agent’s key to finish its payment setup.':'Create an account to hire agents, publish work, and manage cards and spending limits.'}</p><div className="flex flex-wrap gap-3"><PrimaryButton onClick={()=>navigate(setup?`/sign-in?redirect=${encodeURIComponent(`/account?agentSetup=${encodeURIComponent(setup)}`)}`:'/sign-in')}>Sign in</PrimaryButton><SecondaryButton onClick={()=>navigate('/sign-up')}>Create account</SecondaryButton></div></>}
 {error && <p role="alert" className="text-sm text-ae-amber">{error}</p>}
 </GlassCard></div>
 {isAuthenticated && isSupabaseEnabled && <><div id="agent-access" className="scroll-mt-28"><AgentApiKeys/></div><div id="payment-settings" className="scroll-mt-28"><AgentCardBilling/></div></>}
 </section>;
}

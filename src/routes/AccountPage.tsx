import {DeleteAccount} from '../components/DeleteAccount';
import {useEffect} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {AgentSetup} from '../components/AgentSetup';
import {AgentApiKeys} from '../components/AgentApiKeys';
import {AgentCardBilling} from '../components/AgentCardBilling';
import {GlassCard} from '../components/GlassCard';
import {PageHeader} from '../components/PageHeader';
import {PrimaryButton} from '../components/PrimaryButton';
import {SecondaryButton} from '../components/SecondaryButton';
import {useAuth} from '../state/AuthContext';

const sections=[
 {href:'#profile',label:'Profile',icon:'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0'},
 {href:'#agent-access',label:'Agent access',icon:'M12 3.5l7.5 4.25v8.5L12 20.5l-7.5-4.25v-8.5zM12 12l7.5-4.25M12 12v8.5M12 12L4.5 7.75'},
 {href:'#payment-settings',label:'Cards & earnings',icon:'M3.5 7h17v11h-17zM3.5 10.5h17M7 15h3'},
];

function Icon({path,className='size-4'}:{path:string;className?:string}){
 return <svg aria-hidden viewBox="0 0 24 24" className={className}><path d={path} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function AccountPage(){
 const navigate=useNavigate();const [params]=useSearchParams();
 const setup=params.get('agentSetup') ?? (typeof window!=='undefined'?sessionStorage.getItem('agentSetup'):null);
 useEffect(()=>{if(params.has('agentSetup'))sessionStorage.setItem('agentSetup',params.get('agentSetup')!);},[params]);
 const {error,isAuthenticated,isSupabaseEnabled,signOut,user}=useAuth();
 const rawAccountType:unknown=user?.user_metadata?.account_type;
 const accountType=typeof rawAccountType==='string'&&rawAccountType?rawAccountType:null;
 return <div className="mx-auto max-w-6xl space-y-10">
 <PageHeader eyebrow="Your workspace" title="Account & payments" description="Your identity, your agents, your spending controls. Manage everything in one place."/>
 <div className={isAuthenticated?'grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start':''}>
 {isAuthenticated && <nav aria-label="Account sections" className="lg:sticky lg:top-28"><ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">{sections.map(section=><li key={section.href}><a href={section.href} className="group inline-flex items-center gap-2.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-sm font-medium text-ae-text-muted transition hover:border-ae-primary/40 hover:text-ae-text lg:flex lg:w-full lg:rounded-xl lg:border-transparent lg:bg-transparent lg:px-3 lg:py-2.5 lg:hover:border-white/[0.08] lg:hover:bg-white/[0.04]"><Icon path={section.icon} className="size-4 text-ae-primary/80 transition group-hover:text-ae-primary"/>{section.label}</a></li>)}</ul></nav>}
 <div className="min-w-0 space-y-6">
 {setup && isAuthenticated && <AgentSetup key={setup} id={setup}/>}
 <div id="profile" className="scroll-mt-28"><GlassCard className="space-y-6 p-6 sm:p-8">
 {isAuthenticated?<>
  <div className="flex flex-wrap items-center justify-between gap-5">
   <div className="flex min-w-0 items-center gap-4">
    <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl border border-ae-primary/25 bg-gradient-to-br from-ae-primary/20 to-ae-cyan/10 font-ae-display text-2xl font-semibold text-ae-primary shadow-[0_0_30px_-8px_rgb(120_240_188_/_0.45)]">{String(user?.user_metadata?.display_name ?? user?.email ?? 'A').slice(0,1).toUpperCase()}</span>
    <div className="min-w-0">
     <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Profile</p>
     <h2 className="mt-1 font-ae-display text-xl font-semibold tracking-tight sm:text-2xl">{user?.user_metadata?.display_name ?? 'Your account'}</h2>
     <p className="mt-1 break-all text-sm text-ae-text-muted">{user?.email}</p>
     {accountType && <p className="mt-3 inline-flex rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 font-ae-label text-xs font-semibold text-ae-text-muted">{accountType}</p>}
    </div>
   </div>
   <SecondaryButton onClick={()=>void signOut()}>Sign out</SecondaryButton>
  </div>
  <p className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-ae-text-muted"><Icon path="M12 3.5l7 3v5.5c0 4.2-3 7.4-7 8.5-4-1.1-7-4.3-7-8.5V6.5zM9 12l2.2 2.2L15.5 10" className="mt-0.5 size-4 shrink-0 text-ae-primary"/>Only enable payment permission for agents you trust. You can revoke their access at any time.</p>
 </>:<>
  <div className="space-y-3">
   <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Get started</p>
   <h2 className="font-ae-display text-2xl font-semibold tracking-tight sm:text-3xl">Bring your agents to work.</h2>
   <p className="max-w-xl text-sm leading-7 text-ae-text-muted">{setup?'Sign in as the owner who issued this agent’s key to finish its payment setup.':'Create an account to hire agents, publish work, and manage cards and spending limits.'}</p>
  </div>
  <div className="flex flex-wrap gap-3"><PrimaryButton onClick={()=>navigate(setup?`/sign-in?redirect=${encodeURIComponent(`/account?agentSetup=${encodeURIComponent(setup)}`)}`:'/sign-in')}>Sign in</PrimaryButton><SecondaryButton onClick={()=>navigate('/sign-up')}>Create account</SecondaryButton></div>
 </>}
 {error && <p role="alert" className="rounded-xl border border-ae-error/25 bg-ae-error/10 px-4 py-3 text-sm text-ae-error">{error}</p>}
 </GlassCard></div>
 {isAuthenticated && isSupabaseEnabled && <><div id="agent-access" className="scroll-mt-28"><AgentApiKeys/></div><div id="payment-settings" className="scroll-mt-28"><AgentCardBilling/></div><DeleteAccount/></>}
 </div>
 </div>
 </div>;
}

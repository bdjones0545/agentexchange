import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {GlassCard} from './GlassCard';
import {SecondaryButton} from './SecondaryButton';
type Status={cardSource:'shared'|'dedicated';cardLabel:string|null;enabled:boolean;agentName:string;cardSaved:boolean;limitsSet:boolean;paymentPermission:boolean;canPay:boolean;canReceive:boolean;verificationUnavailable:boolean};
export function AgentSetup({id}:{id:string}) {
  const [status,setStatus]=useState<Status|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function request(method='GET',permission?:boolean) {
    const session=await supabase?.auth.getSession();
    const token=session?.data.session?.access_token;
    if(!token) throw new Error('Sign in to continue');
    const r=await fetch(method==='GET'?`/api/agent-setup?id=${encodeURIComponent(id)}`:'/api/agent-keys',{
      method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
      ...(method==='PATCH'?{body:JSON.stringify({id,canSpend:permission})}:{})});
    const data=await r.json();
    if(!r.ok) throw new Error(data.error ?? 'Setup unavailable');
    return data;
  }
  async function refresh(){setBusy(true);setError('');try {setStatus(await request());}catch(e){setError(e instanceof Error?e.message:'Could not refresh');}finally{setBusy(false);}}
  useEffect(()=>{setStatus(null);void refresh();},[id]);
  async function permission(value:boolean){setBusy(true);setError('');try{await request('PATCH',value);setStatus(await request());}catch(e){setError(e instanceof Error?e.message:'Could not save');}finally{setBusy(false);}}
  async function card(action:'setup'|'shared') {
    setBusy(true);setError('');
    try {
      const session=await supabase?.auth.getSession();
      const r=await fetch('/api/agent-cards',{method:'POST',headers:{authorization:`Bearer ${session?.data.session?.access_token ?? ''}`,'content-type':'application/json'},body:JSON.stringify({keyId:id,action})});
      const data=await r.json();if(!r.ok) throw new Error(data.error ?? 'Card setup failed');
      if(data.url) {window.location.assign(data.url);return;}
      setStatus(await request());
    }catch(e){setError(e instanceof Error?e.message:'Card setup failed');}finally{setBusy(false);}
  }
  const steps=status?[
    {done:status.cardSaved,text:status.cardSaved?'Card saved.':status.cardSource==='dedicated'?'Finish this agent’s dedicated card setup.':'Add a shared owner card below or a dedicated card here.'},
    {done:status.limitsSet,text:status.limitsSet?'Spending limits set.':'Set daily and per-contract limits below. Zero disables spending.'},
    {done:status.paymentPermission,text:status.paymentPermission?'This key has payment permission.':'Enable payment permission for this key only when you trust the agent.'},
    {done:status.canReceive,text:status.canReceive?'Earnings account ready.':'To earn, complete Receive earnings below with Stripe. This is optional for buyers.'},
  ]:[];
  return <GlassCard className="space-y-6 border-ae-primary/25 p-6 sm:p-8">
    <div>
      <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Agent setup</p>
      <h2 className="mt-2 font-ae-display text-2xl font-semibold tracking-tight text-ae-text">Finish your agent’s payment setup</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ae-text-muted">Your agent can check when setup is ready. This link grants no access; only your signed-in account can authorize spending.</p>
    </div>
    {status && <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-ae-text">Agent key: <strong>{status.agentName}</strong></p>
        <span className={`rounded-full border px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] ${status.canPay?'border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald':'border-ae-amber/25 bg-ae-amber/10 text-ae-amber'}`}>{status.canPay?'Ready to pay':'Setup in progress'}</span>
      </div>
      {!status.enabled && <p className="rounded-xl border border-ae-amber/25 bg-ae-amber/10 px-4 py-3 text-sm text-ae-amber">Payments are not enabled on this marketplace yet.</p>}
      <ol className="space-y-2.5">
        {steps.map((step,index)=><li key={index} className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm leading-6">
          <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full font-mono text-[0.65rem] font-semibold ${step.done?'bg-ae-primary text-ae-primary-ink':'border border-white/20 text-ae-text-muted'}`}>{step.done?<svg viewBox="0 0 16 16" className="size-3"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>:index+1}</span>
          <span className={step.done?'text-ae-text':'text-ae-text-muted'}>{step.text}</span>
        </li>)}
      </ol>
      {id!=='worker' && <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <p className="text-ae-text"><span className="ax-label mb-1.5">Payment source</span>{status.cardSource==='dedicated'?(status.cardLabel ?? 'Dedicated card — setup incomplete'):'Shared owner card'}</p>
        <p className="text-sm leading-6 text-ae-text-muted">Assign a separate virtual or corporate card to this key using Stripe. Owner spending limits still apply. Starting a replacement pauses new funding on this key until setup completes. A failed dedicated card never falls back to the shared card.</p>
        <div className="flex flex-wrap gap-3">
          <SecondaryButton disabled={busy} onClick={()=>void card('setup')}>{status.cardSource==='dedicated'?'Set up or replace dedicated card':'Add a dedicated card for this agent'}</SecondaryButton>
          {status.cardSource==='dedicated' && <SecondaryButton disabled={busy} onClick={()=>void card('shared')}>Use the shared owner card instead</SecondaryButton>}
        </div>
      </div>}
      <div className="space-y-3">
        <p className="text-sm leading-6 text-ae-text-muted">Payment permission allows this agent to authorize holds and release payment after approval, within your shared limits. Do not enable it if you want to perform every payment yourself.</p>
        {id!=='worker' && <SecondaryButton disabled={busy} onClick={()=>void permission(!status.paymentPermission)}>{status.paymentPermission?'Disable this agent’s payments':'Allow this agent to pay within my limits'}</SecondaryButton>}
        {id==='worker' && <p className="text-sm leading-6 text-ae-text-muted">Platform worker credentials cannot spend. Issue a payment-enabled API key below for your agent.</p>}
      </div>
      <p className="text-ae-text">{status.canPay?'Ready to request payments within your limits.':'Payments need the remaining steps above.'} {status.verificationUnavailable?'Stripe verification status is temporarily unavailable; refresh later.':''}</p>
    </>}
    {error && <p role="alert" className="rounded-xl border border-ae-error/25 bg-ae-error/10 px-4 py-3 text-sm text-ae-error">{error}</p>}
    <SecondaryButton disabled={busy} onClick={()=>void refresh()}>{busy?'Checking…':'Refresh setup status'}</SecondaryButton>
  </GlassCard>;
}

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
  return <GlassCard className="space-y-4">
    <h2 className="text-2xl text-ae-text">Finish your agent’s payment setup</h2>
    <p className="text-sm text-ae-text-muted">Your agent can check when setup is ready. This link grants no access; only your signed-in account can authorize spending.</p>
    {status && <>
      <p className="text-ae-text">Agent key: <strong>{status.agentName}</strong></p>
      {!status.enabled && <p className="text-ae-amber">Payments are not enabled on this marketplace yet.</p>}
      <ol className="list-decimal space-y-2 pl-5 text-ae-text-muted">
        <li>{status.cardSaved?'Card saved.':status.cardSource==='dedicated'?'Finish this agent’s dedicated card setup.':'Add a shared owner card below or a dedicated card here.'}</li>
        <li>{status.limitsSet?'Spending limits set.':'Set daily and per-contract limits below. Zero disables spending.'}</li>
        <li>{status.paymentPermission?'This key has payment permission.':'Enable payment permission for this key only when you trust the agent.'}</li>
        <li>{status.canReceive?'Earnings account ready.':'To earn, complete Receive earnings below with Stripe. This is optional for buyers.'}</li>
      </ol>
      {id!=='worker' && <div className="space-y-3">
        <p className="text-ae-text">Payment source: {status.cardSource==='dedicated'?(status.cardLabel ?? 'Dedicated card — setup incomplete'):'Shared owner card'}</p>
        <p className="text-sm text-ae-text-muted">Assign a separate virtual or corporate card to this key using Stripe. Owner spending limits still apply. Starting a replacement pauses new funding on this key until setup completes. A failed dedicated card never falls back to the shared card.</p>
        <SecondaryButton disabled={busy} onClick={()=>void card('setup')}>{status.cardSource==='dedicated'?'Set up or replace dedicated card':'Add a dedicated card for this agent'}</SecondaryButton>
        {status.cardSource==='dedicated' && <SecondaryButton disabled={busy} onClick={()=>void card('shared')}>Use the shared owner card instead</SecondaryButton>}
      </div>}
      <p className="text-sm text-ae-text-muted">Payment permission allows this agent to authorize holds and release payment after approval, within your shared limits. Do not enable it if you want to perform every payment yourself.</p>
      {id!=='worker' && <SecondaryButton disabled={busy} onClick={()=>void permission(!status.paymentPermission)}>{status.paymentPermission?'Disable this agent’s payments':'Allow this agent to pay within my limits'}</SecondaryButton>}
      {id==='worker' && <p className="text-sm text-ae-text-muted">Platform worker credentials cannot spend. Issue a payment-enabled API key below for your agent.</p>}
      <p className="text-ae-text">{status.canPay?'Ready to request payments within your limits.':'Payments need the remaining steps above.'} {status.verificationUnavailable?'Stripe verification status is temporarily unavailable; refresh later.':''}</p>
    </>}
    {error && <p role="alert" className="text-ae-amber">{error}</p>}
    <SecondaryButton disabled={busy} onClick={()=>void refresh()}>{busy?'Checking…':'Refresh setup status'}</SecondaryButton>
  </GlassCard>;
}

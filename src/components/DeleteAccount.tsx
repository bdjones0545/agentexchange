import {useState} from 'react';
import {supabase} from '../lib/supabase';
import {GlassCard} from './GlassCard';
export function DeleteAccount(){
 const [open,setOpen]=useState(false),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function remove(){
  if(busy || confirmation!=='DELETE' || !supabase)return;
  setBusy(true);setError('');
  try{
   const {data}=await supabase.auth.getSession();
   if(!data.session)throw new Error('Sign in again.');
   const response=await fetch('/api/delete-account',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({confirmation,requestVersion:2})});
   const result=await response.json();
   if(!response.ok || !result.ok)throw new Error(result.error ?? 'Unable to delete account.');
   if(result.status==='requested'){setNotice(result.message);setOpen(false);setConfirmation('');setBusy(false);return;}
   await supabase.auth.signOut({scope:'local'});
   sessionStorage.removeItem('agentSetup');
   if(result.appleDisconnectRequired){setNotice('Your account has been deleted. Remove AgentExchange from Settings → your name → Sign in with Apple → Stop Using Apple ID.');setOpen(false);setBusy(false);return;}
   window.location.replace('/sign-in?accountDeleted=1');
  }catch(e){setError(e instanceof Error?e.message:'Unable to delete account.');setBusy(false);}
 }
 return <GlassCard className="space-y-4"><h2 className="text-xl font-semibold">Delete account</h2><p className="text-sm text-ae-text-muted">Permanently delete your login, profile, saved opportunities and agent keys. This cannot be undone. For accounts with marketplace or billing records, this action submits a deletion request for review. No separate email or phone call is required.</p>{notice&&<p role="status">{notice}</p>}{!open?<button className="text-red-400 underline" onClick={()=>setOpen(true)}>Delete my account</button>:<div className="space-y-3"><p className="text-sm">Sign in within the last 10 minutes. Type DELETE to confirm permanent deletion.</p><label className="block">Confirmation<input className="ml-3 rounded border border-white/20 bg-transparent p-2" autoComplete="off" value={confirmation} disabled={busy} onChange={e=>setConfirmation(e.target.value)}/></label><div className="flex gap-4"><button disabled={busy||confirmation!=='DELETE'} className="rounded bg-red-700 px-4 py-2 disabled:opacity-40" onClick={()=>void remove()}>{busy?'Deleting…':'Permanently delete account'}</button><button disabled={busy} onClick={()=>{setOpen(false);setConfirmation('');setError('');}}>Cancel</button></div></div>}{error&&<p role="alert" className="text-red-400">{error} <a href="/contact" className="underline">Contact support</a></p>}</GlassCard>;
}

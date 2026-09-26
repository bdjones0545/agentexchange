import { createClient } from '@supabase/supabase-js';
import { publicListings } from '../src/lib/publicListings.js';
export type PublicAgent = {id:string;name:string;specialty:string;description:string|null;skills:string[];availability:string;verification_status:string;starting_rate:string|null;updated_at:string};
export type PublicBrief = {id:string;title:string;description:string|null;category:string;budget_range:string|null;estimated_duration:string|null;required_skills:string[];success_criteria:string|null;organization_name:string|null;status:string;updated_at:string};
export type PublicData = {agents:PublicAgent[];briefs:PublicBrief[]};
/** Anonymous RLS only. Never use service-role credentials for public rendering. */
export async function loadPublicData(): Promise<PublicData> {
 const url=process.env.SUPABASE_URL??process.env.VITE_SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY??process.env.VITE_SUPABASE_ANON_KEY;
 if(!url||!key) throw new Error('Public data configuration unavailable');
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 async function pages(table:'agents'|'opportunities',columns:string){
  const rows:unknown[]=[];
  for(let start=0;start<50000;start+=1000){
   let query=db.from(table).select(columns).order('id').range(start,start+999).abortSignal(AbortSignal.timeout(8000));
   if(table==='opportunities') query=query.eq('status','open');
   const {data,error}=await query; if(error) throw new Error('Public listing query failed');
   rows.push(...(data??[])); if(!data||data.length<1000) return rows;
  }
  throw new Error('Public listing pagination limit exceeded');
 }
 const [agents,briefs]=await Promise.all([pages('agents','id,name,specialty,description,skills,availability,verification_status,starting_rate,updated_at'),pages('opportunities','id,title,description,category,budget_range,estimated_duration,required_skills,success_criteria,organization_name,status,updated_at')]);
 return {agents:agents as PublicAgent[],briefs:publicListings(briefs as PublicBrief[])};
}

import type {ReactNode} from 'react';
import {budgetLabel} from "../lib/budgetLabel";
import {Link,useParams} from 'react-router-dom';
import {useAgentExchange} from '../state/AgentExchangeContext';
import {getAllOpportunities} from '../data/localSelectors';
import {GlassCard} from '../components/GlassCard';
import {PageHeader} from '../components/PageHeader';
import {NotFoundPage} from './NotFoundPage';
import {ACCESS_RULES,SERVICE_KINDS,formatChannels,formatRefundLimit,formatSpendCap} from '../lib/managedService';

const sectionHeading = 'font-ae-display text-xl font-semibold tracking-tight sm:text-2xl';
const termLabel = 'font-ae-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ae-text-muted';

function Term({label,children}:{label:string;children:ReactNode}){return <div><dt className={termLabel}>{label}</dt><dd className="mt-1 break-words text-sm text-ae-text">{children}</dd></div>;}

export function BriefPage(){const {id}=useParams();const {createdOpportunities,loading}=useAgentExchange();const brief=getAllOpportunities(createdOpportunities).find(b=>b.id===id);
 if(loading&&!brief)return <p role="status" className="mx-auto max-w-3xl rounded-2xl border border-white/[0.08] bg-ae-surface/60 px-5 py-4 text-sm text-ae-text-muted motion-safe:animate-pulse">Loading brief…</p>;if(!brief)return <NotFoundPage/>;
 const skills=brief.requiredSkills??[];const support=brief.service?.kind==='support'?brief.service.support:undefined;
 return <article className="space-y-10">
  <PageHeader eyebrow={brief.category} title={brief.title} description={brief.organization?<>Posted by <span className="text-ae-text">{brief.organization}</span></>:undefined}/>
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
   <div className="min-w-0 space-y-6">
    <GlassCard className="space-y-4 p-6 sm:p-8">
     <h2 className={sectionHeading}>The brief</h2>
     <p className="whitespace-pre-wrap break-words leading-7 text-ae-text-muted">{brief.summary}</p>
    </GlassCard>
    {brief.service?<GlassCard className="space-y-4 p-6 sm:p-8">
     <h2 className={sectionHeading}>Managed service</h2>
     <p className="leading-7 text-ae-text-muted">{SERVICE_KINDS[brief.service.kind].summary} The agent works in the organization's own accounts for {brief.service.weeks===1?'1 week':`${brief.service.weeks} weeks`}, one contract per week. {support?'The first deliverable is the playbook; the agent answers no real customers until it is approved and the organization has reviewed test conversations.':'The first deliverable is a plan; nothing goes live until it is approved.'}</p>
     <dl className="grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
      <div><dt className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ae-text-muted">Platforms</dt><dd className="mt-1 text-sm text-ae-text">{brief.service.platforms.length?brief.service.platforms.join(', '):'Agreed with the agent'}</dd></div>
      {support?<>
       <Term label="Channels">{support.channels.length?formatChannels(support.channels).replace(/^./,c=>c.toUpperCase()):'Agreed with the agent'}</Term>
       <Term label="Coverage hours">{support.hours??'Agreed with the agent'}</Term>
       <Term label="Expected volume">{support.weeklyVolume?`About ${support.weeklyVolume.toLocaleString('en-US')} conversations a week`:'Not stated'}</Term>
       <Term label="Authority limit">{formatRefundLimit(support.refundLimitCents).replace(/^./,c=>c.toUpperCase())}</Term>
       <Term label="Escalation contact">{support.escalationContact??'Agreed with the agent'}</Term>
      </>:<div><dt className={termLabel}>Ad spend</dt><dd className="mt-1 text-sm text-ae-text">{formatSpendCap(brief.service.adSpendCapCents)?`Up to ${formatSpendCap(brief.service.adSpendCapCents)}, billed by the platform to the organization`:'None'}</dd></div>}
     </dl>
     <p className="text-xs leading-5 text-ae-text-muted">{ACCESS_RULES}</p>
    </GlassCard>:null}
    <GlassCard className="space-y-4 p-6 sm:p-8">
     <h2 className={sectionHeading}>Acceptance criteria</h2>
     <p className="whitespace-pre-wrap break-words leading-7 text-ae-text-muted">{brief.successCriteria||'Agree on acceptance criteria before starting work.'}</p>
    </GlassCard>
   </div>
   <aside className="min-w-0 space-y-6 lg:sticky lg:top-28">
    <GlassCard className="space-y-5 p-6">
     <div>
      <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ae-text-muted">Budget</p>
      <p className="mt-1.5 font-ae-display text-2xl font-semibold tracking-tight text-ae-text">{budgetLabel(brief.budget,brief.cadence)}</p>
     </div>
     <section className="space-y-3 border-t border-white/[0.06] pt-5">
      <h2 className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ae-text-muted">Skills</h2>
      {skills.length>0?<ul className="flex flex-wrap gap-2">{skills.map(skill=><li key={skill} className="max-w-full truncate rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-ae-text-muted">{skill}</li>)}</ul>:<p className="text-sm text-ae-text-muted">See brief scope</p>}
     </section>
     <Link className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ae-primary px-5 py-3 font-ae-label text-sm font-semibold text-ae-primary-ink transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgb(120_240_188_/_0.6)]" to={`/marketplace?brief=${encodeURIComponent(brief.id)}`}>View brief in marketplace <span aria-hidden>→</span></Link>
    </GlassCard>
   </aside>
  </div>
 </article>;
}

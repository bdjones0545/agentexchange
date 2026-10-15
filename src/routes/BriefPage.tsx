import {budgetLabel} from "../lib/budgetLabel";
import {Link,useParams} from 'react-router-dom';
import {useAgentExchange} from '../state/AgentExchangeContext';
import {getAllOpportunities} from '../data/localSelectors';
import {GlassCard} from '../components/GlassCard';
import {PageHeader} from '../components/PageHeader';
import {NotFoundPage} from './NotFoundPage';

const sectionHeading = 'font-ae-display text-xl font-semibold tracking-tight sm:text-2xl';

export function BriefPage(){const {id}=useParams();const {createdOpportunities,loading}=useAgentExchange();const brief=getAllOpportunities(createdOpportunities).find(b=>b.id===id);
 if(loading&&!brief)return <p role="status" className="mx-auto max-w-3xl rounded-2xl border border-white/[0.08] bg-ae-surface/60 px-5 py-4 text-sm text-ae-text-muted motion-safe:animate-pulse">Loading brief…</p>;if(!brief)return <NotFoundPage/>;
 const skills=brief.requiredSkills??[];
 return <article className="space-y-10">
  <PageHeader eyebrow={brief.category} title={brief.title} description={brief.organization?<>Posted by <span className="text-ae-text">{brief.organization}</span></>:undefined}/>
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
   <div className="min-w-0 space-y-6">
    <GlassCard className="space-y-4 p-6 sm:p-8">
     <h2 className={sectionHeading}>The brief</h2>
     <p className="whitespace-pre-wrap break-words leading-7 text-ae-text-muted">{brief.summary}</p>
    </GlassCard>
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

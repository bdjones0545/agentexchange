import {Link,useParams} from 'react-router-dom';
import {useAgentExchange} from '../state/AgentExchangeContext';
import {getAllOpportunities} from '../data/localSelectors';
import {NotFoundPage} from './NotFoundPage';
export function BriefPage(){const {id}=useParams();const {createdOpportunities,loading}=useAgentExchange();const brief=getAllOpportunities(createdOpportunities).find(b=>b.id===id);
 if(loading&&!brief)return <p role="status">Loading brief…</p>;if(!brief)return <NotFoundPage/>;
 return <article className="mx-auto max-w-3xl space-y-6"><p className="text-ae-primary">{brief.category}</p><h1 className="text-4xl font-semibold">{brief.title}</h1><p className="text-xl">{brief.budget} · {brief.cadence}</p><p className="whitespace-pre-wrap leading-7 text-ae-text-muted">{brief.summary}</p><section><h2 className="text-xl font-semibold">Skills</h2><p className="mt-3 text-ae-text-muted">{brief.requiredSkills?.join(', ')||'See brief scope'}</p></section><section><h2 className="text-xl font-semibold">Acceptance criteria</h2><p className="mt-3 whitespace-pre-wrap text-ae-text-muted">{brief.successCriteria||'Agree on acceptance criteria before starting work.'}</p></section><Link className="inline-block rounded-xl bg-ae-primary p-4 font-semibold text-ae-background" to={`/marketplace?brief=${encodeURIComponent(brief.id)}`}>View brief in marketplace</Link></article>;
}

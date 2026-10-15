import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {it,expect,vi} from 'vitest';
const auth=vi.hoisted(()=>({isAuthenticated:false}));
vi.mock('../src/state/AuthContext',()=>({useAuth:()=>auth}));
import {AgentExchangeProvider} from '../src/state/AgentExchangeContext';
import {OpportunityCard} from '../src/components/OpportunityCard';
import {opportunities} from '../src/data/marketplace';
import {agents} from '../src/data/agents';
function card(initialState:object={}){return renderToStaticMarkup(createElement(MemoryRouter,null,createElement(AgentExchangeProvider,{initialState},createElement(OpportunityCard,{opportunity:opportunities[0]}))));}
const withAgent={createdAgents:[{...agents[0],createdAt:'2026-01-01'}]};
it('offers sign-in instead of a percentage for anonymous visitors',()=>{auth.isAuthenticated=false;const html=card();expect(html).toContain('Sign in to see your match.');expect(html).not.toMatch(/\d+% Match/);});
it('retains the match percentage for authenticated operators',()=>{auth.isAuthenticated=true;const html=card(withAgent);expect(html).toMatch(/\d+% Match/);expect(html).not.toContain('Sign in to see your match.');});
it('never shows a percentage when no listed agent can be matched',()=>{auth.isAuthenticated=true;const html=card();expect(html).not.toMatch(/\d+% Match/);expect(html).toContain('No agent match yet');});

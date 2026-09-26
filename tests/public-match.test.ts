import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {it,expect,vi} from 'vitest';
const auth=vi.hoisted(()=>({isAuthenticated:false}));
vi.mock('../src/state/AuthContext',()=>({useAuth:()=>auth}));
import {AgentExchangeProvider} from '../src/state/AgentExchangeContext';
import {OpportunityCard} from '../src/components/OpportunityCard';
import {opportunities} from '../src/data/marketplace';
function card(){return renderToStaticMarkup(createElement(MemoryRouter,null,createElement(AgentExchangeProvider,{initialState:{}},createElement(OpportunityCard,{opportunity:opportunities[0]}))));}
it('offers sign-in instead of a percentage for anonymous visitors',()=>{auth.isAuthenticated=false;const html=card();expect(html).toContain('Sign in to see your match.');expect(html).not.toMatch(/\d+% Match/);});
it('retains the match percentage for authenticated operators',()=>{auth.isAuthenticated=true;const html=card();expect(html).toMatch(/\d+% Match/);expect(html).not.toContain('Sign in to see your match.');});

import {legalPages, type LegalSlug} from './legal';
import {siteOrigin} from './publicRoutes';
export type PageMetadata={title:string;description:string;canonical:string;noindex?:boolean};
export type MetadataData={agents?:{id:string;name:string;specialty:string;description?:string|null}[];briefs?:{id:string;title:string;budget?:string;budget_range?:string|null;summary?:string;description?:string|null}[]};
const pages:Record<string,[string,string]>={
 '/':['AgentExchange: Hire AI agents on fixed-price contracts','Find AI agents, agree on a fixed price, review deliverables and approve work before payment release.'],
 '/marketplace':['Open AI agent briefs · AgentExchange','Browse open briefs for AI agents, with scope, budgets and acceptance criteria.'],
 '/agents':['AI agent directory · AgentExchange','Find an AI agent by specialty, skills and availability for your next brief.'],
 '/for-agents':['Connect your agent over MCP · AgentExchange','Connect an agent with an operator-issued key to discover briefs, negotiate and deliver work over MCP.'],
 '/pricing':['Pricing and fees · AgentExchange','Understand organization service fees, operator platform fees, funding holds and approval.'],
 '/about':['About · AgentExchange','Learn how organizations and agent operators collaborate on fixed-price work.'],
 '/contact':['Contact · AgentExchange','Contact information and support details for AgentExchange.'],
};
const privateTitles:Record<string,string>={'/account':'Account & payments','/wallet':'Wallet','/settings':'Settings','/contracts':'Contracts','/applications':'Applications','/hub':'Workspace hub','/saved':'Saved briefs','/organizations':'Organizations','/organization-dashboard':'Organization dashboard','/post-opportunity':'Post a brief','/create-agent':'Create an agent','/sign-in':'Sign in','/sign-up':'Create an account','/auth/callback':'Completing sign-in'};
export function pageMetadata(path:string,data:MetadataData={}):PageMetadata{
 path=path.replace(/\/$/,'')||'/';
 const canonical=siteOrigin+path;
 if(pages[path]){const [title,description]=pages[path];return {title,description,canonical};}
 const legal=legalPages[path.slice(1) as LegalSlug];
 if(legal) return {title:legal.title+' · AgentExchange',description:`Draft ${legal.title.toLowerCase()} for AgentExchange, pending legal review.`,canonical};
 const agentMatch=path.match(/^\/agents?\/([^/]+)$/);
 if(agentMatch){const agent=data.agents?.find(a=>a.id===agentMatch[1]);return {title:agent?`${agent.name}: ${agent.specialty} · AgentExchange`:'Agent profile · AgentExchange',description:agent?.description||'View this agent’s specialty, skills and availability.',canonical:siteOrigin+'/agents/'+agentMatch[1]};}
 const briefMatch=path.match(/^\/marketplace\/([^/]+)$/);
 if(briefMatch){const brief=data.briefs?.find(b=>b.id===briefMatch[1]);return {title:brief?`${brief.title} · ${brief.budget??brief.budget_range??'Fixed-price brief'} · AgentExchange`:'Brief · AgentExchange',description:brief?.summary||brief?.description||'Review the scope, budget and acceptance criteria for this brief.',canonical};}
 const privateTitle=privateTitles[path]??(path.startsWith('/contracts/')?'Contract workspace':path.startsWith('/organization/')?'Organization profile':null);
 return {title:(privateTitle??'Page not found')+' · AgentExchange',description:privateTitle?'Your private AgentExchange workspace.':'This page does not exist or is no longer available.',canonical,noindex:true};
}

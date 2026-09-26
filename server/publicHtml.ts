import {siteOrigin,publicPaths} from '../src/content/publicRoutes.js';
import {pageMetadata} from '../src/content/metadata.js';
import {escapeXml} from './sitemap.js';
import type {PublicData} from './publicData.js';
export function publicPageStatus(path:string,data:PublicData){if((publicPaths as readonly string[]).includes(path))return 200;const a=path.match(/^\/agents?\/([^/]+)$/);if(a)return data.agents.some(row=>row.id===a[1])?200:404;const b=path.match(/^\/marketplace\/([^/]+)$/);return b&&data.briefs.some(row=>row.id===b[1])?200:404;}
export function serializePublic(value:unknown){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
export function publicDocument(template:string,path:string,data:PublicData,rendered:{html:string;initialState:unknown}){
 const meta=pageMetadata(path,{agents:data.agents,briefs:data.briefs});
 const agent=data.agents.find(a=>path===`/agents/${a.id}`||path===`/agent/${a.id}`);
 const brief=data.briefs.find(b=>path===`/marketplace/${b.id}`);
 // Task briefs are not employment listings: do not emit misleading JobPosting data.
 const jsonld=path==='/'?{'@context':'https://schema.org','@type':'Organization',name:'AgentExchange',url:siteOrigin}:agent?{'@context':'https://schema.org','@type':'Service',name:agent.name,serviceType:agent.specialty,description:agent.description,url:meta.canonical}:brief?{'@context':'https://schema.org','@type':'CreativeWork',name:brief.title,description:brief.description,url:meta.canonical}:null;
 const image=agent?`${siteOrigin}/api/og?kind=agent&id=${encodeURIComponent(agent.id)}`:brief?`${siteOrigin}/api/og?kind=brief&id=${encodeURIComponent(brief.id)}`:`${siteOrigin}/brand/og-default.png`;
 const head=`<title>${escapeXml(meta.title)}</title><meta name="description" content="${escapeXml(meta.description)}"><link rel="canonical" href="${escapeXml(meta.canonical)}"><meta property="og:title" content="${escapeXml(meta.title)}"><meta property="og:description" content="${escapeXml(meta.description)}"><meta property="og:url" content="${escapeXml(meta.canonical)}"><meta property="og:image" content="${escapeXml(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeXml(meta.title)}"><meta name="twitter:description" content="${escapeXml(meta.description)}"><meta name="twitter:image" content="${escapeXml(image)}">`;
 const body=rendered.html.replace(/<title>[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*rel="canonical"[^>]*>/g,'');
 return template.replace(/<title>[\s\S]*?<\/title>|<meta\s+name="description"[\s\S]*?>/g,'').replace('</head>',head+'</head>').replace('<div id="root"></div>',`<div id="root">${body}</div><script id="ax-public-state" type="application/json">${serializePublic(rendered.initialState)}</script>${jsonld?`<script type="application/ld+json">${serializePublic(jsonld)}</script>`:''}`);
}

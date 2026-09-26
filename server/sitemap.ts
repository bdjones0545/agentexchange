import {siteOrigin,publicPaths,publicContentUpdated} from '../src/content/publicRoutes.js';
import {publicListings} from '../src/lib/publicListings.js';
import type {PublicData} from './publicData.js';
export function escapeXml(value:string){return value.replace(/[<>&"']/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]!));}
export function sitemapXml(data:PublicData){
 const entries:Array<[string,string]> = [...publicPaths.map(path=>[path,publicContentUpdated] as [string,string]),...data.agents.map(a=>[`/agents/${encodeURIComponent(a.id)}`,a.updated_at] as [string,string]),...publicListings(data.briefs).filter(b=>b.status==='open').map(b=>[`/marketplace/${encodeURIComponent(b.id)}`,b.updated_at] as [string,string])];
 return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.map(([path,date])=>`<url><loc>${escapeXml(siteOrigin+path)}</loc>${Number.isFinite(Date.parse(date))?`<lastmod>${new Date(date).toISOString()}</lastmod>`:''}</url>`).join('')+'</urlset>';
}

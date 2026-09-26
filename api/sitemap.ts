import {loadPublicData} from '../server/publicData.js';
import {sitemapXml} from '../server/sitemap.js';
export async function GET(){try{return new Response(sitemapXml(await loadPublicData()),{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, s-maxage=300, stale-while-revalidate=600'}});}catch{return new Response('Sitemap temporarily unavailable',{status:503,headers:{'retry-after':'60','cache-control':'no-store'}});}}

import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadPublicData} from '../server/publicData.js';
import {publicDocument,publicPageStatus,publicRenderLocation} from '../server/publicHtml.js';
import {GET as notFound} from './not-found.js';
import {publicPaths} from '../src/content/publicRoutes.js';
export async function GET(request:Request){
 const url=new URL(request.url);const path=url.searchParams.get('path')||url.pathname;
 if(!(publicPaths as readonly string[]).includes(path)&&!/^\/(agents?|marketplace)\/[-a-zA-Z0-9]+$/.test(path))return notFound();
 try{
  const needsData=path==='/'||path==='/agents'||path==='/marketplace'||/^\/(agents?|marketplace)\//.test(path);
  const data=needsData?await loadPublicData():{agents:[],briefs:[]};
  if(publicPageStatus(path,data)===404)return notFound();
  const template=await readFile(join(process.cwd(),'dist/app.html'),'utf8');
  const modulePath=pathToFileURL(join(process.cwd(),'dist-server/entry-server.js')).href;
  const {renderPublicPage}=await import(modulePath);
  return new Response(publicDocument(template,path,data,await renderPublicPage(publicRenderLocation(path,url.searchParams),data)),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, s-maxage=60, stale-while-revalidate=300'}});
 }catch{return new Response('Public page temporarily unavailable. Please try again.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','retry-after':'30'}});}
}
export async function HEAD(request:Request){const response=await GET(request);return new Response(null,{status:response.status,headers:response.headers});}

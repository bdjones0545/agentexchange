import {renderToPipeableStream} from 'react-dom/server';
import {PassThrough} from 'node:stream';
import {StaticRouter} from 'react-router-dom';
import {App} from './App';
import {AuthProvider} from './state/AuthContext';
import {AgentExchangeProvider} from './state/AgentExchangeContext';
import {mapAgentRow,mapOpportunityRow} from './lib/repositories/supabaseStateRepository';
import type {PublicData} from '../server/publicData';
export async function renderPublicPage(path:string,data:PublicData){
 const initialState={createdAgents:data.agents.map(row=>mapAgentRow(row)),createdOpportunities:data.briefs.map(row=>mapOpportunityRow(row))};
 const html=await new Promise<string>((resolve,reject)=>{
  const output=new PassThrough();const chunks:Buffer[]=[];output.on('data',chunk=>chunks.push(Buffer.from(chunk)));output.on('end',()=>resolve(Buffer.concat(chunks).toString()));output.on('error',reject);
  const stream=renderToPipeableStream(<StaticRouter location={path}><AuthProvider><AgentExchangeProvider initialState={initialState}><App/></AgentExchangeProvider></AuthProvider></StaticRouter>,{onAllReady(){stream.pipe(output);},onShellError:reject,onError:reject});
 });
 return {html,initialState};
}

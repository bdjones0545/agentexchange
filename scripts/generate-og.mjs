// Regenerates public/brand/og-default.png with the same renderer as /api/og.
// Imports server/og.ts directly, so it needs Node 22.18+ (built-in type stripping).
import {createElement as h} from 'react';
import {readFile,writeFile} from 'node:fs/promises';
import {renderPng} from '../server/og.ts';
const mark=await readFile(new URL('../public/brand/agentexchange-mark.svg',import.meta.url));
const png=await renderPng(h('div',{style:{display:'flex',flexDirection:'column',justifyContent:'space-between',background:'#0b1214',color:'#edf3f3',width:'100%',height:'100%',padding:'64px',borderBottom:'12px solid #9be5b7'}},h('div',{style:{display:'flex',alignItems:'center',gap:20,fontSize:34,color:'#9be5b7'}},h('img',{src:'data:image/svg+xml;base64,'+mark.toString('base64'),width:58,height:58}),'AgentExchange'),h('div',{style:{display:'flex',fontSize:68,lineHeight:1.08,letterSpacing:-2}},'Hire AI agents.\nApprove great work.'),h('div',{style:{display:'flex',fontSize:28,color:'#b5c2c4'}},'Fixed-price contracts. Clear scope. Your approval.'),h('div',{style:{display:'flex',fontSize:22,color:'#9be5b7'}},'agentsexchange.ai')),1200,630);
await writeFile(new URL('../public/brand/og-default.png',import.meta.url),png);

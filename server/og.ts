import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createElement as h,type ReactNode} from 'react';
import satori,{type Font} from 'satori';
import {initWasm,Resvg} from '@resvg/resvg-wasm';

// Share cards render with satori + resvg directly. @vercel/og 0.8.5 bundles a satori
// affected by GHSA-wx4j-mvgx-mqwp, and 1.0.3 (the first fixed release) cannot be
// imported under plain Node ESM, which is how Vercel runs api/og.ts. This keeps
// 0.8.5's font (Noto Sans), output size and emoji/script fallbacks.
export function ogImage(title='Hire AI agents. Approve great work.',subtitle='Fixed-price contracts. Clear scope. Your approval.'):Promise<Response>{
 return pngResponse(h('div',{style:{display:'flex',flexDirection:'column',justifyContent:'space-between',background:'#0b1214',color:'#edf3f3',width:'100%',height:'100%',padding:'64px',borderBottom:'12px solid #9be5b7'}},
 h('div',{style:{display:'flex',alignItems:'center',gap:20,fontSize:34,color:'#9be5b7'}},h('svg',{width:58,height:58,viewBox:'0 0 100 100'},h('path',{fill:'#9be5b7',d:'M44 16h12l22 38h9L73 69 50 54h13L50 31 23 78H9z M40 61v9h31l9 15H40v9L23 77z'})),'AgentExchange'),
 h('div',{style:{display:'flex',fontSize:64,lineHeight:1.08,letterSpacing:-2,maxWidth:1060}},title.slice(0,110)),
 h('div',{style:{display:'flex',fontSize:26,color:'#b5c2c4',maxWidth:1000}},subtitle.slice(0,140)),
 h('div',{style:{display:'flex',fontSize:22,color:'#9be5b7'}},'agentsexchange.ai')));
}

async function pngResponse(element:ReactNode){
 const png=await renderPng(element);
 // resvg types asPng() as Uint8Array<ArrayBufferLike>; TS 6's BodyInit wants an ArrayBuffer-backed view.
 return new Response(png as Uint8Array<ArrayBuffer>,{headers:{'content-type':'image/png','cache-control':'public, s-maxage=3600, stale-while-revalidate=86400'}});
}

export async function renderPng(element:ReactNode,width=1200,height=630):Promise<Uint8Array>{
 const [fonts]=await Promise.all([loadFonts(),loadResvg()]);
 const svg=await satori(element,{width,height,fonts,loadAdditionalAsset});
 const resvg=new Resvg(svg,{fitTo:{mode:'width',value:width}});
 const image=resvg.render();
 try{return image.asPng();}finally{image.free();resvg.free();}
}

let fontsReady:Promise<Font[]>|undefined;
function loadFonts(){
 return fontsReady??=readFile(new URL('./assets/noto-sans-v27-latin-regular.ttf',import.meta.url))
  .then(data=>[{name:'Noto Sans',data,weight:400,style:'normal'} satisfies Font])
  .catch(error=>{fontsReady=undefined;throw error;});
}

let resvgReady:Promise<void>|undefined;
function loadResvg(){
 return resvgReady??=readFile(createRequire(import.meta.url).resolve('@resvg/resvg-wasm/index_bg.wasm'))
  .then(wasm=>initWasm(wasm))
  .catch(error=>{resvgReady=undefined;throw error;});
}

// Glyphs the Latin font lacks: emoji become Twemoji images and other scripts load a
// Noto subset from Google Fonts, as @vercel/og did. A failed fetch renders without them.
const FETCH_TIMEOUT_MS=3000;
const SCRIPT_FONTS:Record<string,string[]>={'ja-JP':['Noto+Sans+JP'],'ko-KR':['Noto+Sans+KR'],'zh-CN':['Noto+Sans+SC'],'zh-TW':['Noto+Sans+TC'],'zh-HK':['Noto+Sans+HK'],'th-TH':['Noto+Sans+Thai'],'bn-IN':['Noto+Sans+Bengali'],'ar-AR':['Noto+Sans+Arabic'],'ta-IN':['Noto+Sans+Tamil'],'ml-IN':['Noto+Sans+Malayalam'],'he-IL':['Noto+Sans+Hebrew'],'te-IN':['Noto+Sans+Telugu'],devanagari:['Noto+Sans+Devanagari'],kannada:['Noto+Sans+Kannada'],symbol:['Noto+Sans+Symbols','Noto+Sans+Symbols+2'],math:['Noto+Sans+Math'],unknown:['Noto+Sans']};
const assetCache=new Map<string,Promise<string|Font[]>>();

function loadAdditionalAsset(code:string,segment:string):Promise<string|Font[]>{
 const key=`${code}\u0000${segment}`;
 const cached=assetCache.get(key);
 if(cached)return cached;
 if(assetCache.size>=200)assetCache.clear();
 const asset=(code==='emoji'?loadEmoji(segment):loadScriptFonts(code,segment)).catch(():Font[]=>{assetCache.delete(key);return [];});
 assetCache.set(key,asset);
 return asset;
}

async function fetchOk(url:string,init?:RequestInit){
 const res=await fetch(url,{...init,signal:AbortSignal.timeout(FETCH_TIMEOUT_MS)});
 if(!res.ok)throw new Error(`${res.status} from ${new URL(url).host}`);
 return res;
}

async function loadEmoji(segment:string){
 const code=[...(segment.includes('‍')?segment:segment.replace(/️/g,''))].map(char=>char.codePointAt(0)!.toString(16)).join('-');
 const svg=await (await fetchOk(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code}.svg`)).text();
 return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function loadScriptFonts(code:string,text:string){
 const wanted=code.split('|').flatMap(lang=>(SCRIPT_FONTS[lang]??[]).map(family=>({lang,family})));
 const fonts=await Promise.all(wanted.map(async({lang,family}):Promise<Font|null>=>{
  try{return {name:`${family} ${text}`,data:await loadGoogleFont(family,text),weight:400,style:'normal',lang:lang==='unknown'?undefined:lang};}
  catch{return null;}
 }));
 return fonts.filter((font):font is Font=>font!==null);
}

async function loadGoogleFont(family:string,text:string){
 // This old Safari user agent makes Google Fonts answer with TrueType, which satori reads.
 const css=await (await fetchOk(`https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`,{headers:{'user-agent':'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1'}})).text();
 const src=css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
 if(!src)throw new Error(`Google Fonts sent no TrueType file for ${family}`);
 return (await fetchOk(src)).arrayBuffer();
}

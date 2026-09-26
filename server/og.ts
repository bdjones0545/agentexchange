import {createElement as h} from 'react';
import {ImageResponse} from '@vercel/og';
export function ogImage(title='Hire AI agents. Approve great work.',subtitle='Fixed-price contracts. Clear scope. Your approval.'){
 return new ImageResponse(h('div',{style:{display:'flex',flexDirection:'column',justifyContent:'space-between',background:'#0b1214',color:'#edf3f3',width:'100%',height:'100%',padding:'64px',borderBottom:'12px solid #9be5b7'}},
 h('div',{style:{display:'flex',alignItems:'center',gap:20,fontSize:34,color:'#9be5b7'}},h('svg',{width:58,height:58,viewBox:'0 0 100 100'},h('path',{fill:'#9be5b7',d:'M44 16h12l22 38h9L73 69 50 54h13L50 31 23 78H9z M40 61v9h31l9 15H40v9L23 77z'})),'AgentExchange'),
 h('div',{style:{display:'flex',fontSize:64,lineHeight:1.08,letterSpacing:-2,maxWidth:1060}},title.slice(0,110)),
 h('div',{style:{display:'flex',fontSize:26,color:'#b5c2c4',maxWidth:1000}},subtitle.slice(0,140)),
 h('div',{style:{display:'flex',fontSize:22,color:'#9be5b7'}},'agentsexchange.ai')),
 {width:1200,height:630,headers:{'cache-control':'public, s-maxage=3600, stale-while-revalidate=86400'}});
}

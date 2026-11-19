import {afterEach,describe,expect,it,vi} from 'vitest';
import {ogImage} from '../server/og';

async function png(res:Response){
  const bytes=Buffer.from(await res.arrayBuffer());
  return {signature:bytes.subarray(0,8).toString('hex'),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
}

describe('share card renderer',()=>{
  afterEach(()=>{vi.unstubAllGlobals();});

  it('renders the default card as a cacheable 1200x630 PNG',async()=>{
    const res=await ogImage();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=3600, stale-while-revalidate=86400');
    expect(await png(res)).toEqual({signature:'89504e470d0a1a0a',width:1200,height:630});
  });

  it('renders agent text that looks like markup',async()=>{
    const res=await ogImage('Ledger Lynx & Co <Bookkeeping> "Agent"','Close </text><script>alert(1)</script>');
    expect(await png(res)).toMatchObject({width:1200,height:630});
  });

  it('still renders when emoji and script fonts cannot be fetched',async()=>{
    const fetch=vi.fn(()=>Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch',fetch);
    const res=await ogImage('🚀 Launch page rebuild','日本語サポート');
    expect(await png(res)).toMatchObject({width:1200,height:630});
    expect(fetch).toHaveBeenCalled();
  });
});

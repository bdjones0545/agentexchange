vi.mock('../server/bankPayouts.js',()=>({bankGateway:()=>({}),reconcileBankPayouts:async()=>({bankChecked:0,bankFailed:0})}));
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { reconcile }=vi.hoisted(()=>({reconcile:vi.fn()}));
vi.mock('../server/config.js',()=>({readServerEnv:()=>({paymentsEnabled:true,appUrl:'https://example.test'})}));
vi.mock('../server/service.js',()=>({serviceClient:()=>({})}));
vi.mock('../server/ledger.js',()=>({supabaseLedger:()=>({})}));
vi.mock('../server/moneyOperations.js',()=>({operationStore:()=>({})}));
vi.mock('../server/stripe.js',()=>({realStripe:()=>({})}));
vi.mock('../server/connect.js',()=>({sellerGateway:()=>({})}));
vi.mock('../server/reconcile.js',()=>({reconcileMoney:reconcile}));
import { GET } from '../api/reconcile-payments';

describe('payment reconciliation monitoring',()=>{
  beforeEach(()=>{vi.stubEnv('CRON_SECRET','test-only-secret');vi.spyOn(console,'info').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});reconcile.mockReset();});
  afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
  const request=()=>new Request('https://example.test/api/reconcile-payments',{headers:{authorization:'Bearer test-only-secret'}});
  const healthy={replayed:0,transfers:0,checked:1,failed:0,needsReview:0};
  it('rejects unauthorized callers before touching money',async()=>{
    expect((await GET(new Request('https://example.test/api/reconcile-payments'))).status).toBe(401);
    expect(reconcile).not.toHaveBeenCalled();
  });
  it('returns success for a healthy run',async()=>{
    reconcile.mockResolvedValue(healthy);
    const response=await GET(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true,...healthy,bankChecked:0,bankFailed:0});
  });
  it.each([{failed:1},{needsReview:1}])('makes unresolved work visible to HTTP monitors: %j',async patch=>{
    reconcile.mockResolvedValue({...healthy,...patch});
    const response=await GET(request());expect(response.status).toBe(503);expect(response.headers.get('cache-control')).toBe('no-store');
    expect(console.error).toHaveBeenCalled();expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('test-only-secret');
  });
  it('does not expose provider errors in logs or responses',async()=>{
    reconcile.mockRejectedValue(new Error('private-cardholder@example.test'));
    const response=await GET(request());expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private-cardholder');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-cardholder');
  });
});

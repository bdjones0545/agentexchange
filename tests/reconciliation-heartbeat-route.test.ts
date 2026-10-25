/** Actual cron route and heartbeat helper; all money/dispatch/network boundaries mocked. */
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
const mocks = vi.hoisted(() => ({env:vi.fn(),client:vi.fn(),reconcile:vi.fn(),dispatch:vi.fn(),send:vi.fn(),notify:vi.fn()}));
vi.mock('../server/config.js',()=>({readServerEnv:mocks.env}));
vi.mock('../server/service.js',()=>({serviceClient:mocks.client}));
vi.mock('../server/ledger.js',()=>({supabaseLedger:()=>({})}));
vi.mock('../server/moneyOperations.js',()=>({operationStore:()=>({})}));
vi.mock('../server/stripe.js',()=>({realStripe:()=>({})}));
vi.mock('../server/connect.js',()=>({sellerGateway:()=>({})}));
vi.mock('../server/dispatch.js',()=>({loggedDispatch:mocks.dispatch}));
vi.mock('../server/reconcile.js',()=>({reconcileMoney:mocks.reconcile}));
import {GET} from '../api/reconcile-payments';
const healthy={failed:0,needsReview:0,checked:2};
const request=(auth='Bearer unit-secret')=>new Request('https://app.example/api/reconcile-payments',{headers:{authorization:auth}});
beforeEach(()=>{
  vi.resetAllMocks();
  vi.stubEnv('CRON_SECRET','unit-secret');
  vi.stubEnv('RECONCILIATION_SUCCESS_URL','https://monitor.example/success');
  vi.stubEnv('RECONCILIATION_FAILURE_URL','https://monitor.example/failure');
  vi.stubGlobal('fetch',mocks.send);
  mocks.send.mockResolvedValue(new Response(null,{status:200}));
  mocks.env.mockReturnValue({paymentsEnabled:true,appUrl:'https://app.example'});
  mocks.client.mockReturnValue({});mocks.dispatch.mockReturnValue(mocks.notify);
  mocks.reconcile.mockResolvedValue(healthy);
  vi.spyOn(console,'error').mockImplementation(()=>{});vi.spyOn(console,'info').mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});
const expectHeartbeat=(ok:boolean)=>{
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(String(mocks.send.mock.calls[0][0])).toBe(`https://monitor.example/${ok?'success':'failure'}`);
};
it.each(['','Bearer wrong','Bearer unit-secret-longer'])('rejects unauthorized caller before all effects: %s',async auth=>{
  expect((await GET(request(auth))).status).toBe(401);
  expect(mocks.env).not.toHaveBeenCalled();expect(mocks.client).not.toHaveBeenCalled();
  expect(mocks.reconcile).not.toHaveBeenCalled();expect(mocks.dispatch).not.toHaveBeenCalled();expect(mocks.send).not.toHaveBeenCalled();
});
it('rejects missing configured secret before all effects',async()=>{
  vi.stubEnv('CRON_SECRET','');expect((await GET(request())).status).toBe(401);
  expect(mocks.env).not.toHaveBeenCalled();expect(mocks.reconcile).not.toHaveBeenCalled();expect(mocks.send).not.toHaveBeenCalled();
});
it('preserves logged dispatch, counts and no-store on success',async()=>{
  const response=await GET(request());expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toEqual({ok:true,...healthy});
  expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith({paymentsEnabled:true,appUrl:'https://app.example'},'reconcile');
  expect(mocks.reconcile.mock.calls[0][1].notify).toBe(mocks.notify);expectHeartbeat(true);
});
it.each([{failed:1,needsReview:0},{failed:0,needsReview:1}])('reports unhealthy counts %j',async counts=>{
  mocks.reconcile.mockResolvedValue(counts);const response=await GET(request());
  expect(response.status).toBe(503);expect(response.headers.get('cache-control')).toBe('no-store');expectHeartbeat(false);
});
it('reports disabled payments without touching money',async()=>{
  mocks.env.mockReturnValue({paymentsEnabled:false});const response=await GET(request());
  expect(response.status).toBe(503);expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.client).not.toHaveBeenCalled();expect(mocks.reconcile).not.toHaveBeenCalled();expectHeartbeat(false);
});
it.each(['env','client','reconcile'] as const)('catches %s errors without exposing provider details',async boundary=>{
  mocks[boundary].mockImplementation(()=>{throw new Error('secret-provider-error');});
  const response=await GET(request());expect(response.status).toBe(500);
  expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.text()).not.toContain('secret-provider-error');
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('secret-provider-error');expectHeartbeat(false);
});
it('does not retry successful money work or fail its result when monitor is down',async()=>{
  mocks.send.mockRejectedValue(new Error('private-monitor-token'));const response=await GET(request());
  expect(response.status).toBe(200);expect(mocks.reconcile).toHaveBeenCalledTimes(1);expectHeartbeat(true);
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-monitor-token');
});

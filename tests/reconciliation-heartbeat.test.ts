import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {reportReconciliationHeartbeat} from '../server/reconciliationHeartbeat';
const send=vi.fn();
beforeEach(()=>{
  vi.stubGlobal('fetch',send);send.mockReset().mockResolvedValue(new Response(null,{status:200}));
  vi.stubEnv('RECONCILIATION_SUCCESS_URL','');vi.stubEnv('RECONCILIATION_FAILURE_URL','');
  vi.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});
it('does nothing until configured',async()=>{
  await reportReconciliationHeartbeat(true);await reportReconciliationHeartbeat(false);
  expect(send).not.toHaveBeenCalled();
});
it.each([true,false])('reports only the actual outcome: %s',async ok=>{
  vi.stubEnv('RECONCILIATION_SUCCESS_URL','https://monitor.example/success');
  vi.stubEnv('RECONCILIATION_FAILURE_URL','https://monitor.example/fail');
  await reportReconciliationHeartbeat(ok);
  expect(send).toHaveBeenCalledExactlyOnceWith(new URL(`https://monitor.example/${ok?'success':'fail'}`),{
    method:'POST',redirect:'error',signal:expect.any(AbortSignal),
  });
});
it.each(['http://monitor.example/private','https://user:secret@monitor.example/private','not-a-url'])('rejects unsafe URLs',async url=>{
  vi.stubEnv('RECONCILIATION_SUCCESS_URL',url);
  await reportReconciliationHeartbeat(true);expect(send).not.toHaveBeenCalled();
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private');
});
it.each(['network','http'])('isolates delivery failures and redacts URLs: %s',async kind=>{
  vi.stubEnv('RECONCILIATION_SUCCESS_URL','https://monitor.example/private-token');
  if(kind==='network') send.mockRejectedValue(new Error('private-token'));
  else send.mockResolvedValue(new Response(null,{status:503}));
  await expect(reportReconciliationHeartbeat(true)).resolves.toBeUndefined();
  expect(console.error).toHaveBeenCalled();
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-token');
});

it('uses a bounded 3000ms timeout',async()=>{
  vi.stubEnv('RECONCILIATION_SUCCESS_URL','https://monitor.example/success');
  const timeout=vi.spyOn(AbortSignal,'timeout');
  await reportReconciliationHeartbeat(true);
  expect(timeout).toHaveBeenCalledExactlyOnceWith(3000);
});
it.each(['abort','redirect'])('isolates %s rejection and redacts details',async kind=>{
  vi.stubEnv('RECONCILIATION_SUCCESS_URL','https://monitor.example/private-token');
  send.mockRejectedValue(kind==='abort'
    ? new DOMException('private-token','TimeoutError')
    : new TypeError('redirect to private-token'));
  await expect(reportReconciliationHeartbeat(true)).resolves.toBeUndefined();
  expect(send).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-token');
});
it.each([200,503])('cancels the response body on status %s',async status=>{
  vi.stubEnv('RECONCILIATION_SUCCESS_URL','https://monitor.example/success');
  const cancel=vi.fn();
  send.mockResolvedValue(new Response(new ReadableStream({cancel}),{status}));
  await reportReconciliationHeartbeat(true);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalledTimes(status===200?0:1);
});

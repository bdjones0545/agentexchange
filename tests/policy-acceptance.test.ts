import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ getUser: vi.fn(), upsert: vi.fn(), maybeSingle: vi.fn(), release: { active: true, version: 'v1', minimumAge: 18, documents: {} } }));
vi.mock('../server/policyRelease.js', () => ({ policyRelease: m.release, policyDigest: 'digest' }));
vi.mock('../server/service.js', () => ({ serviceClient: () => ({ auth: { getUser: m.getUser }, from: () => ({ upsert: m.upsert, select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: m.maybeSingle }) }) }) }) }) }) }));
import { GET, POST } from '../api/policy-acceptance';
const request = (body: unknown = { version: 'v1', digest: 'digest', adult: true, agreed: true, authority: true }, token = 'human') => new Request('https://example.test/api/policy-acceptance', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); m.release.active = true; m.getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } } }); m.upsert.mockResolvedValue({ error: null }); m.maybeSingle.mockResolvedValue({ data: null }); });
it('records only verified identity and server policy snapshot, ignoring supplied identity and time', async () => {
  expect((await POST(request({version:'v1',digest:'digest',adult:true,agreed:true,authority:true,user_id:'victim',accepted_at:'fake'}))).status).toBe(200);
  expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id:'verified-user',policy_snapshot:m.release }),{onConflict:'user_id,policy_version,policy_digest',ignoreDuplicates:true});
  expect(m.upsert.mock.calls[0][0]).not.toHaveProperty('accepted_at');
});
it('rejects agent keys',async()=>{expect((await POST(request(undefined,'axk_key'))).status).toBe(401);expect(m.getUser).not.toHaveBeenCalled();});
it('rejects anonymous and invalid users',async()=>{m.getUser.mockResolvedValue({data:{user:{id:'u',is_anonymous:true}}});expect((await POST(request())).status).toBe(401);});
it('rejects stale document digest',async()=>{expect((await POST(request({version:'v1',digest:'old',adult:true,agreed:true,authority:true}))).status).toBe(409);expect(m.upsert).not.toHaveBeenCalled();});
it('requires each affirmative acknowledgement',async()=>{for(const key of ['adult','agreed','authority'])expect((await POST(request({version:'v1',digest:'digest',adult:true,agreed:true,authority:true,[key]:false}))).status).toBe(400);});
it('does not accept drafts',async()=>{m.release.active=false;expect((await POST(request())).status).toBe(409);expect(await (await GET(request())).json()).toEqual({required:false,draft:true});expect(m.upsert).not.toHaveBeenCalled();});
it('fails closed when storage fails',async()=>{m.upsert.mockResolvedValue({error:{}});expect((await POST(request())).status).toBe(503);m.maybeSingle.mockResolvedValue({error:{}});expect((await GET(request())).status).toBe(503);});
it('requires acceptance when absent, clears it when recorded',async()=>{expect((await (await GET(request())).json()).required).toBe(true);m.maybeSingle.mockResolvedValue({data:{accepted_at:'now'}});expect((await (await GET(request())).json()).required).toBe(false);});

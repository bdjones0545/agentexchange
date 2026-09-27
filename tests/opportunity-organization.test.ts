import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true, supabase: mocks,
  getSupabaseErrorMessage: (error: {message: string} | null) => error?.message ?? 'Unknown error',
}));
import { createOpportunity } from '../src/lib/repositories/opportunitiesRepository';
const input = { organization: ' Test Workspace ', title: '[test] brief', category: 'Research', budget: '$50', duration: '1 day', description: 'Test description', successCriteria: 'Return a test artifact', requiredSkills: ['test'] };
beforeEach(() => vi.resetAllMocks());
it('reuses only the signed-in owner organization when posting a brief', async () => {
  mocks.rpc.mockResolvedValue({data: 'owner-a', error: null});
  const org: any = {};
  for (const key of ['select','eq','order','limit']) org[key] = vi.fn(() => org);
  org.maybeSingle = vi.fn().mockResolvedValue({data: {id: 'existing-org'}, error: null});
  org.insert = vi.fn();
  const opportunity: any = {};
  opportunity.insert = vi.fn(() => opportunity);
  opportunity.select = vi.fn(() => opportunity);
  opportunity.single = vi.fn().mockResolvedValue({data: {id: 'brief', title: input.title, created_at: '2026-09-27'}, error: null});
  mocks.from.mockImplementation((table: string) => table === 'organizations' ? org : opportunity);
  await createOpportunity(input);
  expect(org.eq).toHaveBeenCalledWith('owner_id', 'owner-a');
  expect(org.eq).toHaveBeenCalledWith('name', 'Test Workspace');
  expect(org.insert).not.toHaveBeenCalled();
  expect(opportunity.insert).toHaveBeenCalledWith(expect.objectContaining({organization_id: 'existing-org', organization_name: 'Test Workspace'}));
});
it('fails closed if owner lookup fails, before creating any rows', async () => {
  mocks.rpc.mockResolvedValue({data: null, error: {message: 'Unavailable'}});
  await expect(createOpportunity(input)).rejects.toThrow('Sign in');
  expect(mocks.from).not.toHaveBeenCalled();
});
it('does not create a duplicate organization when its lookup fails', async () => {
  mocks.rpc.mockResolvedValue({data: 'owner-a', error: null});
  const org: any = {};
  for (const key of ['select','eq','order','limit']) org[key] = vi.fn(() => org);
  org.maybeSingle = vi.fn().mockResolvedValue({data: null, error: {message: 'Network failure'}});
  org.insert = vi.fn();
  mocks.from.mockReturnValue(org);
  await expect(createOpportunity(input)).rejects.toThrow('Network failure');
  expect(org.insert).not.toHaveBeenCalled();
});

-- saved_opportunities exists in supabase/schema.sql but was never migrated to
-- production (found 2026-09-18: the migration ledger had remote_schema, the two
-- 20260912 deltas and 20260916 only). Every signed-in state load 404'd on
-- `saved_opportunities?select=*`, the Promise.all in
-- src/lib/repositories/supabaseStateRepository.ts rejected, and the UI fell back
-- to seed data — so shared mode showed no real agents, opportunities or contracts.
-- Additive: table, default owner, indexes, RLS and the three owner policies,
-- verbatim from schema.sql.
create table if not exists saved_opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, opportunity_id)
);

alter table saved_opportunities alter column owner_id set default public.current_profile_id();

create index if not exists idx_saved_opportunities_owner_id on saved_opportunities(owner_id);
create index if not exists idx_saved_opportunities_opportunity_id on saved_opportunities(opportunity_id);
create index if not exists idx_saved_opportunities_created_at on saved_opportunities(created_at);

alter table saved_opportunities enable row level security;

drop policy if exists "saved_opportunities_owner_read" on saved_opportunities;
create policy "saved_opportunities_owner_read" on saved_opportunities
  for select to authenticated
  using (owner_id = public.current_profile_id());

drop policy if exists "saved_opportunities_owner_insert" on saved_opportunities;
create policy "saved_opportunities_owner_insert" on saved_opportunities
  for insert to authenticated
  with check (owner_id = public.current_profile_id());

drop policy if exists "saved_opportunities_owner_delete" on saved_opportunities;
create policy "saved_opportunities_owner_delete" on saved_opportunities
  for delete to authenticated
  using (owner_id = public.current_profile_id());

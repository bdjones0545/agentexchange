-- Deliverable quality gate (Jev via Vercel AI Gateway).
-- 1. Each accepted deliverable carries the gate result it was admitted with.
-- 2. Every gate decision — including returns that never became a deliverable —
--    is appended to deliverable_gate_events, which is also the dataset for
--    measuring the gate itself. Access mirrors contract_deliverables.
alter table contract_deliverables add column if not exists gate jsonb;

create table if not exists deliverable_gate_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  worker_profile_id uuid references profiles(id) on delete set null,
  deliverable_id uuid references contract_deliverables(id) on delete set null,
  title text,
  verdict text not null check (verdict in ('passed', 'returned', 'accepted_with_flags', 'unavailable')),
  attempt integer not null default 1,
  answers jsonb,
  flags jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists idx_deliverable_gate_events_contract_id on deliverable_gate_events(contract_id);
create index if not exists idx_deliverable_gate_events_created_at on deliverable_gate_events(created_at);

alter table deliverable_gate_events enable row level security;

drop policy if exists "deliverable_gate_events_participant_read" on deliverable_gate_events;
create policy "deliverable_gate_events_participant_read" on deliverable_gate_events
  for select to authenticated
  using (public.can_access_contract(contract_id));

drop policy if exists "deliverable_gate_events_participant_insert" on deliverable_gate_events;
create policy "deliverable_gate_events_participant_insert" on deliverable_gate_events
  for insert to authenticated
  with check (public.can_access_contract(contract_id) and worker_profile_id = public.current_profile_id());

-- Server-written evidence only. User-editable auth metadata is never evidence.
create table if not exists public.policy_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null,
  policy_digest text not null check (policy_digest ~ '^[a-f0-9]{64}$'),
  policy_snapshot jsonb not null,
  adult boolean not null check (adult),
  agreed boolean not null check (agreed),
  authority boolean not null check (authority),
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_version, policy_digest)
);
alter table public.policy_acceptances enable row level security;
revoke all on public.policy_acceptances from public, anon, authenticated, service_role;
grant select, insert on public.policy_acceptances to service_role;
grant select on public.policy_acceptances to authenticated;
drop policy if exists policy_acceptance_owner_read on public.policy_acceptances;
create policy policy_acceptance_owner_read on public.policy_acceptances for select to authenticated
  using (user_id = (select auth.uid()));
-- No direct update/delete grants. Account deletion cascades remove this personal data.

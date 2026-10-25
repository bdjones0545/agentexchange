-- ---------------------------------------------------------------------------
-- Deliverable emails (2026-10-15): the owner email's idempotency ledger.
--
-- server/notifications.ts claims a row here before it emails the organization's
-- owner about a submitted deliverable, keyed by the deliverable and how many
-- decisions it already carries, so a retried request does not send twice while
-- a revision resubmitted after a rejection does. Service-role only: no
-- policies, grants revoked.
--
-- Also adds organization_owner_email(), the service-only lookup of the
-- recipient, so the server needs no direct SELECT on profiles.
--
-- Additive and safe to run more than once. The code runs without it (it falls
-- back to Resend's 24-hour Idempotency-Key and, while production keeps its old
-- blanket grants, to reading the owner's profile directly), so it can be
-- applied before or after the deploy. Apply it before 2026-10-30 or on any
-- project created after 2026-05-30, where the fallback read has no grant.
-- ---------------------------------------------------------------------------
create table if not exists email_notifications (
  key text primary key,
  kind text not null,
  deliverable_id uuid references contract_deliverables(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_id text
);

alter table email_notifications enable row level security;
revoke all on email_notifications from anon, authenticated;
-- Explicit, because tables created in public after 2026-10-30 get no default
-- grant (see the Explicit Data API grants section).
grant select, insert, update on table public.email_notifications to service_role;

-- The owner's address for a deliverable email, so the service role never needs
-- direct SELECT on profiles (the same pattern as resolve_agent_api_key). The
-- auth record is the current address; profiles.email, copied at sign-up, is
-- the fallback. Service-role only.
create or replace function public.organization_owner_email(org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.email, p.email)
  from organizations o
  join profiles p on p.id = o.owner_id
  left join auth.users u on u.id = p.user_id
  where o.id = org_id
$$;
revoke all on function public.organization_owner_email(uuid) from public, anon, authenticated;
grant execute on function public.organization_owner_email(uuid) to service_role;

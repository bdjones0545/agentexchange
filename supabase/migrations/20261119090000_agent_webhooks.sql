-- Agent webhooks: tell an agent the moment something it is a party to changes,
-- instead of making it poll.
--
-- * agent_webhooks: at most one HTTPS endpoint per agent API key, with the
--   signing secret (Standard Webhooks). Service role only; the owner and the
--   agent manage it through /api/agent-webhooks and the MCP tools.
-- * agent_events: the outbox. Triggers on the marketplace tables record each
--   change for the profile that should hear about it, whatever wrote it (the
--   browser, an agent over MCP, Stripe or the platform). An event is recorded
--   only when that profile has a live webhook, and never for the profile that
--   caused it. Events carry identifiers and a status, never content.
-- * agent_event_deliveries: one row per event and key, retried with backoff by
--   the /api/agent-events job until delivered or given up.
--
-- Recording an event can never fail the write that caused it: errors become
-- warnings. Additive only and safe to run more than once.

create table if not exists public.agent_webhooks (
  key_id uuid primary key references public.agent_api_keys(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  url text not null check (url ~ '^https://' and length(url) <= 2048),
  secret text not null,
  events text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  disabled_reason text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_status integer
);
create index if not exists agent_webhooks_profile_idx on public.agent_webhooks(profile_id);
alter table public.agent_webhooks enable row level security;
revoke all on public.agent_webhooks from public, anon, authenticated;
grant select, insert, update, delete on public.agent_webhooks to service_role;

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_profile_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_events_created_idx on public.agent_events(created_at);
alter table public.agent_events enable row level security;
revoke all on public.agent_events from public, anon, authenticated;
grant select, insert, delete on public.agent_events to service_role;

create table if not exists public.agent_event_deliveries (
  event_id uuid not null references public.agent_events(id) on delete cascade,
  key_id uuid not null references public.agent_api_keys(id) on delete cascade,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  last_status integer,
  created_at timestamptz not null default now(),
  primary key (event_id, key_id)
);
create index if not exists agent_event_deliveries_due_idx on public.agent_event_deliveries(next_attempt_at)
  where delivered_at is null and failed_at is null;
alter table public.agent_event_deliveries enable row level security;
revoke all on public.agent_event_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.agent_event_deliveries to service_role;

-- Record one event for a recipient and queue it for each of their live webhooks.
create or replace function public.emit_agent_event(p_type text, p_recipient uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid; ev uuid;
begin
  begin
    actor := public.current_profile_id();
    if p_recipient is null or p_recipient is not distinct from actor then return; end if;
    if not exists (
      select 1 from public.agent_webhooks w join public.agent_api_keys k on k.id = w.key_id
      where w.profile_id = p_recipient and w.disabled_at is null and k.revoked_at is null and k.paused_at is null
        and (cardinality(w.events) = 0 or p_type = any(w.events))
    ) then return; end if;
    insert into public.agent_events(type, recipient_profile_id, actor_profile_id, data)
      values (p_type, p_recipient, actor, coalesce(p_data, '{}'::jsonb)) returning id into ev;
    insert into public.agent_event_deliveries(event_id, key_id)
      select ev, w.key_id from public.agent_webhooks w join public.agent_api_keys k on k.id = w.key_id
      where w.profile_id = p_recipient and w.disabled_at is null and k.revoked_at is null and k.paused_at is null
        and (cardinality(w.events) = 0 or p_type = any(w.events))
      on conflict do nothing;
  exception when others then
    raise warning 'agent event % not recorded: %', p_type, sqlstate;
  end;
end $$;
revoke all on function public.emit_agent_event(text, uuid, jsonb) from public, anon, authenticated;

-- Who decides on the organization side of an opportunity: its organization's owner, else whoever posted it.
create or replace function public.agent_event_opportunity_owner(p_opportunity uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(o.owner_id, op.owner_id)
  from public.opportunities op left join public.organizations o on o.id = op.organization_id
  where op.id = p_opportunity
$$;
revoke all on function public.agent_event_opportunity_owner(uuid) from public, anon, authenticated;

create or replace function public.agent_events_hire_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ids jsonb := jsonb_build_object('hireRequestId', new.id, 'agentId', new.agent_id, 'opportunityId', new.opportunity_id, 'status', new.status);
begin
  if tg_op = 'INSERT' then
    perform public.emit_agent_event('hire_request.created', (select owner_id from public.agents where id = new.agent_id), ids);
  elsif new.status is distinct from old.status and new.status in ('accepted', 'rejected') then
    perform public.emit_agent_event('hire_request.' || new.status, new.owner_id, ids);
  end if;
  return null;
exception when others then
  raise warning 'agent events (hire_requests): %', sqlstate;
  return null;
end $$;

create or replace function public.agent_events_application() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ids jsonb := jsonb_build_object('applicationId', new.id, 'agentId', new.agent_id, 'opportunityId', new.opportunity_id, 'status', new.status);
begin
  if tg_op = 'INSERT' then
    perform public.emit_agent_event('application.created', public.agent_event_opportunity_owner(new.opportunity_id), ids);
  elsif new.status is distinct from old.status and new.status in ('accepted', 'rejected') then
    perform public.emit_agent_event('application.' || new.status, new.owner_id, ids);
  end if;
  return null;
exception when others then
  raise warning 'agent events (applications): %', sqlstate;
  return null;
end $$;

create or replace function public.agent_events_negotiation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ids jsonb := jsonb_build_object('negotiationId', new.id, 'agentId', new.agent_id, 'opportunityId', new.opportunity_id, 'status', new.status);
  org_side uuid := public.agent_event_opportunity_owner(new.opportunity_id);
begin
  if tg_op = 'INSERT' then
    perform public.emit_agent_event('negotiation.created', org_side, ids);
  elsif new.status is distinct from old.status and new.status in ('countered', 'accepted', 'rejected') then
    -- The party that made the change is skipped by emit_agent_event.
    perform public.emit_agent_event('negotiation.' || new.status, new.owner_id, ids);
    if new.status <> 'countered' then perform public.emit_agent_event('negotiation.' || new.status, org_side, ids); end if;
  end if;
  return null;
exception when others then
  raise warning 'agent events (negotiations): %', sqlstate;
  return null;
end $$;

create or replace function public.agent_events_contract() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  org_owner uuid := (select owner_id from public.organizations where id = new.organization_id);
  agent_owner uuid := (select owner_id from public.agents where id = new.agent_id);
  ids jsonb := jsonb_build_object('contractId', new.id, 'agentId', new.agent_id, 'organizationId', new.organization_id, 'paymentStatus', new.payment_status);
  kind text;
begin
  if tg_op = 'INSERT' then
    kind := 'contract.created';
  elsif new.payment_status is distinct from old.payment_status then
    kind := case
      when new.payment_status = 'authorized' then 'contract.funded'
      when new.payment_status = 'captured' then 'payment.released'
      when new.payment_status = 'unfunded' and old.payment_status = 'authorized' then 'contract.hold_ended'
      when new.payment_status = 'refunded' then 'payment.refunded'
    end;
  end if;
  if kind is not null then
    perform public.emit_agent_event(kind, agent_owner, ids);
    perform public.emit_agent_event(kind, org_owner, ids);
  end if;
  return null;
exception when others then
  raise warning 'agent events (contracts): %', sqlstate;
  return null;
end $$;

create or replace function public.agent_events_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select organization_id, agent_id into c from public.contracts where id = new.contract_id;
  perform public.emit_agent_event('message.created',
    case when new.sender_type = 'Organization' then (select owner_id from public.agents where id = c.agent_id)
         else (select owner_id from public.organizations where id = c.organization_id) end,
    jsonb_build_object('contractId', new.contract_id, 'messageId', new.id, 'from', new.sender_type));
  return null;
exception when others then
  raise warning 'agent events (contract_messages): %', sqlstate;
  return null;
end $$;

create or replace function public.agent_events_deliverable() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  ids jsonb := jsonb_build_object('contractId', new.contract_id, 'deliverableId', new.id, 'status', new.status);
  was text := case when tg_op = 'INSERT' then null else old.status end;
begin
  if new.status is not distinct from was then return null; end if;
  select organization_id, agent_id into c from public.contracts where id = new.contract_id;
  if new.status = 'submitted' then
    perform public.emit_agent_event('deliverable.submitted', (select owner_id from public.organizations where id = c.organization_id), ids);
  elsif new.status = 'approved' then
    perform public.emit_agent_event('deliverable.approved', (select owner_id from public.agents where id = c.agent_id), ids);
  elsif new.status = 'draft' and was = 'submitted' then
    perform public.emit_agent_event('deliverable.returned', (select owner_id from public.agents where id = c.agent_id), ids);
  end if;
  return null;
exception when others then
  raise warning 'agent events (contract_deliverables): %', sqlstate;
  return null;
end $$;

create or replace function public.agent_events_dispute() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  kind text;
  ids jsonb := jsonb_build_object('contractId', new.contract_id, 'disputeId', new.id, 'status', new.status);
begin
  if tg_op = 'INSERT' then kind := 'dispute.opened';
  elsif new.status is distinct from old.status and new.status = 'Resolved' then kind := 'dispute.resolved';
  else return null;
  end if;
  select organization_id, agent_id into c from public.contracts where id = new.contract_id;
  perform public.emit_agent_event(kind, (select owner_id from public.agents where id = c.agent_id), ids);
  perform public.emit_agent_event(kind, (select owner_id from public.organizations where id = c.organization_id), ids);
  return null;
exception when others then
  raise warning 'agent events (disputes): %', sqlstate;
  return null;
end $$;

revoke all on function public.agent_events_hire_request() from public, anon, authenticated;
revoke all on function public.agent_events_application() from public, anon, authenticated;
revoke all on function public.agent_events_negotiation() from public, anon, authenticated;
revoke all on function public.agent_events_contract() from public, anon, authenticated;
revoke all on function public.agent_events_message() from public, anon, authenticated;
revoke all on function public.agent_events_deliverable() from public, anon, authenticated;
revoke all on function public.agent_events_dispute() from public, anon, authenticated;

drop trigger if exists agent_events_hire_request on public.hire_requests;
create trigger agent_events_hire_request after insert or update of status on public.hire_requests
  for each row execute function public.agent_events_hire_request();
drop trigger if exists agent_events_application on public.applications;
create trigger agent_events_application after insert or update of status on public.applications
  for each row execute function public.agent_events_application();
drop trigger if exists agent_events_negotiation on public.negotiations;
create trigger agent_events_negotiation after insert or update of status on public.negotiations
  for each row execute function public.agent_events_negotiation();
drop trigger if exists agent_events_contract on public.contracts;
create trigger agent_events_contract after insert or update of payment_status on public.contracts
  for each row execute function public.agent_events_contract();
drop trigger if exists agent_events_message on public.contract_messages;
create trigger agent_events_message after insert on public.contract_messages
  for each row execute function public.agent_events_message();
drop trigger if exists agent_events_deliverable on public.contract_deliverables;
create trigger agent_events_deliverable after insert or update of status on public.contract_deliverables
  for each row execute function public.agent_events_deliverable();
drop trigger if exists agent_events_dispute on public.disputes;
create trigger agent_events_dispute after insert or update of status on public.disputes
  for each row execute function public.agent_events_dispute();

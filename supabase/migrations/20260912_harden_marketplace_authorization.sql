-- Migration: harden marketplace authorization + shared-marketplace hardening.
-- Extracted from supabase/schema.sql (idempotent statements only).

-- Canonical organization-side authority for an opportunity: the profile that
-- posted it, or the owner of the organization it belongs to. Authorization is
-- derived from relational ownership only -- never from organization_name,
-- agent_name, display names, or any other client-supplied text.
create or replace function public.is_opportunity_org_side(opportunity_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_uuid
      and (
        o.owner_id = public.current_profile_id()
        or public.is_organization_owner(o.organization_id)
      )
  )
$$;

drop policy if exists "applications_participant_update" on applications;
create policy "applications_participant_update" on applications
  for update to authenticated
  using (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
    or public.is_opportunity_org_side(opportunity_id)
  )
  with check (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
    or public.is_opportunity_org_side(opportunity_id)
  );

drop policy if exists "negotiations_participant_update" on negotiations;
create policy "negotiations_participant_update" on negotiations
  for update to authenticated
  using (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
    or public.is_opportunity_org_side(opportunity_id)
  )
  with check (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
    or public.is_opportunity_org_side(opportunity_id)
  );

drop policy if exists "hire_requests_participant_update" on hire_requests;
create policy "hire_requests_participant_update" on hire_requests
  for update to authenticated
  using (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
  )
  with check (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
  );

-- A contract binds an organization to an agent. Only the organization that is
-- being bound may create that binding. Allowing the agent side to insert let an
-- agent manufacture a contract naming an organization it does not own.
drop policy if exists "contracts_participant_insert" on contracts;
create policy "contracts_participant_insert" on contracts
  for insert to authenticated
  with check (public.is_organization_owner(organization_id));

-- ---------------------------------------------------------------------------
-- Marketplace update authority (P0)
--
-- Row-level WITH CHECK can only inspect the post-image of a row. It cannot tell
-- that a row was moved from one security relationship to another, and it cannot
-- tell which actor performed a status transition. Both of those are required
-- here, so the invariants below are enforced by BEFORE UPDATE triggers.
--
-- Core invariant: permission to update a row must not imply permission to
-- transform it into a different security relationship. Relationship keys are
-- immutable after creation, and every status transition is actor-specific.
--
-- All authority is derived from authenticated relational ownership
-- (auth.uid() -> profiles -> organizations / agents / opportunities). Display
-- names, denormalized organization_name / agent_name text, client-supplied role
-- strings and frontend visibility are never consulted.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_application_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
begin
  -- Trusted server-side contexts (service role, migrations, seeds) have no
  -- end-user profile. Untrusted callers cannot reach this trigger without one:
  -- the UPDATE policy is restricted to `authenticated` and every branch of its
  -- USING clause requires a resolvable profile.
  if actor is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.agent_id is distinct from old.agent_id
     or new.opportunity_id is distinct from old.opportunity_id
     or new.created_at is distinct from old.created_at then
    raise exception 'applications: owner_id, agent_id and opportunity_id are immutable'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' then
      raise exception 'applications: status "%" is terminal', old.status
        using errcode = '42501';
    end if;

    if new.status not in ('accepted', 'rejected') then
      raise exception 'applications: unsupported status transition "%" -> "%"',
        old.status, new.status
        using errcode = '42501';
    end if;

    -- Accepting and rejecting are both organization-side authority. The
    -- applicant can neither self-accept nor issue the organization's rejection.
    if not public.is_opportunity_org_side(old.opportunity_id) then
      raise exception 'applications: only the opportunity owner may change application status'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_negotiation_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
begin
  if actor is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.agent_id is distinct from old.agent_id
     or new.opportunity_id is distinct from old.opportunity_id
     or new.created_at is distinct from old.created_at then
    raise exception 'negotiations: owner_id, agent_id and opportunity_id are immutable'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status not in ('pending', 'countered') then
      raise exception 'negotiations: status "%" is terminal', old.status
        using errcode = '42501';
    end if;

    if new.status not in ('accepted', 'rejected', 'countered') then
      raise exception 'negotiations: unsupported status transition "%" -> "%"',
        old.status, new.status
        using errcode = '42501';
    end if;

    -- Acceptance binds the organization, so it is organization-side authority
    -- only. Countering and rejecting/withdrawing remain available to both
    -- participants.
    if new.status = 'accepted'
       and not public.is_opportunity_org_side(old.opportunity_id) then
      raise exception 'negotiations: only the opportunity owner may accept a negotiation'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_hire_request_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
begin
  if actor is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.agent_id is distinct from old.agent_id
     or new.opportunity_id is distinct from old.opportunity_id
     or new.created_at is distinct from old.created_at then
    raise exception 'hire_requests: owner_id, agent_id and opportunity_id are immutable'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' then
      raise exception 'hire_requests: status "%" is terminal', old.status
        using errcode = '42501';
    end if;

    if new.status not in ('accepted', 'rejected') then
      raise exception 'hire_requests: unsupported status transition "%" -> "%"',
        old.status, new.status
        using errcode = '42501';
    end if;

    -- A hire request is issued by the organization and answered by the agent.
    -- Only the owner of the requested agent may accept it; the requesting
    -- organization cannot accept on the agent's behalf. Rejection stays open to
    -- both sides so the agent can decline and the organization can cancel.
    if new.status = 'accepted'
       and not public.is_agent_owner(old.agent_id) then
      raise exception 'hire_requests: only the owner of the requested agent may accept'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- Contract INSERT is restricted to the organization side. Closing only INSERT
-- would leave the same forgery reachable through UPDATE, because
-- can_access_contract() re-reads the committed row and therefore cannot
-- constrain the post-image. The binding parties are immutable instead.
create or replace function public.enforce_contract_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
begin
  if actor is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.agent_id is distinct from old.agent_id
     or new.created_at is distinct from old.created_at then
    raise exception 'contracts: organization_id and agent_id are immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists applications_enforce_update_authority on applications;
create trigger applications_enforce_update_authority
  before update on applications
  for each row execute function public.enforce_application_update_authority();

drop trigger if exists negotiations_enforce_update_authority on negotiations;
create trigger negotiations_enforce_update_authority
  before update on negotiations
  for each row execute function public.enforce_negotiation_update_authority();

drop trigger if exists hire_requests_enforce_update_authority on hire_requests;
create trigger hire_requests_enforce_update_authority
  before update on hire_requests
  for each row execute function public.enforce_hire_request_update_authority();

drop trigger if exists contracts_enforce_update_authority on contracts;
create trigger contracts_enforce_update_authority
  before update on contracts
  for each row execute function public.enforce_contract_update_authority();

-- ---------------------------------------------------------------------------
-- Hire-request contract materialization (P0 follow-up)
--
-- Generic contract INSERT is restricted to is_organization_owner(organization_id),
-- so an accepting agent can no longer create the resulting contract from the
-- client. Restoring is_agent_owner(agent_id) as generic INSERT authority would
-- reopen the P0, so the flow is re-established as two separate, narrowly scoped
-- steps instead:
--
--   1. the owning agent accepts the hire request through the ordinary RLS
--      UPDATE path, which is durable and already actor-gated by
--      enforce_hire_request_update_authority(); then
--   2. materialize_hire_request_contract() derives every contract relationship
--      field from that accepted hire request.
--
-- The caller supplies only a hire request id. organization_id, agent_id and the
-- source relationship are all derived server-side, so a legitimate acceptance
-- never confers authority to name a different organization or agent.
-- ---------------------------------------------------------------------------

-- At most one canonical contract per accepted hire request. This is the hard
-- backstop behind the advisory check inside the function below.
create unique index if not exists uq_contracts_hire_request_source
  on contracts (source_id)
  where source_type = 'hire-request' and source_id is not null;

-- Provenance must be immutable, otherwise a second hire request could be
-- repointed at an existing contract to bypass the uniqueness index above.
create or replace function public.enforce_contract_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
begin
  if actor is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.agent_id is distinct from old.agent_id
     or new.created_at is distinct from old.created_at then
    raise exception 'contracts: organization_id and agent_id are immutable'
      using errcode = '42501';
  end if;

  if new.source_id is distinct from old.source_id
     or new.source_type is distinct from old.source_type then
    raise exception 'contracts: source provenance is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.materialize_hire_request_contract(hire_request_uuid uuid)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  hr hire_requests%rowtype;
  opp opportunities%rowtype;
  org organizations%rowtype;
  requested_agent agents%rowtype;
  existing contracts%rowtype;
  materialized contracts%rowtype;
begin
  if public.current_profile_id() is null then
    raise exception 'materialize_hire_request_contract: authentication required'
      using errcode = '42501';
  end if;

  -- The row lock serialises concurrent callers, which is what makes the
  -- "already materialised" check below a reliable idempotency gate rather than
  -- a race.
  select * into hr from hire_requests where id = hire_request_uuid for update;
  if not found then
    raise exception 'materialize_hire_request_contract: hire request not found'
      using errcode = '42501';
  end if;

  -- Only the two legitimate parties may materialise. An unrelated authenticated
  -- user is refused outright.
  if not (
    public.is_agent_owner(hr.agent_id)
    or public.is_opportunity_org_side(hr.opportunity_id)
  ) then
    raise exception 'materialize_hire_request_contract: caller is not a party to this hire request'
      using errcode = '42501';
  end if;

  -- Materialisation is allowed only after a legitimate acceptance. Acceptance
  -- itself is gated to the owning agent by the hire_requests update trigger, so
  -- the requesting organization cannot manufacture this precondition.
  if hr.status <> 'accepted' then
    raise exception 'materialize_hire_request_contract: hire request is "%", not accepted', hr.status
      using errcode = '42501';
  end if;

  select * into existing
    from contracts
   where source_type = 'hire-request'
     and source_id = hr.id;
  if found then
    return existing;
  end if;

  -- Canonical derivation. Nothing here comes from the caller.
  if hr.opportunity_id is null then
    raise exception 'materialize_hire_request_contract: hire request has no opportunity, so no canonical organization can be derived'
      using errcode = '42501';
  end if;

  select * into opp from opportunities where id = hr.opportunity_id;
  if not found or opp.organization_id is null then
    raise exception 'materialize_hire_request_contract: opportunity has no organization, so no canonical organization can be derived'
      using errcode = '42501';
  end if;

  select * into org from organizations where id = opp.organization_id;
  if not found then
    raise exception 'materialize_hire_request_contract: organization not found'
      using errcode = '42501';
  end if;

  select * into requested_agent from agents where id = hr.agent_id;
  if not found then
    raise exception 'materialize_hire_request_contract: agent not found'
      using errcode = '42501';
  end if;

  -- The hire request must have been ISSUED by the organization side of its own
  -- opportunity. Without this, an agent could self-issue a hire request naming
  -- another organization's opportunity, accept it (it names their own agent),
  -- and materialize a contract against an organization that never hired them --
  -- reopening the P0 through this path.
  if hr.owner_id is null
     or (opp.owner_id is distinct from hr.owner_id
         and org.owner_id is distinct from hr.owner_id) then
    raise exception 'materialize_hire_request_contract: hire request was not issued by the organization side of its opportunity'
      using errcode = '42501';
  end if;

  insert into contracts (
    agent_id, agent_name, due_date, organization_id, organization_name,
    progress, source_id, source_type, start_date, status, title, value
  ) values (
    requested_agent.id,
    requested_agent.name,
    to_char(now() + interval '14 days', 'YYYY-MM-DD'),
    org.id,
    org.name,
    5,
    hr.id,
    'hire-request',
    to_char(now(), 'YYYY-MM-DD'),
    'Active',
    coalesce(nullif(hr.quick_job_title, ''), nullif(hr.opportunity_title, ''), opp.title, 'Hire request'),
    coalesce(opp.budget_range, 'Custom scope')
  )
  returning * into materialized;

  return materialized;
end;
$$;

-- SECURITY DEFINER functions are executable by PUBLIC unless revoked.
revoke all on function public.materialize_hire_request_contract(uuid) from public;
revoke all on function public.materialize_hire_request_contract(uuid) from anon;
grant execute on function public.materialize_hire_request_contract(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Shared-marketplace hardening (2026-09-12)
--
-- The app no longer stores a per-user JSON snapshot of its whole state in
-- activity_events; the normalized tables are the only source of truth. That
-- leaves activity_events as an append-only public timeline, so an actor may
-- only write events it owns (owner_id defaults to the caller's profile).
-- ---------------------------------------------------------------------------
drop policy if exists "activity_events_authenticated_insert" on activity_events;
create policy "activity_events_authenticated_insert" on activity_events
  for insert to authenticated
  with check (owner_id = public.current_profile_id());

-- SECURITY DEFINER helpers are executable by PUBLIC (and therefore by anon
-- over /rest/v1/rpc) unless revoked. Only current_profile_id() must stay
-- callable by anon: activity_events_public_read evaluates it for anonymous
-- readers. Everything else is consulted only by `to authenticated` policies.
revoke all on function public.is_agent_owner(uuid) from public, anon;
revoke all on function public.is_organization_owner(uuid) from public, anon;
revoke all on function public.is_opportunity_org_side(uuid) from public, anon;
revoke all on function public.can_access_contract(uuid) from public, anon;
grant execute on function public.is_agent_owner(uuid) to authenticated;
grant execute on function public.is_organization_owner(uuid) to authenticated;
grant execute on function public.is_opportunity_org_side(uuid) to authenticated;
grant execute on function public.can_access_contract(uuid) to authenticated;
-- The auth trigger runs as its owner; nobody needs to call it directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;

alter function public.set_updated_at() set search_path = public;

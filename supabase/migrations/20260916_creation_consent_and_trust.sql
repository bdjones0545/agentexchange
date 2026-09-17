-- ---------------------------------------------------------------------------
-- Record creation requires ownership of the party it names; trust signals are
-- platform-managed; reviews are attributed; approvals are organization-side;
-- disputes are resolved by their complainant. (2026-09-16)
--
-- Root defect closed here: the insert policies below used
--   owner_id = current_profile_id() OR is_agent_owner(agent_id)
-- and owner_id defaults to the caller, so the first term was always true and
-- the ownership term never restricted anything. Any signed-in user could
-- forge an application "from" any agent, post an opportunity under any
-- organization, and an organization could bind any agent to a contract with
-- no application, then dispute it and flip the agent's public badge.
--
-- Everything below is idempotent. Proven by scripts/rls-local-verify.sh.
-- ---------------------------------------------------------------------------

-- 1. Creation must name a party the caller owns ------------------------------

drop policy if exists "applications_authenticated_insert" on applications;
create policy "applications_authenticated_insert" on applications
  for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    and public.is_agent_owner(agent_id)
  );

drop policy if exists "negotiations_authenticated_insert" on negotiations;
create policy "negotiations_authenticated_insert" on negotiations
  for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    and public.is_agent_owner(agent_id)
  );

drop policy if exists "opportunities_authenticated_insert" on opportunities;
create policy "opportunities_authenticated_insert" on opportunities
  for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    and (organization_id is null or public.is_organization_owner(organization_id))
  );

-- A hire request is issued by the organization side of its own opportunity.
-- Quick-job requests without an opportunity stay allowed; they can never
-- materialize a contract (the RPC refuses them), so they are harmless.
drop policy if exists "hire_requests_authenticated_insert" on hire_requests;
create policy "hire_requests_authenticated_insert" on hire_requests
  for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    and (opportunity_id is null or public.is_opportunity_org_side(opportunity_id))
  );

-- 2. A contract needs the agent's consent, expressed by the agent's own
--    application or negotiation on this organization's opportunity. Hire
--    requests still materialize only through the RPC, which verifies both sides.
create or replace function public.contract_source_consents(
  source_type_in text,
  source_id_in uuid,
  agent_uuid uuid,
  organization_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case source_type_in
    when 'application' then exists (
      select 1
      from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      where a.id = source_id_in
        and a.agent_id = agent_uuid
        and o.organization_id = organization_uuid
    )
    when 'negotiation' then exists (
      select 1
      from public.negotiations n
      join public.opportunities o on o.id = n.opportunity_id
      where n.id = source_id_in
        and n.agent_id = agent_uuid
        and o.organization_id = organization_uuid
    )
    else false
  end
$$;
revoke all on function public.contract_source_consents(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.contract_source_consents(text, uuid, uuid, uuid) to authenticated;

drop policy if exists "contracts_participant_insert" on contracts;
create policy "contracts_participant_insert" on contracts
  for insert to authenticated
  with check (
    public.is_organization_owner(organization_id)
    and public.contract_source_consents(source_type, source_id, agent_id, organization_id)
  );

-- One contract per accepted application/negotiation, as a hard backstop
-- behind the app's own duplicate check (hire requests already had one).
create unique index if not exists uq_contracts_source
  on contracts (source_type, source_id)
  where source_id is not null;

-- 3. Trust signals are platform-managed ---------------------------------------
-- Owners may edit what describes their agent or organization, never what
-- vouches for it. On insert the vouching columns are normalized to defaults;
-- on update they are immutable for an end user. Service-role writes (no
-- profile) are unaffected, which is how the platform sets them.

create or replace function public.enforce_agent_trust_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.trust_score := 0;
    new.verification_status := 'Unverified';
    new.revenue := '$0';
    new.success_rate := 'New';
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
     or new.trust_score is distinct from old.trust_score
     or new.verification_status is distinct from old.verification_status
     or new.revenue is distinct from old.revenue
     or new.success_rate is distinct from old.success_rate then
    raise exception 'agents: trust_score, verification_status, revenue, success_rate and owner_id are platform-managed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_agent_trust_columns() from public, anon, authenticated;

drop trigger if exists agents_enforce_trust_columns on agents;
create trigger agents_enforce_trust_columns
  before insert or update on agents
  for each row execute function public.enforce_agent_trust_columns();

create or replace function public.enforce_organization_trust_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified := false;
    new.rating := 0;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
     or new.verified is distinct from old.verified
     or new.rating is distinct from old.rating then
    raise exception 'organizations: verified, rating and owner_id are platform-managed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_organization_trust_columns() from public, anon, authenticated;

drop trigger if exists organizations_enforce_trust_columns on organizations;
create trigger organizations_enforce_trust_columns
  before insert or update on organizations
  for each row execute function public.enforce_organization_trust_columns();

-- 4. Reviews are written by the organization about the agent it contracted --
alter table reviews
  add column if not exists reviewer_id uuid references profiles(id) on delete set null;
alter table reviews alter column reviewer_id set default public.current_profile_id();

drop policy if exists "reviews_contract_participant_insert" on reviews;
create policy "reviews_organization_insert" on reviews
  for insert to authenticated
  with check (
    reviewer_id = public.current_profile_id()
    and exists (
      select 1
      from public.contracts c
      where c.id = reviews.contract_id
        and public.is_organization_owner(c.organization_id)
        and c.agent_id = reviews.agent_id
    )
  );

-- One review per contract.
create unique index if not exists uq_reviews_contract
  on reviews (contract_id)
  where contract_id is not null;

-- 5. Deliverable decisions and milestone completion are organization-side ---
create or replace function public.is_contract_org_side(contract_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.contracts c
    where c.id = contract_uuid
      and public.is_organization_owner(c.organization_id)
  )
$$;
revoke all on function public.is_contract_org_side(uuid) from public, anon;
grant execute on function public.is_contract_org_side(uuid) to authenticated;

create or replace function public.enforce_deliverable_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;

  if new.contract_id is distinct from old.contract_id then
    raise exception 'contract_deliverables: contract_id is immutable' using errcode = '42501';
  end if;

  -- Either party may draft, edit and submit. Only the organization decides.
  if (new.status = 'approved' and old.status is distinct from 'approved')
     or new.approved_at is distinct from old.approved_at
     or new.decisions is distinct from old.decisions then
    if not public.is_contract_org_side(old.contract_id) then
      raise exception 'contract_deliverables: only the organization may approve, reject or record a decision'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_deliverable_update_authority() from public, anon, authenticated;

drop trigger if exists contract_deliverables_enforce_update_authority on contract_deliverables;
create trigger contract_deliverables_enforce_update_authority
  before update on contract_deliverables
  for each row execute function public.enforce_deliverable_update_authority();

create or replace function public.enforce_deliverable_insert_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;
  -- A deliverable cannot be born approved by the agent side.
  if (new.status = 'approved' or new.approved_at is not null
      or coalesce(jsonb_array_length(new.decisions), 0) > 0)
     and not public.is_contract_org_side(new.contract_id) then
    raise exception 'contract_deliverables: only the organization may approve'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_deliverable_insert_authority() from public, anon, authenticated;

drop trigger if exists contract_deliverables_enforce_insert_authority on contract_deliverables;
create trigger contract_deliverables_enforce_insert_authority
  before insert on contract_deliverables
  for each row execute function public.enforce_deliverable_insert_authority();

create or replace function public.enforce_milestone_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.contract_id is distinct from old.contract_id then
    raise exception 'contract_milestones: contract_id is immutable' using errcode = '42501';
  end if;
  -- Either party may add and edit milestones; completion is confirmed by the
  -- organization, because completed milestones drive contract progress.
  if new.completed
     and (tg_op = 'INSERT' or old.completed is distinct from true)
     and not public.is_contract_org_side(new.contract_id) then
    raise exception 'contract_milestones: only the organization may mark a milestone complete'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_milestone_authority() from public, anon, authenticated;

drop trigger if exists contract_milestones_enforce_authority on contract_milestones;
create trigger contract_milestones_enforce_authority
  before insert or update on contract_milestones
  for each row execute function public.enforce_milestone_authority();

-- 6. Disputes: either party may open one or mark it under review; only the
--    party that opened it may mark it resolved.
create or replace function public.enforce_dispute_update_authority()
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
  if new.contract_id is distinct from old.contract_id
     or new.owner_id is distinct from old.owner_id then
    raise exception 'disputes: contract_id and owner_id are immutable' using errcode = '42501';
  end if;
  if new.status = 'Resolved' and old.status is distinct from 'Resolved'
     and old.owner_id is distinct from actor then
    raise exception 'disputes: only the party that opened a dispute may resolve it'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_dispute_update_authority() from public, anon, authenticated;

drop trigger if exists disputes_enforce_update_authority on disputes;
create trigger disputes_enforce_update_authority
  before update on disputes
  for each row execute function public.enforce_dispute_update_authority();

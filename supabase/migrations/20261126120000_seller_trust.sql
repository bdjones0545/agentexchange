-- Two answers sellers kept emailing support for (2026-11-26).
--
-- 1. "Can I withdraw before the buyer accepts?" An applicant could not: only the
--    organization could move an application out of pending. The applicant side
--    (the profile that applied, or the agent's owner) may now withdraw a pending
--    application. Accepting and rejecting stay organization-side only, and a
--    withdrawn application can no longer become a contract
--    (accept_contract_application requires pending or accepted).
--
-- 2. "Is this brief real, and has anyone been hired?" Brief pages could not say,
--    because applications, negotiations and contracts are private to their
--    parties. brief_public_facts returns counts only, never who or how much: how
--    many agents have proposed, how many funded contracts the brief has, when
--    the organization joined, and how many of its contracts were paid in live
--    mode. Unfunded contracts are not counted as hires.
--
-- Replaces one function and adds one. Safe to run more than once.

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

    if new.status = 'withdrawn' then
      -- Only the applicant side may withdraw its own application.
      if not (old.owner_id = actor or public.is_agent_owner(old.agent_id)) then
        raise exception 'applications: only the applicant may withdraw an application'
          using errcode = '42501';
      end if;
      return new;
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
revoke all on function public.enforce_application_update_authority() from public, anon, authenticated;

create or replace function public.brief_public_facts(brief_ids uuid[])
returns table (
  opportunity_id uuid,
  proposals integer,
  funded_contracts integer,
  organization_since timestamptz,
  organization_paid_contracts integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    (select count(distinct x.agent_id)::integer from (
       select a.agent_id from public.applications a
        where a.opportunity_id = o.id and a.status <> 'withdrawn'
       union
       select n.agent_id from public.negotiations n
        where n.opportunity_id = o.id
     ) x),
    (select count(*)::integer from public.contracts c
      where c.organization_id = o.organization_id
        and public.contract_source_opportunity(c.source_type, c.source_id) = o.id
        and c.payment_status in ('authorized', 'captured', 'paid_out')),
    org.created_at,
    (select count(distinct p.contract_id)::integer from public.payments p
       join public.contracts c on c.id = p.contract_id
      where c.organization_id = o.organization_id
        and p.provider_mode = 'live'
        and p.status = 'captured')
  from public.opportunities o
  left join public.organizations org on org.id = o.organization_id
  where o.id = any (brief_ids[1:200]);
$$;
revoke all on function public.brief_public_facts(uuid[]) from public;
grant execute on function public.brief_public_facts(uuid[]) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

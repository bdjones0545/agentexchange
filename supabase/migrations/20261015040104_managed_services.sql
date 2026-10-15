-- Managed services: agents that work inside the buyer's own accounts (paid ads,
-- SEO, social, email) for a number of weeks, paid one week at a time.
-- See docs/MANAGED_SERVICES.md.
--
-- 1. A brief can be a managed service. It names the kind of work, the platforms
--    the buyer will share access to, an optional weekly ad-spend cap (spend the
--    buyer pays the platform directly, never through AgentExchange) and how many
--    weeks the service runs.
-- 2. Each contract freezes those terms in contracts.service_terms when it is
--    created, so editing the brief later cannot change an agreed contract.
-- 3. A managed-service contract is born with its checklist: access shared on
--    each platform, plan approved, launched, and the week's report. Only the
--    organization can tick milestones off (enforce_milestone_authority).
-- 4. Week N+1 is a new contract with source_type 'renewal' and source_id the
--    week-N contract. It copies the price and terms, and is allowed only between
--    the same two parties, while week N is funded or paid, and only up to the
--    number of weeks the agent agreed to. uq_contracts_source allows one renewal
--    per contract.
--
-- Additive: new nullable columns, functions and triggers. Apply before deploying
-- the code that reads these columns.

alter table public.opportunities
  add column if not exists work_type text not null default 'deliverable',
  add column if not exists service_kind text,
  add column if not exists service_platforms text[] not null default '{}',
  add column if not exists ad_spend_cap_cents integer,
  add column if not exists service_weeks integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'opportunities_managed_service_terms') then
    alter table public.opportunities
      add constraint opportunities_managed_service_terms check (
        work_type in ('deliverable', 'managed_service')
        and (service_kind is null or service_kind in ('paid_ads', 'seo', 'social', 'email', 'other'))
        and cardinality(service_platforms) <= 8
        and char_length(array_to_string(service_platforms, '|')) <= 400
        and (ad_spend_cap_cents is null or ad_spend_cap_cents between 0 and 100000000)
        and (service_weeks is null or service_weeks between 1 and 52)
        and (work_type <> 'managed_service' or (service_kind is not null and service_weeks is not null))
      );
  end if;
end $$;

alter table public.contracts add column if not exists service_terms jsonb;

-- The brief a contract source belongs to. Internal: used by the triggers below.
create or replace function public.contract_source_opportunity(source_type_in text, source_id_in uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case source_type_in
    when 'application' then (select opportunity_id from public.applications where id = source_id_in)
    when 'negotiation' then (select opportunity_id from public.negotiations where id = source_id_in)
    when 'hire-request' then (select opportunity_id from public.hire_requests where id = source_id_in)
    else null
  end
$$;

revoke all on function public.contract_source_opportunity(text, uuid) from public, anon, authenticated;

-- Freeze service terms at creation; copy price and terms for a renewal.
create or replace function public.apply_contract_service_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prev public.contracts%rowtype;
  opp public.opportunities%rowtype;
  next_week integer;
begin
  if tg_op = 'UPDATE' then
    if new.service_terms is distinct from old.service_terms and public.current_profile_id() is not null then
      raise exception 'contracts: service terms are fixed when the contract is created'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.source_type = 'renewal' then
    select * into prev from public.contracts where id = new.source_id;
    if not found or prev.service_terms is null then
      raise exception 'contracts: only a managed-service contract can be renewed'
        using errcode = '42501';
    end if;
    next_week := coalesce((prev.service_terms->>'week')::integer, 1) + 1;
    new.amount_cents := prev.amount_cents;
    new.currency := prev.currency;
    new.title := regexp_replace(prev.title, ' · week [0-9]+$', '') || ' · week ' || next_week;
    new.service_terms := prev.service_terms || jsonb_build_object('week', next_week, 'renewedFrom', prev.id);
    return new;
  end if;

  -- Never trust terms supplied by a browser or agent: derive them from the brief.
  new.service_terms := null;
  select o.* into opp
    from public.opportunities o
   where o.id = public.contract_source_opportunity(new.source_type, new.source_id);
  if found and opp.work_type = 'managed_service' then
    new.service_terms := jsonb_build_object(
      'kind', opp.service_kind,
      'platforms', to_jsonb(opp.service_platforms),
      'adSpendCapCents', opp.ad_spend_cap_cents,
      'weeks', opp.service_weeks,
      'week', 1,
      'opportunityId', opp.id
    );
  end if;
  return new;
end;
$$;

revoke all on function public.apply_contract_service_terms() from public, anon, authenticated;

drop trigger if exists contracts_apply_service_terms on public.contracts;
create trigger contracts_apply_service_terms
  before insert or update on public.contracts
  for each row execute function public.apply_contract_service_terms();

-- A managed-service contract starts with its checklist.
create or replace function public.seed_service_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
  week integer;
  weeks integer;
  cap integer;
  cap_text text := '';
  platform text;
  plan_scope text;
  launch_title text;
  launch_notes text;
begin
  if new.service_terms is null then
    return new;
  end if;

  kind := coalesce(new.service_terms->>'kind', 'other');
  week := coalesce((new.service_terms->>'week')::integer, 1);
  weeks := coalesce((new.service_terms->>'weeks')::integer, week);
  cap := (new.service_terms->>'adSpendCapCents')::integer;
  if cap is not null then
    cap_text := ' Ad spend stays within $'
      || case when cap % 100 = 0 then (cap / 100)::text else to_char(cap / 100.0, 'FM999999990.00') end
      || ' this week, billed by the platform to your own account.';
  end if;

  plan_scope := case kind
    when 'paid_ads' then 'audience, creative, copy and budget'
    when 'seo' then 'audit findings and the exact changes to make'
    when 'social' then 'content calendar and the first posts'
    when 'email' then 'audience segments, sequence and copy'
    else 'the plan for the work'
  end;
  launch_title := case kind
    when 'paid_ads' then 'Campaigns live'
    when 'seo' then 'Changes published'
    when 'social' then 'Posting started'
    when 'email' then 'Sending started'
    else 'Work started'
  end;
  launch_notes := case kind
    when 'paid_ads' then 'The agent posts the campaign IDs and live links.'
    when 'seo' then 'The agent lists every page changed, with before and after.'
    when 'social' then 'The agent posts links to the published posts.'
    when 'email' then 'The agent posts the campaign names and send reports.'
    else 'The agent posts links to what changed.'
  end;

  if week = 1 then
    for platform in select jsonb_array_elements_text(coalesce(new.service_terms->'platforms', '[]'::jsonb)) loop
      insert into public.contract_milestones (contract_id, title, notes, completed)
      values (
        new.id,
        'Access shared: ' || platform,
        'Add the agent''s operator through ' || platform || '''s own partner or user settings, with the least access the work needs. Never share a password. You can remove the access at any time.',
        false
      );
    end loop;
    insert into public.contract_milestones (contract_id, title, notes, completed)
    values (
      new.id,
      'Plan approved',
      'The agent submits the plan as a deliverable: ' || plan_scope || '. Nothing goes live until you approve it.' || cap_text,
      false
    );
    insert into public.contract_milestones (contract_id, title, notes, completed)
    values (new.id, launch_title, launch_notes, false);
  end if;

  insert into public.contract_milestones (contract_id, title, notes, completed)
  values (
    new.id,
    'Week ' || week || ' of ' || weeks || ' report',
    'Spend, results and next steps, with links you can check.' || cap_text,
    false
  );
  return new;
end;
$$;

revoke all on function public.seed_service_milestones() from public, anon, authenticated;

drop trigger if exists contracts_seed_service_milestones on public.contracts;
create trigger contracts_seed_service_milestones
  after insert on public.contracts
  for each row execute function public.seed_service_milestones();

-- Who may create a contract from which source. Adds 'renewal'; the application
-- and negotiation cases are unchanged.
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
    when 'renewal' then exists (
      select 1
      from public.contracts p
      where p.id = source_id_in
        and p.agent_id = agent_uuid
        and p.organization_id = organization_uuid
        and p.service_terms is not null
        and coalesce((p.service_terms->>'week')::integer, 1) < coalesce((p.service_terms->>'weeks')::integer, 1)
        and p.payment_status in ('authorized', 'captured', 'paid_out')
        and p.status not in ('Cancelled', 'Disputed')
    )
    else false
  end
$$;

revoke all on function public.contract_source_consents(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.contract_source_consents(text, uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

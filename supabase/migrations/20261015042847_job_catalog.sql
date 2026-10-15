-- The job catalog (src/lib/jobCatalog.ts, docs/AGENT_JOBS.md) in the database.
--
-- 1. Every brief can name its job kind (opportunities.job_kind), and every
--    contract records the job kind of the brief it came from (contracts.job_kind),
--    derived by the database and immutable, like service_terms.
-- 2. A managed-service brief carries its week-1 checklist (service_checklist)
--    and limits beyond the ad-spend cap (service_limits) as data. Both are
--    frozen into contracts.service_terms, and the checklist seeds the contract's
--    milestones. New kinds therefore need no migration; service_kind is any
--    catalog id rather than a fixed list.
-- 3. Agent listings declare the job kinds they do (agents.job_kinds), so buyers
--    and the matcher can find the right agent.
--
-- Additive except the replaced check constraint, which only widens what is
-- allowed (catalog ids instead of five kinds; up to 12 platforms). Apply before
-- deploying the code that reads these columns.

alter table public.opportunities
  add column if not exists job_kind text,
  add column if not exists service_checklist jsonb,
  add column if not exists service_limits jsonb;

alter table public.contracts add column if not exists job_kind text;

alter table public.agents add column if not exists job_kinds text[] not null default '{}';

alter table public.opportunities drop constraint if exists opportunities_managed_service_terms;
alter table public.opportunities
  add constraint opportunities_managed_service_terms check (
    work_type in ('deliverable', 'managed_service')
    and (job_kind is null or job_kind ~ '^[a-z][a-z0-9_]{1,39}$')
    and (service_kind is null or service_kind ~ '^[a-z][a-z0-9_]{1,39}$')
    and cardinality(service_platforms) <= 12
    and char_length(array_to_string(service_platforms, '|')) <= 600
    and (ad_spend_cap_cents is null or ad_spend_cap_cents between 0 and 100000000)
    and (service_weeks is null or service_weeks between 1 and 52)
    and (service_checklist is null or (
      jsonb_typeof(service_checklist) = 'array'
      and jsonb_array_length(service_checklist) <= 10
      and octet_length(service_checklist::text) <= 6000
    ))
    and (service_limits is null or (
      jsonb_typeof(service_limits) = 'object'
      and octet_length(service_limits::text) <= 500
    ))
    and (work_type <> 'managed_service' or (service_kind is not null and service_weeks is not null))
  );

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agents_job_kinds_check') then
    alter table public.agents
      add constraint agents_job_kinds_check check (
        cardinality(job_kinds) <= 24
        and array_to_string(job_kinds, ',') ~ '^([a-z][a-z0-9_]{1,39}(,[a-z][a-z0-9_]{1,39})*)?$'
      );
  end if;
end $$;

-- Freeze service terms and the job kind at creation; copy them for a renewal.
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
    if public.current_profile_id() is not null
       and (new.service_terms is distinct from old.service_terms or new.job_kind is distinct from old.job_kind) then
      raise exception 'contracts: service terms and job kind are fixed when the contract is created'
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
    new.job_kind := prev.job_kind;
    return new;
  end if;

  -- Never trust terms supplied by a browser or agent: derive them from the brief.
  new.service_terms := null;
  new.job_kind := null;
  select o.* into opp
    from public.opportunities o
   where o.id = public.contract_source_opportunity(new.source_type, new.source_id);
  if found then
    new.job_kind := coalesce(opp.job_kind, opp.service_kind);
    if opp.work_type = 'managed_service' then
      new.service_terms := jsonb_build_object(
        'kind', opp.service_kind,
        'platforms', to_jsonb(opp.service_platforms),
        'adSpendCapCents', opp.ad_spend_cap_cents,
        'weeks', opp.service_weeks,
        'week', 1,
        'opportunityId', opp.id,
        'checklist', coalesce(opp.service_checklist, '[]'::jsonb),
        'limits', coalesce(opp.service_limits, '{}'::jsonb)
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.apply_contract_service_terms() from public, anon, authenticated;

-- A managed-service contract starts with its checklist: access per platform,
-- the brief's checklist (or the built-in one for briefs saved before the
-- catalog), then the week's report. Each milestone gets a strictly later
-- created_at so the checklist reads in order (rows in one transaction would
-- otherwise share now()).
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
  item jsonb;
  checklist jsonb;
  plan_scope text;
  launch_title text;
  launch_notes text;
  seq integer := 0;
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
  checklist := new.service_terms->'checklist';

  if week = 1 then
    for platform in select jsonb_array_elements_text(coalesce(new.service_terms->'platforms', '[]'::jsonb)) loop
      insert into public.contract_milestones (contract_id, title, notes, completed, created_at)
      values (
        new.id,
        'Access shared: ' || platform,
        'Add the agent''s operator through ' || platform || '''s own partner or user settings, with the least access the work needs. Never share a password. You can remove the access at any time.',
        false,
        now() + seq * interval '1 millisecond'
      );
      seq := seq + 1;
    end loop;

    if jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) > 0 then
      for item in select value from jsonb_array_elements(checklist) loop
        if jsonb_typeof(item) = 'object' and coalesce(btrim(item->>'title'), '') <> '' then
          insert into public.contract_milestones (contract_id, title, notes, completed, created_at)
          values (new.id, left(item->>'title', 160), left(coalesce(item->>'notes', ''), 1000), false, now() + seq * interval '1 millisecond');
          seq := seq + 1;
        end if;
      end loop;
    else
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
      insert into public.contract_milestones (contract_id, title, notes, completed, created_at)
      values (
        new.id,
        'Plan approved',
        'The agent submits the plan as a deliverable: ' || plan_scope || '. Nothing goes live until you approve it.' || cap_text,
        false,
        now() + seq * interval '1 millisecond'
      );
      seq := seq + 1;
      insert into public.contract_milestones (contract_id, title, notes, completed, created_at)
      values (new.id, launch_title, launch_notes, false, now() + seq * interval '1 millisecond');
      seq := seq + 1;
    end if;
  end if;

  insert into public.contract_milestones (contract_id, title, notes, completed, created_at)
  values (
    new.id,
    'Week ' || week || ' of ' || weeks || ' report',
    'Spend, results and next steps, with links you can check.' || cap_text,
    false,
    now() + seq * interval '1 millisecond'
  );
  return new;
end;
$$;

revoke all on function public.seed_service_milestones() from public, anon, authenticated;

notify pgrst, 'reload schema';

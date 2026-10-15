-- Managed services: a "Customer support" kind, for agents that answer customer
-- emails, chats or phone calls in the buyer's own help desk, inbox or phone
-- system. Builds on 20261015040104_managed_services.sql; see
-- docs/MANAGED_SERVICES.md.
--
-- 1. A support brief adds: the channels the agent answers (email, chat, phone),
--    the coverage hours (free text), the expected weekly volume, and an
--    authority limit: the most the agent may refund or credit one customer, and
--    who it escalates to. A support brief must state at least one channel, the
--    limit (0 means no refunds) and the contact; the agent rules and the quality
--    gate depend on them.
-- 2. The contract freezes them in contracts.service_terms->'support', derived
--    from the brief like the other terms. A renewal copies the previous week's
--    terms, so the limit cannot change mid-service.
-- 3. The support week-1 checklist: access shared on each platform, Playbook
--    approved, Go-live (ticked by the buyer after reviewing test
--    conversations), and the week's report. Other kinds are unchanged.
--
-- Additive: new columns with defaults, a widened check and replaced trigger
-- functions. Apply after 20261015040104_managed_services.sql and before
-- deploying the code that reads these columns. Safe to run more than once; if
-- 20261015040104 is ever re-run, run this one again after it, because that one
-- would put back the functions without the support terms.

alter table public.opportunities
  add column if not exists support_channels text[] not null default '{}',
  add column if not exists support_hours text,
  add column if not exists support_weekly_volume integer,
  add column if not exists refund_limit_cents integer,
  add column if not exists escalation_contact text;

alter table public.opportunities
  drop constraint if exists opportunities_managed_service_terms,
  add constraint opportunities_managed_service_terms check (
    work_type in ('deliverable', 'managed_service')
    and (service_kind is null or service_kind in ('paid_ads', 'seo', 'social', 'email', 'support', 'other'))
    and cardinality(service_platforms) <= 8
    and char_length(array_to_string(service_platforms, '|')) <= 400
    and (ad_spend_cap_cents is null or ad_spend_cap_cents between 0 and 100000000)
    and (service_weeks is null or service_weeks between 1 and 52)
    and (work_type <> 'managed_service' or (service_kind is not null and service_weeks is not null))
    and support_channels <@ array['email', 'chat', 'phone']::text[]
    and cardinality(support_channels) <= 3
    and (support_hours is null or char_length(btrim(support_hours)) between 1 and 160)
    and (support_weekly_volume is null or support_weekly_volume between 1 and 1000000)
    and (refund_limit_cents is null or refund_limit_cents between 0 and 100000000)
    and (escalation_contact is null or char_length(btrim(escalation_contact)) between 1 and 200)
    and (
      service_kind is distinct from 'support'
      or (cardinality(support_channels) >= 1 and refund_limit_cents is not null and escalation_contact is not null)
    )
  );

-- Freeze service terms at creation; copy price and terms for a renewal.
-- Unchanged from 20261015040104 except the support terms.
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
    if opp.service_kind = 'support' then
      new.service_terms := new.service_terms || jsonb_build_object('support', jsonb_build_object(
        'channels', to_jsonb(opp.support_channels),
        'hours', opp.support_hours,
        'weeklyVolume', opp.support_weekly_volume,
        'refundLimitCents', opp.refund_limit_cents,
        'escalationContact', opp.escalation_contact
      ));
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.apply_contract_service_terms() from public, anon, authenticated;

-- A managed-service contract starts with its checklist. Unchanged from
-- 20261015040104 for every kind but support.
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
  refund_limit integer;
  contact text;
  authority_text text := '';
  platform text;
  plan_title text := 'Plan approved';
  plan_noun text := 'plan';
  plan_hold text := 'Nothing goes live until you approve it.';
  plan_scope text;
  launch_title text;
  launch_notes text;
  report_notes text := 'Spend, results and next steps, with links you can check.';
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

  if kind = 'support' then
    -- An unknown limit reads as none: the agent may not refund at all.
    refund_limit := coalesce((new.service_terms #>> '{support,refundLimitCents}')::integer, 0);
    contact := coalesce(nullif(btrim(new.service_terms #>> '{support,escalationContact}'), ''), 'you');
    authority_text := case when refund_limit > 0
      then ' The agent may refund or credit up to $'
        || case when refund_limit % 100 = 0 then (refund_limit / 100)::text else to_char(refund_limit / 100.0, 'FM999999990.00') end
        || ' per customer; anything more goes to ' || contact || '.'
      else ' The agent may not refund or credit customers; every request goes to ' || contact || '.'
    end;
    plan_title := 'Playbook approved';
    plan_noun := 'playbook';
    plan_hold := 'No customer hears from the agent until you approve it and then tick Go-live.';
    report_notes := 'Volume, response time, resolution rate, CSAT, escalations, refunds and credits, and sample transcripts, with ticket or conversation IDs you can check.';
  end if;

  plan_scope := case kind
    when 'paid_ads' then 'audience, creative, copy and budget'
    when 'seo' then 'audit findings and the exact changes to make'
    when 'social' then 'content calendar and the first posts'
    when 'email' then 'audience segments, sequence and copy'
    when 'support' then 'FAQs and answers, tone, refund and credit rules, and when to escalate'
    else 'the plan for the work'
  end;
  launch_title := case kind
    when 'paid_ads' then 'Campaigns live'
    when 'seo' then 'Changes published'
    when 'social' then 'Posting started'
    when 'email' then 'Sending started'
    when 'support' then 'Go-live'
    else 'Work started'
  end;
  launch_notes := case kind
    when 'paid_ads' then 'The agent posts the campaign IDs and live links.'
    when 'seo' then 'The agent lists every page changed, with before and after.'
    when 'social' then 'The agent posts links to the published posts.'
    when 'email' then 'The agent posts the campaign names and send reports.'
    when 'support' then 'The agent submits test conversations for you to review. Tick this when you are happy with them; the agent answers no real customers before you do.'
    else 'The agent posts links to what changed.'
  end;

  if week = 1 then
    for platform in select jsonb_array_elements_text(coalesce(new.service_terms->'platforms', '[]'::jsonb)) loop
      insert into public.contract_milestones (contract_id, title, notes, completed)
      values (
        new.id,
        'Access shared: ' || platform,
        case when kind = 'support'
          then 'Give the agent''s operator its own agent seat or user on ' || platform || ', with the least access the work needs; for a phone line you can forward the number instead. Never share a password. You can remove the access at any time.'
          else 'Add the agent''s operator through ' || platform || '''s own partner or user settings, with the least access the work needs. Never share a password. You can remove the access at any time.'
        end,
        false
      );
    end loop;
    insert into public.contract_milestones (contract_id, title, notes, completed)
    values (
      new.id,
      plan_title,
      'The agent submits the ' || plan_noun || ' as a deliverable: ' || plan_scope || '. ' || plan_hold || cap_text || authority_text,
      false
    );
    insert into public.contract_milestones (contract_id, title, notes, completed)
    values (new.id, launch_title, launch_notes, false);
  end if;

  insert into public.contract_milestones (contract_id, title, notes, completed)
  values (
    new.id,
    'Week ' || week || ' of ' || weeks || ' report',
    report_notes || cap_text || authority_text,
    false
  );
  return new;
end;
$$;

revoke all on function public.seed_service_milestones() from public, anon, authenticated;

notify pgrst, 'reload schema';

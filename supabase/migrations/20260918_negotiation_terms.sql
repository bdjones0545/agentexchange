-- ---------------------------------------------------------------------------
-- Negotiation closes the loop (2026-09-18).
--
-- Before: an agent could propose terms and the organization could accept,
-- counter or reject, but nothing let the agent answer a counter, and terms
-- were free text so an accepted negotiation carried no price a contract could
-- use. Now:
--   * negotiations.amount_cents         the agent's proposed price (write-once)
--   * negotiations.counter_amount_cents the organization's counter (org-side only)
--   * countering is organization-side only; the agent answers with accept,
--     withdraw, or a fresh negotiation
--   * the agent may accept a COUNTERED negotiation (the organization already
--     consented to those terms by proposing them); accepting a PENDING one
--     stays organization-only
--   * accepted_by records which side closed it, so the price is unambiguous
--   * materialize_negotiation_contract() derives the contract from an accepted
--     negotiation the way the hire-request RPC does — nothing from the caller
-- ---------------------------------------------------------------------------
alter table negotiations add column if not exists amount_cents integer;
alter table negotiations add column if not exists counter_amount_cents integer;
alter table negotiations add column if not exists currency text not null default 'USD';
alter table negotiations add column if not exists accepted_by text;

alter table negotiations drop constraint if exists negotiations_amount_cents_check;
alter table negotiations add constraint negotiations_amount_cents_check
  check (amount_cents is null or amount_cents >= 0);
alter table negotiations drop constraint if exists negotiations_counter_amount_cents_check;
alter table negotiations add constraint negotiations_counter_amount_cents_check
  check (counter_amount_cents is null or counter_amount_cents >= 0);
alter table negotiations drop constraint if exists negotiations_currency_check;
alter table negotiations add constraint negotiations_currency_check
  check (currency ~ '^[A-Z]{3}$');
alter table negotiations drop constraint if exists negotiations_accepted_by_check;
alter table negotiations add constraint negotiations_accepted_by_check
  check (accepted_by is null or accepted_by in ('organization', 'agent'));

create or replace function public.enforce_negotiation_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
  org_side boolean;
  agent_side boolean;
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

  -- The proposed price is stated once. accepted_by is set here, never by a caller.
  if new.amount_cents is distinct from old.amount_cents
     or new.currency is distinct from old.currency then
    raise exception 'negotiations: the proposed price is immutable'
      using errcode = '42501';
  end if;
  new.accepted_by := old.accepted_by;

  org_side := public.is_opportunity_org_side(old.opportunity_id);
  agent_side := public.is_agent_owner(old.agent_id);

  -- Counter terms are the organization's to write.
  if (new.counter_rate is distinct from old.counter_rate
      or new.counter_timeline is distinct from old.counter_timeline
      or new.counter_note is distinct from old.counter_note
      or new.counter_amount_cents is distinct from old.counter_amount_cents)
     and not org_side then
    raise exception 'negotiations: only the organization may counter'
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

    if new.status = 'countered' and not org_side then
      raise exception 'negotiations: only the organization may counter'
        using errcode = '42501';
    end if;

    if new.status = 'accepted' then
      if org_side then
        new.accepted_by := 'organization';
      elsif agent_side and old.status = 'countered' then
        -- The organization consented to these terms by proposing them.
        new.accepted_by := 'agent';
      else
        raise exception 'negotiations: the agent may accept only a countered negotiation; the organization accepts proposals'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_negotiation_update_authority() from public, anon, authenticated;

create or replace function public.enforce_negotiation_insert_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;
  new.currency := upper(coalesce(new.currency, 'USD'));
  new.counter_amount_cents := null;
  new.accepted_by := null;
  return new;
end;
$$;
revoke all on function public.enforce_negotiation_insert_columns() from public, anon, authenticated;

drop trigger if exists negotiations_enforce_insert_columns on negotiations;
create trigger negotiations_enforce_insert_columns
  before insert on negotiations
  for each row execute function public.enforce_negotiation_insert_columns();

-- Derive a contract from an accepted negotiation. Mirrors the hire-request RPC:
-- either party may call it, only after acceptance, idempotent, and every field
-- comes from the rows — the price from whichever side closed the deal.
create or replace function public.materialize_negotiation_contract(negotiation_uuid uuid)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  neg negotiations%rowtype;
  opp opportunities%rowtype;
  org organizations%rowtype;
  the_agent agents%rowtype;
  existing contracts%rowtype;
  materialized contracts%rowtype;
  price integer;
begin
  if public.current_profile_id() is null then
    raise exception 'materialize_negotiation_contract: authentication required'
      using errcode = '42501';
  end if;

  select * into neg from negotiations where id = negotiation_uuid for update;
  if not found then
    raise exception 'materialize_negotiation_contract: negotiation not found'
      using errcode = '42501';
  end if;

  if not (public.is_agent_owner(neg.agent_id) or public.is_opportunity_org_side(neg.opportunity_id)) then
    raise exception 'materialize_negotiation_contract: caller is not a party to this negotiation'
      using errcode = '42501';
  end if;

  if neg.status <> 'accepted' then
    raise exception 'materialize_negotiation_contract: negotiation is "%", not accepted', neg.status
      using errcode = '42501';
  end if;

  select * into existing from contracts where source_type = 'negotiation' and source_id = neg.id;
  if found then
    return existing;
  end if;

  select * into opp from opportunities where id = neg.opportunity_id;
  if not found or opp.organization_id is null then
    raise exception 'materialize_negotiation_contract: opportunity has no organization'
      using errcode = '42501';
  end if;
  select * into org from organizations where id = opp.organization_id;
  if not found then
    raise exception 'materialize_negotiation_contract: organization not found'
      using errcode = '42501';
  end if;
  select * into the_agent from agents where id = neg.agent_id;
  if not found then
    raise exception 'materialize_negotiation_contract: agent not found'
      using errcode = '42501';
  end if;

  price := case
    when neg.accepted_by = 'agent' then coalesce(neg.counter_amount_cents, neg.amount_cents)
    else neg.amount_cents
  end;

  insert into contracts (
    agent_id, agent_name, due_date, organization_id, organization_name,
    progress, source_id, source_type, start_date, status, title, value,
    amount_cents, currency
  ) values (
    the_agent.id,
    the_agent.name,
    to_char(now() + interval '21 days', 'YYYY-MM-DD'),
    org.id,
    org.name,
    5,
    neg.id,
    'negotiation',
    to_char(now(), 'YYYY-MM-DD'),
    'Active',
    coalesce(opp.title, 'Negotiated contract'),
    coalesce(case when neg.accepted_by = 'agent' then neg.counter_rate end, neg.rate, opp.budget_range, 'Custom scope'),
    price,
    coalesce(neg.currency, 'USD')
  )
  returning * into materialized;

  return materialized;
end;
$$;
revoke all on function public.materialize_negotiation_contract(uuid) from public;
revoke all on function public.materialize_negotiation_contract(uuid) from anon;
grant execute on function public.materialize_negotiation_contract(uuid) to authenticated;

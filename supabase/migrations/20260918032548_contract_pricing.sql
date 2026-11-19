-- ---------------------------------------------------------------------------
-- Phase 0 of payments (2026-09-18): the price becomes a number.
--
-- Until now a contract's worth was a text range copied from the opportunity
-- ("$400 - $800"), so nothing could ever be charged or paid out. This adds:
--   * contracts.amount_cents / currency          the agreed price, set once at creation
--   * contracts.payment_status / platform_fee_bps platform-managed money state
--   * hire_requests.amount_cents / currency      the organization's offer; the agent's
--                                                acceptance is consent to it, and the
--                                                materialize RPC copies it verbatim
--   * payments, payouts                          the ledger, written only by the platform
--
-- Authority follows the trust-column pattern: end users may state a price when a
-- record is born and never change it; payment_status, the fee snapshot and the
-- ledger tables are immutable to authenticated users and are written by the
-- service role (Stripe webhooks, later phases) only. No money moves yet.
-- ---------------------------------------------------------------------------

-- Single source for the platform's take rate, snapshotted onto every contract at
-- creation so a later change never re-prices existing agreements.
create or replace function public.platform_fee_bps()
returns integer
language sql
immutable
as $$
  select 1500
$$;

alter table contracts add column if not exists amount_cents integer;
alter table contracts add column if not exists currency text not null default 'USD';
alter table contracts add column if not exists payment_status text not null default 'unfunded';
alter table contracts add column if not exists platform_fee_bps integer not null default 1500;

alter table contracts drop constraint if exists contracts_amount_cents_check;
alter table contracts add constraint contracts_amount_cents_check
  check (amount_cents is null or amount_cents >= 0);
alter table contracts drop constraint if exists contracts_currency_check;
alter table contracts add constraint contracts_currency_check
  check (currency ~ '^[A-Z]{3}$');
alter table contracts drop constraint if exists contracts_payment_status_check;
alter table contracts add constraint contracts_payment_status_check
  check (payment_status in ('unfunded', 'authorized', 'captured', 'paid_out', 'refunded'));
alter table contracts drop constraint if exists contracts_platform_fee_bps_check;
alter table contracts add constraint contracts_platform_fee_bps_check
  check (platform_fee_bps between 0 and 10000);

alter table hire_requests add column if not exists amount_cents integer;
alter table hire_requests add column if not exists currency text not null default 'USD';
alter table hire_requests drop constraint if exists hire_requests_amount_cents_check;
alter table hire_requests add constraint hire_requests_amount_cents_check
  check (amount_cents is null or amount_cents >= 0);
alter table hire_requests drop constraint if exists hire_requests_currency_check;
alter table hire_requests add constraint hire_requests_currency_check
  check (currency ~ '^[A-Z]{3}$');

-- Money columns on contracts: stated once, then platform-managed.
create or replace function public.enforce_contract_money_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    -- Service role (webhooks, operators of the platform): unrestricted.
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A contract is born unfunded at the current take rate, whatever the caller sent.
    new.payment_status := 'unfunded';
    new.platform_fee_bps := public.platform_fee_bps();
    new.currency := upper(coalesce(new.currency, 'USD'));
    return new;
  end if;

  if new.amount_cents is distinct from old.amount_cents
     or new.currency is distinct from old.currency then
    raise exception 'contracts: the agreed price is immutable'
      using errcode = '42501';
  end if;
  if new.payment_status is distinct from old.payment_status
     or new.platform_fee_bps is distinct from old.platform_fee_bps then
    raise exception 'contracts: payment_status and platform_fee_bps are platform-managed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_contract_money_columns() from public, anon, authenticated;

drop trigger if exists contracts_enforce_money_columns on contracts;
create trigger contracts_enforce_money_columns
  before insert or update on contracts
  for each row execute function public.enforce_contract_money_columns();

-- An offer cannot change once the agent can see it; withdraw and reissue instead.
create or replace function public.enforce_hire_request_money_columns()
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
    new.currency := upper(coalesce(new.currency, 'USD'));
    return new;
  end if;
  if new.amount_cents is distinct from old.amount_cents
     or new.currency is distinct from old.currency then
    raise exception 'hire_requests: the offered price is immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_hire_request_money_columns() from public, anon, authenticated;

drop trigger if exists hire_requests_enforce_money_columns on hire_requests;
create trigger hire_requests_enforce_money_columns
  before insert or update on hire_requests
  for each row execute function public.enforce_hire_request_money_columns();

-- The ledger. Participants may read their own rows; nobody but the platform writes.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  provider text not null default 'stripe',
  provider_ref text unique,
  kind text not null check (kind in ('charge', 'refund')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('pending', 'authorized', 'captured', 'refunded', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  operator_profile_id uuid references profiles(id) on delete set null,
  gross_cents integer not null check (gross_cents >= 0),
  fee_cents integer not null check (fee_cents >= 0),
  net_cents integer not null check (net_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (net_cents = gross_cents - fee_cents)
);

create index if not exists idx_payments_contract_id on payments(contract_id);
create index if not exists idx_payouts_contract_id on payouts(contract_id);
create index if not exists idx_payouts_operator_profile_id on payouts(operator_profile_id);

create or replace trigger payments_set_updated_at
  before update on payments
  for each row execute function public.set_updated_at();
create or replace trigger payouts_set_updated_at
  before update on payouts
  for each row execute function public.set_updated_at();

alter table payments enable row level security;
alter table payouts enable row level security;

drop policy if exists "payments_participant_read" on payments;
create policy "payments_participant_read" on payments
  for select to authenticated
  using (public.can_access_contract(contract_id));

drop policy if exists "payouts_participant_read" on payouts;
create policy "payouts_participant_read" on payouts
  for select to authenticated
  using (public.can_access_contract(contract_id));

-- No insert/update/delete policies exist for authenticated, and the grants are
-- withdrawn too, so a future policy mistake cannot quietly reopen the ledger.
revoke insert, update, delete on payments from anon, authenticated;
revoke insert, update, delete on payouts from anon, authenticated;

-- The materialize RPC now carries the offered price onto the contract.
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
    progress, source_id, source_type, start_date, status, title, value,
    amount_cents, currency
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
    coalesce(opp.budget_range, 'Custom scope'),
    -- The agreed price is the organization's offer on the hire request; the
    -- agent's acceptance (gated to the agent's owner) is consent to it.
    hr.amount_cents,
    coalesce(hr.currency, 'USD')
  )
  returning * into materialized;

  return materialized;
end;
$$;
revoke all on function public.materialize_hire_request_contract(uuid) from public;
revoke all on function public.materialize_hire_request_contract(uuid) from anon;
grant execute on function public.materialize_hire_request_contract(uuid) to authenticated;

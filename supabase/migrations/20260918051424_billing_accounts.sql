-- ---------------------------------------------------------------------------
-- Agent-card payments (2026-09-18): an operator saves a card once; its agents
-- may then fund contracts off-session, within a daily cap the operator sets.
--
-- billing_accounts is written only by the platform (the Stripe webhook saves
-- the payment method; the checkout/fund paths read it). Operators read their
-- own row and may change only their agent spend cap.
-- ---------------------------------------------------------------------------
create table if not exists billing_accounts (
  profile_id uuid primary key references profiles(id) on delete cascade,
  stripe_customer_id text unique,
  default_payment_method_id text,
  card_brand text,
  card_last4 text,
  card_exp_month integer,
  card_exp_year integer,
  -- What agents holding this operator's keys may authorize per rolling 24h.
  agent_daily_cap_cents integer not null default 100000 check (agent_daily_cap_cents between 0 and 10000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table billing_accounts enable row level security;

drop policy if exists "billing_accounts_owner_read" on billing_accounts;
create policy "billing_accounts_owner_read" on billing_accounts
  for select to authenticated
  using (profile_id = public.current_profile_id());

drop policy if exists "billing_accounts_owner_update" on billing_accounts;
create policy "billing_accounts_owner_update" on billing_accounts
  for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

revoke insert, delete on billing_accounts from anon, authenticated;

-- An operator may change the cap and nothing else; card fields are the platform's.
create or replace function public.enforce_billing_account_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;
  if new.profile_id is distinct from old.profile_id
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.default_payment_method_id is distinct from old.default_payment_method_id
     or new.card_brand is distinct from old.card_brand
     or new.card_last4 is distinct from old.card_last4
     or new.card_exp_month is distinct from old.card_exp_month
     or new.card_exp_year is distinct from old.card_exp_year
     or new.created_at is distinct from old.created_at then
    raise exception 'billing_accounts: only agent_daily_cap_cents may be changed by the operator'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_billing_account_columns() from public, anon, authenticated;

drop trigger if exists billing_accounts_enforce_columns on billing_accounts;
create trigger billing_accounts_enforce_columns
  before update on billing_accounts
  for each row execute function public.enforce_billing_account_columns();

create or replace trigger billing_accounts_set_updated_at
  before update on billing_accounts
  for each row execute function public.set_updated_at();

-- Record which principal authorized a payment: a human at Checkout, or an agent key.
alter table payments add column if not exists authorized_by text;
alter table payments drop constraint if exists payments_authorized_by_check;
alter table payments add constraint payments_authorized_by_check
  check (authorized_by is null or authorized_by in ('human', 'agent'));

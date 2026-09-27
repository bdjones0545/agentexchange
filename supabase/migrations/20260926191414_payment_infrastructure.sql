-- Proposal only: apply to production after review. No existing financial rows are deleted.
alter table public.billing_accounts add column if not exists agent_per_contract_cap_cents integer not null default 0
  check (agent_per_contract_cap_cents between 0 and 10000000);
-- New accounts must explicitly opt in; existing daily caps remain unchanged.
alter table public.billing_accounts alter column agent_daily_cap_cents set default 0;

create table if not exists public.seller_accounts (
  profile_id uuid primary key references public.profiles(id),
  stripe_account_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.seller_accounts enable row level security;
grant select on public.seller_accounts to authenticated;
revoke all on public.seller_accounts from anon;
revoke insert, update, delete on public.seller_accounts from authenticated;
grant all on public.seller_accounts to service_role;
drop policy if exists seller_account_read on public.seller_accounts;
create policy seller_account_read on public.seller_accounts for select to authenticated
  using (profile_id = public.current_profile_id());

alter table public.agent_api_keys add column if not exists can_spend boolean not null default false;

-- Durable operations are both the retry journal and the agent budget reservations.
-- An ambiguous funding request keeps its budget reserved until reconciled.
create table if not exists public.money_operations (
  key text primary key,
  kind text not null,
  profile_id uuid references public.profiles(id),
  contract_id uuid references public.contracts(id),
  request jsonb not null,
  result jsonb,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text
);
alter table public.money_operations enable row level security;
revoke all on public.money_operations from public, anon, authenticated;
grant all on public.money_operations to service_role;
create index if not exists money_operations_budget on public.money_operations(profile_id, created_at) where kind = 'fund_agent';
create index if not exists money_operations_pending on public.money_operations(created_at) where completed_at is null;

-- Serialize funding reservations per buyer across ALL their contracts and processes.
-- No SECURITY DEFINER: only the ledger's service role may execute this function.
create or replace function public.begin_money_operation(
  p_key text, p_kind text, p_profile uuid, p_contract uuid, p_request jsonb, p_amount integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare op public.money_operations%rowtype; b public.billing_accounts%rowtype; spent bigint; token uuid;
begin
  if p_kind = 'fund_agent' then
    select * into b from public.billing_accounts where profile_id = p_profile for update;
    if not found then raise exception 'no billing account'; end if;
  end if;
  insert into public.money_operations(key, kind, profile_id, contract_id, request, amount_cents)
    values(p_key, p_kind, p_profile, p_contract, p_request, p_amount) on conflict do nothing;
  select * into op from public.money_operations where key = p_key for update;
  if op.kind <> p_kind or op.profile_id is distinct from p_profile or op.contract_id is distinct from p_contract
     or op.request <> p_request or op.amount_cents <> p_amount then
    raise exception 'operation conflict: original request must be reused';
  end if;
  if op.completed_at is not null then return jsonb_build_object('state','done','result',op.result); end if;
  if op.lease_until > now() then return jsonb_build_object('state','busy'); end if;
  if p_kind = 'fund_agent' then
    -- Retry of a reservation does not consume the budget twice. Pending reservations
    -- never age out automatically; completed charges count for the rolling window.
    select coalesce(sum(amount_cents),0) into spent from public.money_operations
      where profile_id = p_profile and kind = 'fund_agent' and key <> p_key
        and (completed_at is null or created_at > now() - interval '24 hours');
    -- Include pre-migration agent charges so rollout cannot reset the cap.
    select spent + coalesce(sum(p.amount_cents),0) into spent from public.payments p
      join public.contracts c on c.id=p.contract_id join public.organizations o on o.id=c.organization_id
      where o.owner_id=p_profile and p.authorized_by='agent' and p.kind='charge'
        and p.status in ('authorized','captured') and p.created_at > now()-interval '24 hours'
        and not exists(select 1 from public.money_operations m where m.contract_id=c.id and m.kind='fund_agent');
    if p_amount > b.agent_per_contract_cap_cents or spent + p_amount > b.agent_daily_cap_cents then
      raise exception 'agent spend cap exceeded; owner approval required';
    end if;
  end if;
  -- Stripe may prune idempotency keys after 24h. Never recreate an unknown charge
  -- or transfer after that window. Reconciliation must resolve it first.
  if p_kind <> 'webhook' and op.attempts > 0 and op.created_at < now()-interval '23 hours' then
    return jsonb_build_object('state','review');
  end if;
  token := gen_random_uuid();
  update public.money_operations set lease_token=token, lease_until=now()+interval '5 minutes', attempts=attempts+1 where key=p_key;
  return jsonb_build_object('state','acquired','token',token);
end $$;

create or replace function public.finish_money_operation(p_key text, p_token uuid, p_result jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.money_operations set result=p_result, completed_at=now(), lease_until=null, lease_token=null, last_error=null
    where key=p_key and lease_token=p_token and completed_at is null;
  if not found then raise exception 'operation lease lost'; end if;
end $$;
create or replace function public.fail_money_operation(p_key text, p_token uuid, p_error text)
returns void language sql security invoker set search_path = '' as $$
  update public.money_operations set lease_until=null, lease_token=null, next_attempt_at=now()+interval '5 minutes', last_error=left(p_error,200)
    where key=p_key and lease_token=p_token and completed_at is null;
$$;
revoke all on function public.begin_money_operation(text,text,uuid,uuid,jsonb,integer),
  public.finish_money_operation(text,uuid,jsonb), public.fail_money_operation(text,uuid,text) from public, anon, authenticated;
grant execute on function public.begin_money_operation(text,text,uuid,uuid,jsonb,integer),
  public.finish_money_operation(text,uuid,jsonb), public.fail_money_operation(text,uuid,text) to service_role;

-- Fail migration if old data contains duplicates; investigate rather than deleting money history.
create unique index if not exists payouts_one_per_contract on public.payouts(contract_id);
alter table public.payouts add column if not exists payment_intent_id text;
alter table public.payouts add column if not exists checked_at timestamptz;
alter table public.payouts add column if not exists transferred_at timestamptz;
alter table public.payouts add column if not exists reversed_cents integer not null default 0 check (reversed_cents >= 0);
alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add constraint payouts_status_check check(status in ('pending','paid','failed','transferred','reversed'));

-- Preserve terminal state against older webhook deliveries.
create or replace function public.set_contract_payment_status(p_contract uuid, p_status text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.contracts set payment_status=p_status where id=p_contract
    and (payment_status=p_status or
      (payment_status='unfunded' and p_status in ('authorized','captured','refunded')) or
      (payment_status='authorized' and p_status in ('unfunded','captured','refunded')) or
      (payment_status in ('captured','paid_out') and p_status='refunded'));
end $$;
revoke all on function public.set_contract_payment_status(uuid,text) from public, anon, authenticated;
grant execute on function public.set_contract_payment_status(uuid,text) to service_role;

-- Rotate polling even when a provider record repeatedly fails validation.
alter table public.payments add column if not exists checked_at timestamptz;

-- Serialize polling/refund reversals per payout across overlapping cron invocations.
alter table public.payouts add column if not exists check_until timestamptz;

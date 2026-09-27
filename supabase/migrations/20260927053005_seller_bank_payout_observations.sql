-- Account-level provider observations, never inferred contract settlement.
create table if not exists public.seller_bank_payouts (
 account_id text not null,
 payout_id text not null,
 profile_id uuid not null references public.profiles(id),
 amount_cents bigint not null check(amount_cents>=0),
 currency text not null,
 status text not null check(status in ('pending','in_transit','paid','failed','canceled')),
 automatic boolean not null,
 arrival_date timestamptz,
 failure_code text,
 observed_at timestamptz not null,
 failure_reviewed_at timestamptz,
 failure_resolution_notes text,
 check(failure_reviewed_at is null or length(trim(coalesce(failure_resolution_notes,'')))>0),
 primary key(account_id,payout_id)
);
alter table public.seller_bank_payouts enable row level security;
revoke all on public.seller_bank_payouts from public,anon,authenticated;
grant select on public.seller_bank_payouts to authenticated;
grant select,insert,update on public.seller_bank_payouts to service_role;
drop policy if exists seller_bank_payout_owner on public.seller_bank_payouts;
create policy seller_bank_payout_owner on public.seller_bank_payouts for select to authenticated using(profile_id=public.current_profile_id());
alter table public.seller_accounts add column if not exists bank_checked_at timestamptz;
create or replace function public.observe_bank_payout(p_account text,p_payout text,p_amount bigint,p_currency text,p_status text,p_automatic boolean,p_arrival timestamptz,p_failure text,p_observed timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare owner_uuid uuid;
begin
 select profile_id into owner_uuid from public.seller_accounts where stripe_account_id=p_account;
 if not found then raise exception 'Unknown connected seller'; end if;
 insert into public.seller_bank_payouts(account_id,payout_id,profile_id,amount_cents,currency,status,automatic,arrival_date,failure_code,observed_at)
 values(p_account,p_payout,owner_uuid,p_amount,upper(p_currency),p_status,p_automatic,p_arrival,p_failure,p_observed)
 on conflict(account_id,payout_id) do update set amount_cents=excluded.amount_cents,currency=excluded.currency,status=excluded.status,
 automatic=excluded.automatic,arrival_date=excluded.arrival_date,failure_code=excluded.failure_code,observed_at=excluded.observed_at
 where public.seller_bank_payouts.observed_at<excluded.observed_at;
end $$;
revoke all on function public.observe_bank_payout(text,text,bigint,text,text,boolean,timestamptz,text,timestamptz) from public,anon,authenticated;
grant execute on function public.observe_bank_payout(text,text,bigint,text,text,boolean,timestamptz,text,timestamptz) to service_role;

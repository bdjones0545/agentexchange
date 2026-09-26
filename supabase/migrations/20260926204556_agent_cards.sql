-- Dedicated cards belong to an owner-issued agent key. Only server writes.
create table public.agent_payment_cards (
  key_id uuid primary key references public.agent_api_keys(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('shared','dedicated')),
  setup_token uuid,
  payment_method_id text,
  card_brand text,
  card_last4 text,
  updated_at timestamptz not null default now()
);
alter table public.agent_payment_cards enable row level security;
revoke all on public.agent_payment_cards from anon, authenticated;
grant select on public.agent_payment_cards to authenticated;
grant all on public.agent_payment_cards to service_role;
create policy agent_payment_cards_owner_read on public.agent_payment_cards for select to authenticated
using (profile_id = public.current_profile_id());
create index agent_payment_cards_profile_idx on public.agent_payment_cards(profile_id);

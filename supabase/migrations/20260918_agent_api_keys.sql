-- ---------------------------------------------------------------------------
-- Agents as first-class users (2026-09-18).
--
-- Any operator can mint API keys for the agents they run. A key authenticates
-- an agent to the marketplace's MCP server (/api/mcp) and lets it act as the
-- operator's own account — publish listings, browse briefs, apply, negotiate,
-- accept hire requests, deliver — under exactly the RLS and triggers a human
-- session gets. Only the SHA-256 of a key is stored; the raw key is shown once.
-- ---------------------------------------------------------------------------
create table if not exists agent_api_keys (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_agent_api_keys_profile_id on agent_api_keys(profile_id);

alter table agent_api_keys alter column profile_id set default public.current_profile_id();
alter table agent_api_keys enable row level security;

-- Operators manage their own keys. The hash is write-once; only name and
-- revoked_at may change, and a revocation cannot be undone.
drop policy if exists "agent_api_keys_owner_read" on agent_api_keys;
create policy "agent_api_keys_owner_read" on agent_api_keys
  for select to authenticated
  using (profile_id = public.current_profile_id());

drop policy if exists "agent_api_keys_owner_insert" on agent_api_keys;
create policy "agent_api_keys_owner_insert" on agent_api_keys
  for insert to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists "agent_api_keys_owner_update" on agent_api_keys;
create policy "agent_api_keys_owner_update" on agent_api_keys
  for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

create or replace function public.enforce_agent_api_key_columns()
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
    if (select count(*) from agent_api_keys where profile_id = new.profile_id and revoked_at is null) >= 10 then
      raise exception 'agent_api_keys: at most 10 active keys per operator'
        using errcode = '42501';
    end if;
    new.last_used_at := null;
    new.revoked_at := null;
    return new;
  end if;
  if new.key_hash is distinct from old.key_hash
     or new.key_prefix is distinct from old.key_prefix
     or new.profile_id is distinct from old.profile_id
     or new.created_at is distinct from old.created_at
     or new.last_used_at is distinct from old.last_used_at then
    raise exception 'agent_api_keys: only name and revoked_at may change'
      using errcode = '42501';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'agent_api_keys: a revoked key stays revoked'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_agent_api_key_columns() from public, anon, authenticated;

drop trigger if exists agent_api_keys_enforce_columns on agent_api_keys;
create trigger agent_api_keys_enforce_columns
  before insert or update on agent_api_keys
  for each row execute function public.enforce_agent_api_key_columns();

-- The MCP server resolves a presented key to its operator's auth user. Only the
-- service role may call this; a key hash never reaches an anon or user session.
create or replace function public.resolve_agent_api_key(hash_in text)
returns table (key_id uuid, profile_id uuid, user_id uuid)
language sql
security definer
set search_path = public
as $$
  select k.id, k.profile_id, p.user_id
  from agent_api_keys k
  join profiles p on p.id = k.profile_id
  where k.key_hash = hash_in and k.revoked_at is null
$$;
revoke all on function public.resolve_agent_api_key(text) from public, anon, authenticated;

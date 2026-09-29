-- Inactive until the reviewed application release and DB configuration agree.
create schema if not exists policy_private;
revoke all on schema policy_private from public, anon, authenticated;
create table if not exists policy_private.requirement (
 singleton boolean primary key default true check (singleton),
 active boolean not null default false,
 version text,
 digest text,
 check (not active or (version is not null and digest ~ '^[a-f0-9]{64}$'))
);
insert into policy_private.requirement(singleton) values(true) on conflict do nothing;
revoke all on policy_private.requirement from public, anon, authenticated, service_role;

create or replace function public.current_policy_accepted(expected_version text, expected_digest text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare r policy_private.requirement;
begin
 select * into r from policy_private.requirement where singleton;
 if not found or auth.uid() is null then return false; end if;
 if not r.active or r.version is distinct from expected_version or r.digest is distinct from expected_digest then return false; end if;
 return exists(select 1 from public.policy_acceptances a where a.user_id=auth.uid() and a.policy_version=r.version and a.policy_digest=r.digest);
end $$;
revoke all on function public.current_policy_accepted(text,text) from public,anon;
grant execute on function public.current_policy_accepted(text,text) to authenticated;

create or replace function policy_private.guard_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r policy_private.requirement;
begin
 -- Trusted provider reconciliation and account-deletion cascades retain their existing permissions.
 if auth.uid() is null then
   if tg_op='DELETE' then return old; end if; return new;
 end if;
 select * into r from policy_private.requirement where singleton;
 if not found then raise exception 'Policy configuration unavailable' using errcode='42501'; end if;
 if not r.active then
   if tg_op='DELETE' then return old; end if; return new;
 end if;
 -- Revocation/pause must remain possible without accepting changed terms.
 if tg_table_name='agent_api_keys' and tg_op='UPDATE' then
   if (to_jsonb(new)-'revoked_at'-'paused_at')=(to_jsonb(old)-'revoked_at'-'paused_at')
      and (new.revoked_at is not null or new.paused_at is not null)
      and (old.revoked_at is null or new.revoked_at=old.revoked_at)
      and (old.paused_at is null or new.paused_at=old.paused_at) then return new; end if;
 end if;
 if not exists(select 1 from public.policy_acceptances a where a.user_id=auth.uid() and a.policy_version=r.version and a.policy_digest=r.digest) then
   raise exception 'Human operator policy acceptance required' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function policy_private.guard_write() from public,anon,authenticated;
-- Profiles remain available for signup; disputes, read access, deletion and provider ledgers are not gated.
do $$ declare t text; begin
 foreach t in array array['organizations','agents','opportunities','applications','negotiations','hire_requests','saved_opportunities','contracts','contract_milestones','contract_deliverables','contract_messages','reviews','agent_api_keys','billing_accounts','agent_payment_cards'] loop
  execute format('drop trigger if exists policy_acceptance_write on public.%I',t);
  execute format('create trigger policy_acceptance_write before insert or update or delete on public.%I for each row execute function policy_private.guard_write()',t);
 end loop;
end $$;

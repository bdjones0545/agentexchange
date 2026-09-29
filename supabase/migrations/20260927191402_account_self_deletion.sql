-- Guard Auth's cascading profile deletion in the same transaction. Never leave
-- marketplace records orphaned or silently cascade financial history.
create or replace function public.guard_account_deletion() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare ref record; found_record boolean;
begin
  for ref in
    select c.conrelid::regclass as relation, a.attname as column_name
    from pg_constraint c join pg_attribute a
      on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and c.confrelid='public.profiles'::regclass
      and cardinality(c.conkey)=1
      and c.conrelid not in ('public.saved_opportunities'::regclass,'public.agent_api_keys'::regclass)
  loop
    execute format('select exists(select 1 from %s where %I=$1)',ref.relation,ref.column_name)
      into found_record using old.id;
    if found_record then
      raise exception 'Account has retained marketplace or billing records; contact support for deletion review.';
    end if;
  end loop;
  return old;
end $$;
revoke all on function public.guard_account_deletion() from public,anon,authenticated;
drop trigger if exists account_deletion_guard on public.profiles;
create trigger account_deletion_guard before delete on public.profiles
for each row execute function public.guard_account_deletion();
-- Server preflight also ensures the guard has been deployed before Auth deletion.
create or replace function public.account_deletion_ready(target uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare ref record; found_record boolean;
begin
  if not exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='account_deletion_guard' and tgenabled='O') then return false; end if;
  for ref in
    select c.conrelid::regclass as relation, a.attname as column_name
    from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and c.confrelid='public.profiles'::regclass and cardinality(c.conkey)=1
      and c.conrelid not in ('public.saved_opportunities'::regclass,'public.agent_api_keys'::regclass)
  loop
    execute format('select exists(select 1 from %s where %I=$1)',ref.relation,ref.column_name) into found_record using target;
    if found_record then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function public.account_deletion_ready(uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_ready(uuid) to service_role;

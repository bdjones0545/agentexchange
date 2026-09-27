-- PostgREST GET uses read-only transactions. Writes retain the revocation lock.
create or replace function public.current_agent_execution() returns public.agent_executions
language plpgsql security definer set search_path='' as $$
declare token text; e public.agent_executions%rowtype; k public.agent_api_keys%rowtype;
begin
 token=nullif(coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb)->>'x-agent-execution','');
 if token is null then return null; end if;
 select * into e from public.agent_executions where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 if not found or e.expires_at<=clock_timestamp() or e.profile_id is distinct from public.current_profile_id() then
  raise exception 'Invalid or expired agent execution' using errcode='42501'; end if;
 if e.key_id is not null then
  -- Owner pause/revoke and an agent's database mutation have an ordered boundary.
  if current_setting('transaction_read_only') = 'on' then
   select * into k from public.agent_api_keys where id=e.key_id;
  else
   select * into k from public.agent_api_keys where id=e.key_id for share;
  end if;
  if not found or k.profile_id<>e.profile_id or k.paused_at is not null or k.revoked_at is not null
   or (not e.read_only and not e.action=any(k.allowed_actions)) then
   raise exception 'Agent execution authority is no longer valid' using errcode='42501'; end if;
 end if;
 return e;
end $$;
revoke all on function public.current_agent_execution() from public,anon,authenticated;

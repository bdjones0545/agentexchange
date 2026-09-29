-- Acceptance and its contract are one transaction for every authenticated path.
create or replace function public.materialize_accepted_source() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if public.current_profile_id() is null then return new; end if;
 if tg_table_name='hire_requests' then perform public.materialize_hire_request_contract(new.id);
 else perform public.materialize_negotiation_contract(new.id); end if;
 return new;
end $$;
revoke all on function public.materialize_accepted_source() from public,anon,authenticated;
drop trigger if exists accepted_hire_contract on public.hire_requests;
create trigger accepted_hire_contract after update on public.hire_requests for each row
 when (new.status='accepted' and old.status is distinct from new.status) execute function public.materialize_accepted_source();
drop trigger if exists accepted_negotiation_contract on public.negotiations;
create trigger accepted_negotiation_contract after update on public.negotiations for each row
 when (new.status='accepted' and old.status is distinct from new.status) execute function public.materialize_accepted_source();

-- Server-issued short-lived execution context. Agents never receive the nonce or JWT.
create table if not exists public.agent_executions (
 id uuid primary key,
 token_hash text not null unique,
 profile_id uuid not null references public.profiles(id),
 key_id uuid references public.agent_api_keys(id),
 action text not null,
 read_only boolean not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table public.agent_executions enable row level security;
revoke all on public.agent_executions from public,anon,authenticated,service_role;
grant select,insert on public.agent_executions to service_role;
alter table public.economic_audit add column if not exists execution_id uuid;

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
  select * into k from public.agent_api_keys where id=e.key_id for share;
  if not found or k.profile_id<>e.profile_id or k.paused_at is not null or k.revoked_at is not null
   or (not e.read_only and not e.action=any(k.allowed_actions)) then
   raise exception 'Agent execution authority is no longer valid' using errcode='42501'; end if;
 end if;
 return e;
end $$;
revoke all on function public.current_agent_execution() from public,anon,authenticated;

create or replace function public.agent_organization_allowed(org uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare e public.agent_executions%rowtype; permitted boolean;
begin
 e=public.current_agent_execution();
 if e.id is null then return true; end if;
 if e.key_id is null then return false; end if;
 select org=any(organization_ids) into permitted from public.agent_api_keys where id=e.key_id;
 return coalesce(permitted,false);
end $$;
revoke all on function public.agent_organization_allowed(uuid) from public,anon;
grant execute on function public.agent_organization_allowed(uuid) to authenticated;
create or replace function public.is_organization_owner(organization_uuid uuid) returns boolean
language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.organizations where id=organization_uuid and owner_id=public.current_profile_id())
 and public.agent_organization_allowed(organization_uuid)
$$;
revoke all on function public.is_organization_owner(uuid) from public,anon;
grant execute on function public.is_organization_owner(uuid) to authenticated;

-- Attach exact execution provenance to each row audit in its own transaction.
create or replace function public.attribute_economic_execution() returns trigger
language plpgsql security definer set search_path='' as $$
declare e public.agent_executions%rowtype;
begin
 e=public.current_agent_execution();
 if e.id is not null then
  if e.read_only then raise exception 'Read-only execution cannot mutate data' using errcode='42501'; end if;
  new.execution_id=e.id;
  new.actor_kind='agent';
  new.authority=new.authority || jsonb_build_object('keyId',e.key_id,'action',e.action,'executionId',e.id);
 end if;
 return new;
end $$;
revoke all on function public.attribute_economic_execution() from public,anon,authenticated;
drop trigger if exists audit_execution_attribution on public.economic_audit;
create trigger audit_execution_attribution before insert on public.economic_audit for each row execute function public.attribute_economic_execution();
do $$ declare t text; begin
 foreach t in array array['agents','contract_messages','deliverable_gate_events'] loop
  execute format('drop trigger if exists economic_evidence on public.%I',t);
  execute format('create trigger economic_evidence after insert or update or delete on public.%I for each row execute function public.record_economic_change()',t);
 end loop;
end $$;

-- Opportunity authorship must not bypass the key's organization scope.
create or replace function public.is_opportunity_org_side(opportunity_uuid uuid) returns boolean
language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.opportunities o where o.id=opportunity_uuid
 and (o.owner_id=public.current_profile_id() or public.is_organization_owner(o.organization_id))
 and public.agent_organization_allowed(o.organization_id))
$$;
revoke all on function public.is_opportunity_org_side(uuid) from public,anon;
grant execute on function public.is_opportunity_org_side(uuid) to authenticated;
drop policy if exists applications_participant_read on public.applications;
create policy applications_participant_read on public.applications for select to authenticated using (
 owner_id=public.current_profile_id() or public.is_agent_owner(agent_id) or public.is_opportunity_org_side(opportunity_id));
drop policy if exists negotiations_participant_read on public.negotiations;
create policy negotiations_participant_read on public.negotiations for select to authenticated using (
 owner_id=public.current_profile_id() or public.is_agent_owner(agent_id) or public.is_opportunity_org_side(opportunity_id));
drop policy if exists hire_requests_participant_read on public.hire_requests;
create policy hire_requests_participant_read on public.hire_requests for select to authenticated using (
 (owner_id=public.current_profile_id() and public.is_opportunity_org_side(opportunity_id)) or public.is_agent_owner(agent_id));

-- Caller tokens bind intent to one committed row, including concurrent retries.
create table if not exists public.marketplace_requests (
 profile_id uuid not null default public.current_profile_id() references public.profiles(id),
 resource_table text not null,
 request_id uuid not null,
 intent jsonb not null,
 resource_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(profile_id,resource_table,request_id)
);
alter table public.marketplace_requests enable row level security;
revoke all on public.marketplace_requests from public,anon,authenticated;
grant select,insert on public.marketplace_requests to authenticated;
drop policy if exists own_marketplace_requests on public.marketplace_requests;
create policy own_marketplace_requests on public.marketplace_requests for select to authenticated using(profile_id=public.current_profile_id());
drop policy if exists insert_marketplace_requests on public.marketplace_requests;
create policy insert_marketplace_requests on public.marketplace_requests for insert to authenticated with check(profile_id=public.current_profile_id());
create or replace function public.replay_marketplace_record(p_table text,p_request uuid,p_intent jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare receipt public.marketplace_requests%rowtype; result jsonb;
begin
 if p_table not in ('agents','opportunities','applications','negotiations','hire_requests','contract_messages','contract_deliverables') then raise exception 'Unsupported creation resource'; end if;
 select * into receipt from public.marketplace_requests where profile_id=public.current_profile_id() and resource_table=p_table and request_id=p_request;
 if not found then return null; end if;
 if receipt.intent is distinct from p_intent then raise exception 'Request ID reused with different intent' using errcode='22023'; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1',p_table) into result using receipt.resource_id;
 if result is null then raise exception 'Original resource is no longer accessible' using errcode='42501'; end if;
 return result;
end $$;
create or replace function public.create_marketplace_record(p_table text,p_request uuid,p_intent jsonb,p_row jsonb,p_revision uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; columns_sql text; values_sql text;
begin
 if public.current_profile_id() is null or p_request is null then raise exception 'Authenticated caller and request ID required'; end if;
 if p_table not in ('agents','opportunities','applications','negotiations','hire_requests','contract_messages','contract_deliverables') then raise exception 'Unsupported creation resource'; end if;
 perform pg_advisory_xact_lock(hashtextextended(public.current_profile_id()::text||':'||p_table||':'||p_request::text,0));
 result=public.replay_marketplace_record(p_table,p_request,p_intent);
 if result is not null then return result; end if;
 if jsonb_typeof(p_row)<>'object' or p_row='{}'::jsonb then raise exception 'Record required'; end if;
 select string_agg(format('%I',k),',' order by k),string_agg(format('r.%I',k),',' order by k) into columns_sql,values_sql from jsonb_object_keys(p_row) k;
 if p_revision is null then
  execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r returning to_jsonb(%I.*)',p_table,columns_sql,values_sql,p_table,p_table) into result using p_row;
 else
  if p_table<>'contract_deliverables' then raise exception 'Only draft deliveries can be revised'; end if;
  execute format('update public.contract_deliverables set (%s)=(select %s from jsonb_populate_record(null::public.contract_deliverables,$1) r) where id=$2 and status=''draft'' returning to_jsonb(contract_deliverables.*)',columns_sql,values_sql) into result using p_row,p_revision;
 end if;
 if result is null then raise exception 'Creation or revision was not authorized' using errcode='42501'; end if;
 insert into public.marketplace_requests(resource_table,request_id,intent,resource_id) values(p_table,p_request,p_intent,(result->>'id')::uuid);
 return result;
end $$;
revoke all on function public.replay_marketplace_record(text,uuid,jsonb),public.create_marketplace_record(text,uuid,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.replay_marketplace_record(text,uuid,jsonb),public.create_marketplace_record(text,uuid,jsonb,jsonb,uuid) to authenticated;

create or replace function public.begin_money_operation(
  p_key text, p_kind text, p_profile uuid, p_contract uuid, p_request jsonb, p_amount integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare op public.money_operations%rowtype; b public.billing_accounts%rowtype; spent bigint; token uuid; c public.contracts%rowtype; k public.agent_api_keys%rowtype; e public.agent_executions%rowtype; required_action text;
begin
  -- A dispute and payment authorization serialize on the same contract row.
  if p_contract is not null then
    select * into c from public.contracts where id=p_contract for update;
    if not found then raise exception 'Contract unavailable'; end if;
  end if;
  if p_request ? 'agentKeyId' then
    required_action=case when p_kind='fund_agent' then 'fund_contract' else 'release_payment' end;
    select * into k from public.agent_api_keys where id=(p_request->>'agentKeyId')::uuid for share;
    if not found or k.profile_id is distinct from p_profile or k.paused_at is not null or k.revoked_at is not null
      or not k.can_spend or not required_action=any(k.allowed_actions) or not c.organization_id=any(k.organization_ids) then
      raise exception 'Current agent payment authority required'; end if;
    if not exists(select 1 from public.organizations where id=c.organization_id and owner_id=p_profile)
      or not exists(select 1 from public.agents where id=c.agent_id and owner_id<>p_profile) then
      raise exception 'Independent buyer and worker required'; end if;
  end if;
  if p_request ? 'executionId' then
    select * into e from public.agent_executions where id=(p_request->>'executionId')::uuid;
    if not found or e.profile_id is distinct from p_profile or e.key_id is distinct from (p_request->>'agentKeyId')::uuid
      or e.action is distinct from required_action or e.read_only then raise exception 'Payment execution provenance mismatch'; end if;
  end if;
  if p_kind = 'fund_agent' then
    select * into b from public.billing_accounts where profile_id = p_profile for update;
    if not found then raise exception 'no billing account'; end if;
  end if;
  insert into public.money_operations(key, kind, profile_id, contract_id, request, amount_cents)
    values(p_key, p_kind, p_profile, p_contract, p_request, p_amount) on conflict do nothing;
  select * into op from public.money_operations where key = p_key for update;
  if op.kind <> p_kind or op.profile_id is distinct from p_profile or op.contract_id is distinct from p_contract
     or (op.request-'executionId') <> (p_request-'executionId') or op.amount_cents <> p_amount then
    raise exception 'operation conflict: original request must be reused';
  end if;
  if op.completed_at is not null then return jsonb_build_object('state','done','result',op.result); end if;
  if op.lease_until > now() then return jsonb_build_object('state','busy'); end if;
  if p_kind in ('capture','transfer') then
    if c.status in ('Paused','Disputed','Cancelled') or exists(select 1 from public.disputes where contract_id=c.id and status is distinct from 'Resolved') then
      raise exception 'Open dispute or held contract blocks payment authorization'; end if;
    if not exists(select 1 from public.contract_deliverables where contract_id=c.id)
      or exists(select 1 from public.contract_deliverables where contract_id=c.id and status<>'approved') then
      raise exception 'Every deliverable must be approved before payment authorization'; end if;
  end if;
  if p_kind = 'fund_agent' then
    -- Retry of a reservation does not consume the budget twice. Pending reservations
    -- never age out automatically; completed charges count for the rolling window.
    select coalesce(sum(amount_cents),0) into spent from public.money_operations
      where profile_id = p_profile and kind = 'fund_agent' and key <> p_key
        and (completed_at is null or created_at > now() - interval '24 hours');
    -- Include pre-migration agent charges so rollout cannot reset the cap.
    select spent + coalesce(sum(p.amount_cents),0) into spent from public.payments p
      join public.contracts budget_contract on budget_contract.id=p.contract_id join public.organizations o on o.id=budget_contract.organization_id
      where o.owner_id=p_profile and p.authorized_by='agent' and p.kind='charge'
        and p.status in ('authorized','captured') and p.created_at > now()-interval '24 hours'
        and not exists(select 1 from public.money_operations m where m.contract_id=budget_contract.id and m.kind='fund_agent');
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
  if p_kind in ('fund_agent','capture','cancel','transfer') then
    insert into public.economic_audit(actor_profile_id,actor_kind,organization_id,resource_table,resource_id,action,authority,execution_id,next_state)
    values(p_profile,case when k.id is null then 'platform' else 'agent' end,c.organization_id,'money_operations',p_key,'payment_authorized',
      jsonb_build_object('keyId',k.id,'boundary','committed payment authorization'),e.id,jsonb_build_object('kind',p_kind));
  end if;
  return jsonb_build_object('state','acquired','token',token);
end $$;

-- An external provider call already authorized cannot be atomically recalled.
-- Record late disputes and revocations for reconciliation, without hiding them.
create table if not exists public.payment_review_cases (
 id uuid primary key default gen_random_uuid(),
 operation_key text not null references public.money_operations(key),
 reason text not null,
 source_id uuid not null,
 status text not null default 'open' check(status in ('open','resolved')),
 resolution_notes text,
 created_at timestamptz not null default now(),
 unique(operation_key,reason,source_id)
);
alter table public.payment_review_cases enable row level security;
revoke all on public.payment_review_cases from public,anon,authenticated;
grant select,insert,update on public.payment_review_cases to service_role;
create or replace function public.coordinate_dispute_payment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.contracts where id=new.contract_id for update;
 if new.status is distinct from 'Resolved' then
  insert into public.payment_review_cases(operation_key,reason,source_id)
   select key,'dispute_after_authorization',new.id from public.money_operations
   where contract_id=new.contract_id and kind in ('capture','transfer') and attempts>0
   on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.coordinate_dispute_payment() from public,anon,authenticated;
drop trigger if exists disputes_coordinate_payment on public.disputes;
create trigger disputes_coordinate_payment before insert or update on public.disputes for each row execute function public.coordinate_dispute_payment();
create or replace function public.coordinate_key_payment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.paused_at is not null or new.revoked_at is not null or not new.can_spend
  or new.allowed_actions is distinct from old.allowed_actions or new.organization_ids is distinct from old.organization_ids then
  insert into public.payment_review_cases(operation_key,reason,source_id)
   select key,'authority_changed_after_authorization',new.id from public.money_operations
   where request->>'agentKeyId'=new.id::text and completed_at is null and attempts>0 on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.coordinate_key_payment() from public,anon,authenticated;
drop trigger if exists key_coordinate_payment on public.agent_api_keys;
create trigger key_coordinate_payment after update on public.agent_api_keys for each row execute function public.coordinate_key_payment();

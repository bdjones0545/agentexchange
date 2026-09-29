-- Existing keys retain worker capabilities, but hiring, review and payment actions
-- require explicit owner grants after this migration. No historical rows removed.
alter table public.agent_api_keys add column if not exists paused_at timestamptz;
alter table public.agent_api_keys add column if not exists organization_ids uuid[] not null default '{}';
alter table public.agent_api_keys add column if not exists allowed_actions text[] not null default array[
 'publish_agent','apply_to_opportunity','negotiate_opportunity','respond_to_negotiation','respond_to_hire_request','post_message','submit_deliverable','update_progress'];

-- A single operator cannot be both the worker and the approving organization.
create or replace function public.is_contract_org_side(contract_uuid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.contracts c where c.id=contract_uuid
  and public.is_organization_owner(c.organization_id) and not public.is_agent_owner(c.agent_id))
$$;
revoke all on function public.is_contract_org_side(uuid) from public,anon;
grant execute on function public.is_contract_org_side(uuid) to authenticated;

create or replace function public.enforce_deliverable_update_authority()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if public.current_profile_id() is null then return new; end if;
 if new.contract_id is distinct from old.contract_id or new.id is distinct from old.id or new.created_at is distinct from old.created_at then
  raise exception 'Deliverable identity is immutable' using errcode='42501'; end if;
 if old.status='approved' and to_jsonb(new)-'updated_at' is distinct from to_jsonb(old)-'updated_at' then
  raise exception 'Approved work is immutable' using errcode='42501'; end if;
 if old.status <> 'draft' and (new.title is distinct from old.title or new.notes is distinct from old.notes or new.gate is distinct from old.gate) then
  raise exception 'Only draft work can be edited' using errcode='42501'; end if;
 if new.decisions is distinct from old.decisions then
  if old.status<>'submitted' or new.status not in ('approved','draft') or new.status=old.status then raise exception 'Decisions require a submitted work transition' using errcode='42501'; end if;
  if jsonb_typeof(new.decisions)<>'array' or jsonb_array_length(new.decisions)<>jsonb_array_length(old.decisions)+1
   or exists(select 1 from jsonb_array_elements(old.decisions) with ordinality x(value,n) where new.decisions->((n-1)::int) is distinct from value) then
   raise exception 'Decision history is append-only' using errcode='42501'; end if;
 end if;
 if new.status is distinct from old.status and not ((old.status='draft' and new.status='submitted') or (old.status='submitted' and new.status in ('approved','draft'))) then
  raise exception 'Invalid deliverable transition' using errcode='42501'; end if;
 if (old.status='submitted' and new.status in ('approved','draft')) or new.approved_at is distinct from old.approved_at or new.decisions is distinct from old.decisions then
  if not public.is_contract_org_side(old.contract_id) then raise exception 'Only an independent organization reviewer can decide work' using errcode='42501'; end if;
 end if;
 return new;
end $$;
revoke all on function public.enforce_deliverable_update_authority() from public,anon,authenticated;

-- A review is evidence of approved work, not a self-asserted listing attribute.
drop policy if exists reviews_organization_insert on public.reviews;
create policy reviews_organization_insert on public.reviews for insert to authenticated with check (
 reviewer_id=public.current_profile_id() and public.is_contract_org_side(contract_id)
 and exists(select 1 from public.contracts c where c.id=reviews.contract_id and c.agent_id=reviews.agent_id)
 and exists(select 1 from public.contract_deliverables d where d.contract_id=reviews.contract_id)
 and not exists(select 1 from public.contract_deliverables d where d.contract_id=reviews.contract_id and d.status<>'approved')
);

-- Contract creation and application acceptance commit together, including browser writes.
create or replace function public.accept_contract_application() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype;
begin
 if new.source_type='application' then
  select * into a from public.applications where id=new.source_id for update;
  if not found or a.agent_id is distinct from new.agent_id or a.status not in ('pending','accepted') then
   raise exception 'Application is not eligible for a contract' using errcode='42501'; end if;
  update public.applications set status='accepted' where id=a.id;
 end if;
 return new;
end $$;
revoke all on function public.accept_contract_application() from public,anon,authenticated;
drop trigger if exists contracts_accept_application on public.contracts;
create trigger contracts_accept_application after insert on public.contracts for each row execute function public.accept_contract_application();

-- Lock the contract before changing delivery evidence, so concurrent decisions
-- serialize and the derived summary observes the previous decision's commit.
create or replace function public.lock_delivery_contract() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.contracts%rowtype;
begin
 select * into c from public.contracts where id=new.contract_id for update;
 if public.current_profile_id() is not null then
  if c.status in ('Paused','Disputed','Cancelled') or exists(select 1 from public.disputes where contract_id=c.id and status<>'Resolved') then
   raise exception 'Resolve the contract hold before changing delivery' using errcode='42501'; end if;
  if c.amount_cents>0 and c.payment_status not in ('authorized','captured','paid_out') then
   raise exception 'Priced work requires funding authorization' using errcode='42501'; end if;
  if tg_op='INSERT' and (new.status='approved' or new.approved_at is not null or jsonb_array_length(new.decisions)>0) then
   raise exception 'New work must be submitted before independent review' using errcode='42501'; end if;
 end if;
 return new;
end $$;
revoke all on function public.lock_delivery_contract() from public,anon,authenticated;
drop trigger if exists a_lock_delivery_contract on public.contract_deliverables;
create trigger a_lock_delivery_contract before insert or update on public.contract_deliverables for each row execute function public.lock_delivery_contract();
create or replace function public.summarize_contract_delivery() returns trigger
language plpgsql security definer set search_path='' as $$
declare total integer; approved integer; submitted integer; derived_progress integer;
begin
 select count(*),count(*) filter(where status='approved'),count(*) filter(where status='submitted'),
 coalesce(round(avg(case when status='approved' then 100 when status='submitted' then 50 else 0 end)),0)
 into total,approved,submitted,derived_progress from public.contract_deliverables where contract_id=new.contract_id;
 update public.contracts set status=case when total>0 and total=approved then 'Completed' when submitted>0 then 'In Review' else 'Active' end,
 progress=derived_progress where id=new.contract_id and status not in ('Paused','Disputed','Cancelled');
 return new;
end $$;
revoke all on function public.summarize_contract_delivery() from public,anon,authenticated;
drop trigger if exists delivery_summary on public.contract_deliverables;
create trigger delivery_summary after insert or update on public.contract_deliverables for each row execute function public.summarize_contract_delivery();

-- Evidence has no cascading resource foreign keys: deleting a source cannot erase it.
create table if not exists public.economic_audit (
 id uuid primary key default gen_random_uuid(),
 occurred_at timestamptz not null default clock_timestamp(),
 actor_profile_id uuid,
 actor_kind text not null,
 organization_id uuid,
 resource_table text not null,
 resource_id text not null,
 action text not null,
 authority jsonb not null default '{}'::jsonb,
 previous_state jsonb,
 next_state jsonb,
 provider_ref text
);
alter table public.economic_audit enable row level security;
revoke all on public.economic_audit from public,anon,authenticated,service_role;
grant select,insert on public.economic_audit to service_role;
create index if not exists economic_audit_resource on public.economic_audit(resource_table,resource_id,occurred_at);
create or replace function public.prevent_audit_rewrite() returns trigger
language plpgsql set search_path='' as $$ begin raise exception 'Economic audit is append-only' using errcode='42501'; end $$;
revoke all on function public.prevent_audit_rewrite() from public,anon,authenticated;
drop trigger if exists economic_audit_immutable on public.economic_audit;
create trigger economic_audit_immutable before update or delete on public.economic_audit for each row execute function public.prevent_audit_rewrite();
create or replace function public.record_economic_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare before_row jsonb; after_row jsonb; r jsonb; org uuid; cid uuid;
begin
 if tg_op<>'INSERT' then before_row=to_jsonb(old); end if;
 if tg_op<>'DELETE' then after_row=to_jsonb(new); end if;
 r=coalesce(after_row,before_row);
 -- Store contractual evidence but never card details, key hashes, tokens or raw provider payloads.
 before_row=before_row-'metadata'-'key_hash'-'key_prefix'-'setup_token'-'payment_method_id';
 after_row=after_row-'metadata'-'key_hash'-'key_prefix'-'setup_token'-'payment_method_id';
 if tg_table_name='organizations' then org=(r->>'id')::uuid;
 elsif r ? 'organization_id' then org=(r->>'organization_id')::uuid;
 elsif r ? 'contract_id' then
  cid=(r->>'contract_id')::uuid;
  select organization_id into org from public.contracts where id=cid;
 elsif r ? 'opportunity_id' then
  select organization_id into org from public.opportunities where id=(r->>'opportunity_id')::uuid;
 end if;
 insert into public.economic_audit(actor_profile_id,actor_kind,organization_id,resource_table,resource_id,action,authority,previous_state,next_state,provider_ref)
 values(public.current_profile_id(),case when public.current_profile_id() is null then 'platform' else 'operator_session' end,org,tg_table_name,coalesce(r->>'id',r->>'key',r->>'profile_id'),tg_op,
 jsonb_build_object('boundary','RLS and database triggers'),before_row,after_row,coalesce(r->>'provider_ref',r->>'payment_intent_id'));
 return coalesce(new,old);
end $$;
revoke all on function public.record_economic_change() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['opportunities','applications','negotiations','hire_requests','contracts','contract_deliverables','disputes','reviews','payments','payouts','agent_api_keys','billing_accounts'] loop
  execute format('drop trigger if exists economic_evidence on public.%I',t);
  execute format('create trigger economic_evidence after insert or update or delete on public.%I for each row execute function public.record_economic_change()',t);
 end loop;
end $$;

-- Completed means approved work, never merely a caller-supplied progress label.
create or replace function public.guard_contract_completion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if public.current_profile_id() is null then return new; end if;
 if (new.status='Completed' or new.progress=100) and
 (not exists(select 1 from public.contract_deliverables where contract_id=new.id)
  or exists(select 1 from public.contract_deliverables where contract_id=new.id and status<>'approved')) then
  raise exception 'Completion requires all deliverables approved' using errcode='42501'; end if;
 if old.status in ('Paused','Disputed','Cancelled') and new.status is distinct from old.status and not public.is_contract_org_side(old.id) then
  raise exception 'Only the organization may resume this contract' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.guard_contract_completion() from public,anon,authenticated;
drop trigger if exists contract_completion_guard on public.contracts;
create trigger contract_completion_guard before update on public.contracts for each row execute function public.guard_contract_completion();

-- A participant cannot impersonate the opposite party in the contract thread.
create or replace function public.attribute_contract_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.contracts%rowtype;
begin
 if public.current_profile_id() is null then return new; end if;
 select * into c from public.contracts where id=new.contract_id;
 if public.is_agent_owner(c.agent_id) then new.sender_type='Agent';new.author=c.agent_name;
 elsif public.is_organization_owner(c.organization_id) then new.sender_type='Organization';new.author=c.organization_name;
 else raise exception 'Contract participant required' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.attribute_contract_message() from public,anon,authenticated;
drop trigger if exists contract_message_attribution on public.contract_messages;
create trigger contract_message_attribution before insert on public.contract_messages for each row execute function public.attribute_contract_message();

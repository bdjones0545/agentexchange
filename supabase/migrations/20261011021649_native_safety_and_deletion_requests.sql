alter table public.agents add column if not exists moderation_status text not null default 'pending' check(moderation_status in ('pending','approved','rejected'));
-- Private, authenticated request queues. No client can resolve a request or read another user's report.
create table if not exists public.account_deletion_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 status text not null default 'requested' check(status in ('requested','processing','completed')),
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 response text not null default 'Your deletion request has been received. We will complete it within 30 days unless specific records must be retained by law. Updates appear here.'
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public,anon,authenticated;
grant select on public.account_deletion_requests to authenticated;
grant select,insert,update,delete on public.account_deletion_requests to service_role;
create policy deletion_request_owner_read on public.account_deletion_requests for select to authenticated using(user_id=(select auth.uid()));

create table if not exists public.content_reports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 content_kind text not null check(content_kind in ('agent','contract','message','deliverable')),
 content_id uuid not null,
 reason text not null check(reason in ('abuse','sexual','violence','fraud','other')),
 details text not null default '' check(char_length(details)<=2000),
 status text not null default 'received' check(status in ('received','reviewing','resolved')),
 response text not null default 'Report received. We review abuse reports within 24 hours and post updates here.',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.content_reports enable row level security;
revoke all on public.content_reports from public,anon,authenticated;
grant select on public.content_reports to authenticated;
grant select,insert,update,delete on public.content_reports to service_role;
create policy report_owner_read on public.content_reports for select to authenticated using(user_id=(select auth.uid()));
create index content_reports_queue on public.content_reports(status,created_at);
create index content_reports_owner on public.content_reports(user_id,created_at);

create table if not exists public.blocked_operators (
 user_id uuid not null references auth.users(id) on delete cascade,
 target_user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,target_user_id),
 check(user_id<>target_user_id)
);
alter table public.blocked_operators enable row level security;
revoke all on public.blocked_operators from public,anon,authenticated;
grant select,delete on public.blocked_operators to authenticated;
grant all on public.blocked_operators to service_role;
create policy block_owner_read on public.blocked_operators for select to authenticated using(user_id=(select auth.uid()));
create policy block_owner_remove on public.blocked_operators for delete to authenticated using(user_id=(select auth.uid()));
create index blocked_operators_target on public.blocked_operators(target_user_id);

create or replace function public.report_content(kind text,target uuid,report_reason text,report_details text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); cid uuid; report_id uuid;
begin
 if actor is null then raise exception 'Sign in to report content' using errcode='42501'; end if;
 if report_reason not in ('abuse','sexual','violence','fraud','other') or char_length(coalesce(report_details,''))>2000 then raise exception 'Invalid report'; end if;
 if kind='agent' then
  if not exists(select 1 from public.agents where id=target and (moderation_status='approved' or owner_id=public.current_profile_id())) then raise exception 'Content unavailable' using errcode='42501'; end if;
 elsif kind in ('contract','message','deliverable') then
  if kind='contract' then cid:=target;
  elsif kind='message' then select contract_id into cid from public.contract_messages where id=target;
  else select contract_id into cid from public.contract_deliverables where id=target; end if;
  if cid is null or not coalesce(public.can_access_contract(cid),false) then raise exception 'Content unavailable' using errcode='42501'; end if;
 else raise exception 'Invalid content type'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,719));
 -- Bound persisted report volume per signed-in user without logging IP addresses.
 if (select count(*) from public.content_reports where user_id=actor and created_at>now()-interval '1 hour')>=20 then raise exception 'Please wait before reporting again' using errcode='P0001'; end if;
 insert into public.content_reports(user_id,content_kind,content_id,reason,details)
 values(actor,kind,target,report_reason,coalesce(report_details,'')) returning id into report_id;
 return report_id;
end $$;
revoke all on function public.report_content(text,uuid,text,text) from public,anon;
grant execute on function public.report_content(text,uuid,text,text) to authenticated;

create or replace function public.block_agent_operator(target_agent uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target_user uuid;
begin
 if actor is null then raise exception 'Sign in to block an operator' using errcode='42501'; end if;
 select p.user_id into target_user from public.agents a join public.profiles p on p.id=a.owner_id where a.id=target_agent;
 if target_user is null or target_user=actor then raise exception 'This operator cannot be blocked' using errcode='42501'; end if;
 insert into public.blocked_operators(user_id,target_user_id) values(actor,target_user) on conflict do nothing;
end $$;
revoke all on function public.block_agent_operator(uuid) from public,anon;
grant execute on function public.block_agent_operator(uuid) to authenticated;

create or replace function public.operator_blocked(profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.blocked_operators b join public.profiles p on p.user_id=b.target_user_id where b.user_id=auth.uid() and p.id=profile)
$$;
revoke all on function public.operator_blocked(uuid) from public,anon;
grant execute on function public.operator_blocked(uuid) to authenticated;
create policy agents_respect_blocks on public.agents as restrictive for select to authenticated using(not public.operator_blocked(owner_id));

-- New/edited public profiles are held for a human review before public display.
-- Existing profiles also require an explicit review; no content is automatically certified.

create or replace function public.guard_agent_moderation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return new; end if;
 if tg_op='INSERT' then new.moderation_status:='pending';
 elsif new.moderation_status is distinct from old.moderation_status then raise exception 'Moderation status is managed by the review team' using errcode='42501';
 elsif (new.name,new.specialty,new.description,new.skills,new.tool_access,new.availability,new.verification_status,new.starting_rate,new.revenue,new.success_rate) is distinct from (old.name,old.specialty,old.description,old.skills,old.tool_access,old.availability,old.verification_status,old.starting_rate,old.revenue,old.success_rate) then new.moderation_status:='pending'; end if;
 return new;
end $$;
revoke all on function public.guard_agent_moderation() from public,anon,authenticated;
create trigger agent_moderation_guard before insert or update on public.agents for each row execute function public.guard_agent_moderation();
create policy agents_public_moderation on public.agents as restrictive for select to anon using(moderation_status='approved');
create policy agents_member_moderation on public.agents as restrictive for select to authenticated using(moderation_status='approved' or owner_id=public.current_profile_id());

-- A block stops new contact in both directions, including direct REST/MCP writes.
create or replace function public.guard_blocked_contact() returns trigger
language plpgsql security definer set search_path='' as $$
declare buyer uuid; seller uuid; org uuid; agent uuid;
begin
 if auth.uid() is null then return new; end if;
 if tg_table_name='contracts' then org:=new.organization_id; agent:=new.agent_id;
 elsif tg_table_name in ('applications','negotiations') then
  select p.user_id into buyer from public.opportunities o join public.profiles p on p.id=o.owner_id where o.id=new.opportunity_id;
  agent:=new.agent_id;
 elsif tg_table_name='hire_requests' then
  select user_id into buyer from public.profiles where id=new.owner_id;
  agent:=new.agent_id;
 else select organization_id,agent_id into org,agent from public.contracts where id=new.contract_id; end if;
 if org is not null then select p.user_id into buyer from public.organizations o join public.profiles p on p.id=o.owner_id where o.id=org; end if;
 select p.user_id into seller from public.agents a join public.profiles p on p.id=a.owner_id where a.id=agent;
 if exists(select 1 from public.blocked_operators where (user_id=buyer and target_user_id=seller) or (user_id=seller and target_user_id=buyer)) then
  raise exception 'Contact is blocked between these operators' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function public.guard_blocked_contact() from public,anon,authenticated;
create trigger block_new_contract before insert on public.contracts for each row execute function public.guard_blocked_contact();
create trigger block_new_message before insert on public.contract_messages for each row execute function public.guard_blocked_contact();
create trigger block_new_deliverable before insert on public.contract_deliverables for each row execute function public.guard_blocked_contact();

create trigger block_new_application before insert or update on public.applications for each row execute function public.guard_blocked_contact();
create trigger block_new_negotiation before insert or update on public.negotiations for each row execute function public.guard_blocked_contact();
create trigger block_new_hire_request before insert or update on public.hire_requests for each row execute function public.guard_blocked_contact();

create or replace function public.block_contract_operator(target_contract uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); buyer uuid; seller uuid; target_user uuid;
begin
 if actor is null or not coalesce(public.can_access_contract(target_contract),false) then raise exception 'Contract unavailable' using errcode='42501'; end if;
 select bp.user_id,sp.user_id into buyer,seller from public.contracts c
 left join public.organizations o on o.id=c.organization_id left join public.profiles bp on bp.id=o.owner_id
 left join public.agents a on a.id=c.agent_id left join public.profiles sp on sp.id=a.owner_id where c.id=target_contract;
 if actor=buyer then target_user:=seller; elsif actor=seller then target_user:=buyer; end if;
 if target_user is null or target_user=actor then raise exception 'Operator unavailable' using errcode='42501'; end if;
 insert into public.blocked_operators(user_id,target_user_id) values(actor,target_user) on conflict do nothing;
end $$;
revoke all on function public.block_contract_operator(uuid) from public,anon;
grant execute on function public.block_contract_operator(uuid) to authenticated;

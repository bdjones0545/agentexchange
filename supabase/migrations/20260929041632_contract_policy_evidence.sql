-- Prospective evidence only. No backfill or implied acceptance for older contracts.
alter table public.contracts add column if not exists policy_evidence jsonb;
create or replace function policy_private.record_contract_policy()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
 r policy_private.requirement;
 buyer uuid;
 seller uuid;
 buyer_acceptance public.policy_acceptances;
 seller_acceptance public.policy_acceptances;
begin
 if tg_op='UPDATE' then
   if new.policy_evidence is distinct from old.policy_evidence then
     raise exception 'Contract policy evidence is immutable' using errcode='42501';
   end if;
   if old.policy_evidence is not null and
      (new.organization_id is distinct from old.organization_id or new.agent_id is distinct from old.agent_id) then
     raise exception 'Accepted contract parties cannot be replaced' using errcode='42501';
   end if;
   return new;
 end if;
 -- Never trust evidence provided by a browser, agent, or service caller.
 new.policy_evidence := null;
 select * into r from policy_private.requirement where singleton for share;
 if not found then raise exception 'Policy configuration unavailable' using errcode='42501'; end if;
 if not r.active then return new; end if;
 select p.user_id into buyer from public.organizations o join public.profiles p on p.id=o.owner_id where o.id=new.organization_id;
 select p.user_id into seller from public.agents a join public.profiles p on p.id=a.owner_id where a.id=new.agent_id;
 if buyer is null or seller is null then raise exception 'Both contract operators are required' using errcode='42501'; end if;
 select * into buyer_acceptance from public.policy_acceptances where user_id=buyer and policy_version=r.version and policy_digest=r.digest;
 if not found then raise exception 'Buyer operator must accept current policies' using errcode='42501'; end if;
 select * into seller_acceptance from public.policy_acceptances where user_id=seller and policy_version=r.version and policy_digest=r.digest;
 if not found then raise exception 'Seller operator must accept current policies' using errcode='42501'; end if;
 if buyer_acceptance.policy_snapshot is distinct from seller_acceptance.policy_snapshot then
   raise exception 'Policy evidence mismatch' using errcode='42501';
 end if;
 new.policy_evidence := jsonb_build_object(
   'version',r.version,'digest',r.digest,'documents',buyer_acceptance.policy_snapshot,
   'buyer_user_id',buyer,'buyer_accepted_at',buyer_acceptance.accepted_at,
   'seller_user_id',seller,'seller_accepted_at',seller_acceptance.accepted_at,
   'recorded_at',statement_timestamp(),
   'scope','Operator policy acceptance at contract creation; not a signature on negotiated exceptions');
 return new;
end $$;
revoke all on function policy_private.record_contract_policy() from public,anon,authenticated;
drop trigger if exists contract_policy_evidence on public.contracts;
create trigger contract_policy_evidence before insert or update on public.contracts
for each row execute function policy_private.record_contract_policy();

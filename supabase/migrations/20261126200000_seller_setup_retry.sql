-- Let a seller retry payout setup after a failed attempt (2026-11-26).
--
-- begin_money_operation() refuses any retry more than 23 hours after an operation's
-- first attempt and marks it for review, because Stripe's v1 API can forget an
-- idempotency key after 24 hours and a retry could then charge or transfer twice.
-- That rule also covered seller account setup ('seller' operations), which moves no
-- money and uses Stripe's v2 accounts API. So a seller whose first setup attempt
-- failed (Stripe refused their country, or a passing error) got "Stripe couldn't
-- start payout setup" on every later try, forever. Three sellers were in that state
-- on 2026-11-26. Seller setup is now exempt; charges, captures, cancels and
-- transfers keep the rule unchanged.
--
-- The function body is otherwise identical to 20260927182521. CREATE OR REPLACE keeps
-- its owner and grants (service_role only). Safe to run more than once.

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
  -- Seller account setup is exempt: it moves no money, and Stripe's v2 accounts API
  -- keeps a key for 30 days and re-runs a request that failed, so a retry returns the
  -- account an earlier attempt made. After 30 days the worst case is a second, unused
  -- account; refusing the retry would lock the seller out of payouts for good.
  if p_kind not in ('webhook','seller') and op.attempts > 0 and op.created_at < now()-interval '23 hours' then
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

-- Explicit Data API grants for every public table the app reaches through
-- supabase-js. Additive and safe to run more than once (GRANT is idempotent).
--
-- Production's existing tables keep the blanket grants Supabase's old default
-- privileges gave them, so this changes nothing there today. It makes those
-- grants explicit before 2026-10-30, after which a re-created or newly created
-- table in public gets no grant at all, and it makes a project built from
-- schema.sql plus these migrations work on a project created after 2026-05-30.
-- See github.com/orgs/supabase/discussions/45329.
--
-- Each grant matches an RLS policy and a call the app makes. GRANT only adds,
-- so on a project that already has the old blanket grants this changes nothing.
-- It never widens the ledger: payments, payouts and stripe_events get no write
-- grant for anon or authenticated, billing_accounts gets no insert or delete,
-- and seller_accounts, money_operations and agent_payment_cards keep the
-- grants they already declare.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- Public marketplace reads (anon: server/publicData.ts and the signed-out app).
grant select on table public.organizations, public.agents, public.opportunities,
  public.reviews, public.activity_events to anon;

-- loadSupabaseState() reads these for a signed-out visitor too and expects an
-- empty result (no policy targets anon), not an error. SELECT is the only grant.
grant select on table public.applications, public.negotiations, public.hire_requests,
  public.contracts, public.saved_opportunities, public.disputes to anon;

-- Signed-in users (browser, /api routes with the caller's JWT, MCP agent sessions).
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.organizations to authenticated;
grant select, insert, update on table public.agents to authenticated;
grant select, insert, update on table public.opportunities to authenticated;
grant select, insert, update on table public.applications to authenticated;
grant select, insert, update on table public.negotiations to authenticated;
grant select, insert, update on table public.hire_requests to authenticated;
grant select, insert, delete on table public.saved_opportunities to authenticated;
grant select, insert, update on table public.contracts to authenticated;
grant select, insert, update on table public.contract_milestones to authenticated;
grant select, insert, update on table public.contract_deliverables to authenticated;
grant select, insert on table public.deliverable_gate_events to authenticated;
grant select, insert on table public.contract_messages to authenticated;
grant select, insert on table public.reviews to authenticated;
grant select, insert, update on table public.disputes to authenticated;
grant select, insert on table public.activity_events to authenticated;
grant select, insert, update on table public.agent_api_keys to authenticated;
grant select, update on table public.billing_accounts to authenticated;
grant select on table public.payments, public.payouts to authenticated;

-- Service role (server/ledger.ts, server/reconcile.ts, server/agentKeys.ts,
-- server/revenue.ts and the SECURITY INVOKER money functions). It bypasses RLS,
-- so keep it to what the server code does.
grant select on table public.organizations, public.agents, public.contract_deliverables,
  public.disputes to service_role;
grant select, update on table public.contracts to service_role;
grant select, update on table public.agent_api_keys to service_role;
grant select, insert, update on table public.billing_accounts to service_role;
grant select, insert, update on table public.payments to service_role;
grant select, insert, update on table public.payouts to service_role;
grant select, insert, update on table public.stripe_events to service_role;


-- API-key resolution is service-only; PUBLIC/anon/authenticated remain revoked.
-- Explicit EXECUTE is needed when fresh projects have no role default grants.
grant execute on function public.resolve_agent_api_key(text) to service_role;

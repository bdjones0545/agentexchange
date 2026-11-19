-- Agent key payment scope, recorded for fresh projects.
--
-- Production already has these columns: they arrived on 2026-09-27 with the
-- bounded_marketplace_authority migration from the unmerged
-- harden/bounded-marketplace branch, and production's begin_money_operation()
-- refuses an agent's hold unless the key lists the action in allowed_actions and
-- the contract's organization in organization_ids. The app now reads and grants
-- them (api/agent-keys PATCH, server/agentAuthority.ts), so every environment
-- needs them. Definitions match production exactly; on production this file is a
-- no-op.
alter table public.agent_api_keys add column if not exists organization_ids uuid[] not null default '{}';
alter table public.agent_api_keys add column if not exists allowed_actions text[] not null default array[
  'publish_agent','apply_to_opportunity','negotiate_opportunity','respond_to_negotiation',
  'respond_to_hire_request','post_message','submit_deliverable','update_progress'
];
alter table public.agent_api_keys add column if not exists paused_at timestamptz;

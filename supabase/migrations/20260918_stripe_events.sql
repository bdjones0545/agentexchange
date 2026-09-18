-- ---------------------------------------------------------------------------
-- Payments phase 1 (2026-09-18): Stripe webhook idempotency.
--
-- Every Stripe event the webhook handles is recorded here before it acts, so a
-- redelivered event (Stripe retries on any non-2xx, and can deliver twice) is a
-- no-op the second time. Service-role only: no policies, grants revoked.
-- ---------------------------------------------------------------------------
create table if not exists stripe_events (
  id text primary key,
  type text not null,
  contract_id uuid references contracts(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text
);

alter table stripe_events enable row level security;
revoke all on stripe_events from anon, authenticated;

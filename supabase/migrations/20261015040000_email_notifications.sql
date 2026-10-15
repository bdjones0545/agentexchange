-- ---------------------------------------------------------------------------
-- Deliverable emails (2026-10-15): the owner email's idempotency ledger.
--
-- server/notifications.ts claims a row here before it emails the organization's
-- owner about a submitted deliverable, keyed by the deliverable and how many
-- decisions it already carries, so a retried request does not send twice while
-- a revision resubmitted after a rejection does. Service-role only: no
-- policies, grants revoked.
--
-- Additive and safe to run more than once. The code runs without it (it falls
-- back to Resend's 24-hour Idempotency-Key and logs that once), so it can be
-- applied before or after the deploy.
-- ---------------------------------------------------------------------------
create table if not exists email_notifications (
  key text primary key,
  kind text not null,
  deliverable_id uuid references contract_deliverables(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_id text
);

alter table email_notifications enable row level security;
revoke all on email_notifications from anon, authenticated;

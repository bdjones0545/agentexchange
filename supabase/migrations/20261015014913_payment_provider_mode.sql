-- Tag money rows with the Stripe mode they were written in.
--
-- Reconciliation re-checks captured payments and transferred payouts on every
-- run. After the switch to live keys, the test-mode PaymentIntents and transfers
-- recorded during the pilot do not exist in the live account, so every run would
-- fail on them. The application now writes provider_mode on each new payment and
-- payout (from the secret key prefix) and reconciles only rows in its own mode.
--
-- Additive: two nullable columns, a backfill of the pilot rows as 'test', and
-- indexes. The previous application version ignores the columns. Apply this
-- before deploying the code that writes them.

alter table public.payments
  add column if not exists provider_mode text check (provider_mode in ('test', 'live'));
alter table public.payouts
  add column if not exists provider_mode text check (provider_mode in ('test', 'live'));

-- Everything recorded so far ran against the Stripe test account.
update public.payments set provider_mode = 'test' where provider_mode is null;
update public.payouts set provider_mode = 'test' where provider_mode is null;

create index if not exists idx_payments_mode_status on public.payments(provider_mode, kind, status);
create index if not exists idx_payouts_mode_status on public.payouts(provider_mode, status);

notify pgrst, 'reload schema';

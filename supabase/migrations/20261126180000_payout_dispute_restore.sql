-- Pay the seller again when the platform wins a card dispute (2026-11-26).
--
-- When a buyer disputes a charge with their bank, reconciliation takes back the
-- seller's share, because Stripe takes the money from the platform. It never sent
-- that share back when the platform won. Now it does, once, with a second Stripe
-- transfer. These columns record it, so it happens only once and a later refund
-- can be taken back from that transfer first.
-- Additive, nullable or defaulted, and safe to run more than once.

alter table public.payouts add column if not exists restore_ref text unique;
alter table public.payouts add column if not exists restored_cents integer not null default 0 check (restored_cents >= 0);

notify pgrst, 'reload schema';

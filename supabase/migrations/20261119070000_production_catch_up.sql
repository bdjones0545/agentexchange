-- Bring production in line with two things schema.sql has had for weeks but no
-- migration ever shipped (found by the 2026-11-19 catalog comparison):
--
--   * reviews.contract_title. The app's createReview() always sends it
--     (src/lib/repositories/reviewsRepository.ts), so on production every
--     review insert is rejected with "Could not find the 'contract_title'
--     column of 'reviews'". Production has 6 completed contracts and 0 reviews.
--   * idx_disputes_owner_id. schema.sql indexes disputes.owner_id; production
--     added the column (20261015002429) without the index.
--
-- Additive only and safe to run more than once.

alter table public.reviews add column if not exists contract_title text;

create index if not exists idx_disputes_owner_id on public.disputes(owner_id);

-- PostgREST caches the schema; make the new column visible immediately.
notify pgrst, 'reload schema';

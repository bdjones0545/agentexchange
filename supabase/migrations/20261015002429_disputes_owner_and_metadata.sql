-- Bring the production disputes table in line with supabase/schema.sql.
--
-- Production was created before disputes gained owner_id and metadata, and no
-- migration added them. The effects (found in the 2026-10-14 end-to-end run):
--   * the app's insert sends metadata, so opening a dispute always failed with
--     "Could not find the 'metadata' column of 'disputes'";
--   * enforce_dispute_update_authority reads NEW.owner_id / OLD.owner_id, so any
--     update by a signed-in user (including resolving) would raise;
--   * "only the party that opened a dispute may resolve it" had no owner to check.
--
-- owner_id defaults to the caller's profile so the complainant is recorded by the
-- database, not trusted from the client. The table has no rows today, so no
-- backfill is needed. Additive only: nothing is dropped or rewritten.

alter table public.disputes
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.disputes
  alter column owner_id set default public.current_profile_id();

-- A participant may open a dispute only in their own name.
drop policy if exists "disputes_participant_insert" on public.disputes;
create policy "disputes_participant_insert" on public.disputes
  for insert to authenticated
  with check (public.can_access_contract(contract_id) and owner_id = public.current_profile_id());

create index if not exists idx_disputes_contract_status on public.disputes(contract_id, status);

-- PostgREST caches the schema; make the new columns visible immediately.
notify pgrst, 'reload schema';

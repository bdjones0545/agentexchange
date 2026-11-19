-- Agent listing review status, recorded for fresh projects.
--
-- Production already has this column (default 'pending', with the check below),
-- a RESTRICTIVE row policy that shows anonymous visitors only approved listings
-- and signed-in users approved listings plus their own, and a trigger
-- (guard_agent_moderation) that resets a listing to 'pending' when its seller
-- inserts or edits it and refuses status changes from user sessions. Those
-- arrived from the unmerged native-safety branch. The app now reads and writes
-- the status (/api/moderation, MCP publish_agent/whoami), so every environment
-- needs the column. The policy and trigger stay production-only for now; this
-- file is a no-op on production.
alter table public.agents add column if not exists moderation_status text not null default 'pending';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agents_moderation_status_check' and conrelid = 'public.agents'::regclass) then
    alter table public.agents add constraint agents_moderation_status_check check (moderation_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

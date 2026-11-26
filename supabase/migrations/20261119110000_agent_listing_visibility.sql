-- A seller can take a listing off the marketplace and put it back without a new
-- review. `listed` is not one of the columns guard_agent_moderation watches, so
-- switching it never resets moderation_status. Unlisted agents are hidden from
-- everyone but their owner (public pages and sitemaps read with the anon key,
-- signed-in users and agents through RLS). Existing contracts keep working: they
-- carry the agent's name and the ownership checks are SECURITY DEFINER.
-- Additive only and safe to run more than once.

alter table public.agents add column if not exists listed boolean not null default true;

drop policy if exists agents_hide_unlisted_anon on public.agents;
create policy agents_hide_unlisted_anon on public.agents as restrictive for select to anon
  using (listed);
drop policy if exists agents_hide_unlisted_member on public.agents;
create policy agents_hide_unlisted_member on public.agents as restrictive for select to authenticated
  using (listed or owner_id = public.current_profile_id());

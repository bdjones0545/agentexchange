-- A sample deliverable on every agent listing (2026-11-27).
--
-- Buyers judge a fixed-price listing by what it delivers. Sellers can now show a
-- real, scaled-down example of their work on the listing page. It is public text,
-- so it goes through the same review as the rest of the listing: a seller who
-- adds or changes it sends the listing back to review (guard_agent_moderation now
-- watches it). Plain text, at most 8,000 characters.
--
-- Additive (one nullable column) plus a CREATE OR REPLACE of the guard whose body
-- is otherwise identical to 20261011021649. Safe to run more than once.

alter table public.agents add column if not exists sample_deliverable text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agents_sample_deliverable_length') then
    alter table public.agents
      add constraint agents_sample_deliverable_length check (sample_deliverable is null or char_length(sample_deliverable) <= 8000);
  end if;
end $$;

create or replace function public.guard_agent_moderation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return new; end if;
 if tg_op='INSERT' then new.moderation_status:='pending';
 elsif new.moderation_status is distinct from old.moderation_status then raise exception 'Moderation status is managed by the review team' using errcode='42501';
 elsif (new.name,new.specialty,new.description,new.skills,new.tool_access,new.availability,new.verification_status,new.starting_rate,new.revenue,new.success_rate,new.sample_deliverable) is distinct from (old.name,old.specialty,old.description,old.skills,old.tool_access,old.availability,old.verification_status,old.starting_rate,old.revenue,old.success_rate,old.sample_deliverable) then new.moderation_status:='pending'; end if;
 return new;
end $$;
revoke all on function public.guard_agent_moderation() from public,anon,authenticated;

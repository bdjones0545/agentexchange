-- Owner review follow-ups (2026-11-26).
--
-- 1. A deletion request's default response promised completion "within 30 days",
--    which nobody has agreed to, and the account page shows that text to the
--    person. The default now says what actually happens: a person reviews it.
--    Existing rows keep their text (there were none on 2026-11-26).
--
-- 2. Sellers learned a listing was approved or rejected only by looking. When
--    the platform changes a listing's moderation_status to approved or
--    rejected, its owner's agent webhooks get listing.approved or
--    listing.rejected (ids and status only, like every other event). As with
--    the other event triggers, recording an event never fails the write.
--
-- Safe to run more than once.

alter table public.account_deletion_requests
  alter column response set default 'We received your request. A person on our team reviews it before anything is deleted, because some marketplace and payment records may have to be kept. Updates appear here. For questions, email support@agentsexchange.ai.';

create or replace function public.agent_events_listing() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.moderation_status is distinct from old.moderation_status
     and new.moderation_status in ('approved', 'rejected') then
    perform public.emit_agent_event(
      case new.moderation_status when 'approved' then 'listing.approved' else 'listing.rejected' end,
      new.owner_id,
      jsonb_build_object('agentId', new.id, 'status', new.moderation_status));
  end if;
  return null;
exception when others then
  raise warning 'agent events (listings): %', sqlstate;
  return null;
end $$;
revoke all on function public.agent_events_listing() from public, anon, authenticated;

drop trigger if exists agent_events_listing on public.agents;
create trigger agent_events_listing after update of moderation_status on public.agents
  for each row execute function public.agent_events_listing();

notify pgrst, 'reload schema';

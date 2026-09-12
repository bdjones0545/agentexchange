create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text,
  display_name text,
  account_type text,
  role text default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  name text not null,
  industry text,
  overview text,
  verified boolean not null default false,
  rating numeric(3, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  name text not null,
  specialty text not null,
  description text,
  skills text[] not null default '{}',
  availability text not null default 'Available',
  verification_status text not null default 'Unverified',
  starting_rate text,
  tool_access text[] not null default '{}',
  trust_score numeric(5, 2) not null default 0,
  revenue text not null default '$0',
  success_rate text not null default 'New',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  title text not null,
  organization_name text,
  category text not null,
  budget_range text,
  estimated_duration text,
  required_skills text[] not null default '{}',
  description text,
  success_criteria text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  opportunity_id uuid references opportunities(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  agent_name text,
  proposal text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists negotiations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  opportunity_id uuid references opportunities(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  agent_name text,
  rate text,
  timeline text,
  milestone_notes text,
  counter_rate text,
  counter_timeline text,
  counter_note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hire_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  agent_id uuid references agents(id) on delete set null,
  opportunity_id uuid references opportunities(id) on delete set null,
  agent_name text,
  opportunity_title text,
  quick_job_title text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists saved_opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, opportunity_id)
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  agent_id uuid references agents(id) on delete set null,
  source_id uuid,
  source_type text,
  organization_name text not null,
  agent_name text not null,
  title text not null,
  value text,
  status text not null default 'Active',
  start_date text,
  due_date text,
  progress integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contract_milestones (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade,
  title text not null,
  notes text,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contract_deliverables (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade,
  title text not null,
  notes text,
  status text not null default 'draft',
  decisions jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contract_messages (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade,
  sender_type text not null,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade,
  contract_title text,
  agent_id uuid references agents(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  agent_name text not null,
  organization_name text not null,
  rating integer not null check (rating between 1 and 5),
  review text not null,
  created_at timestamptz not null default now()
);

create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  contract_id uuid references contracts(id) on delete cascade,
  reason text not null,
  status text not null default 'Open',
  resolution_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  actor_type text,
  actor_id uuid,
  entity_type text,
  entity_id uuid,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table opportunities
  add column if not exists owner_id uuid references profiles(id) on delete set null;

alter table applications
  add column if not exists owner_id uuid references profiles(id) on delete set null;

alter table negotiations
  add column if not exists owner_id uuid references profiles(id) on delete set null;

alter table hire_requests
  add column if not exists owner_id uuid references profiles(id) on delete set null;

alter table disputes
  add column if not exists owner_id uuid references profiles(id) on delete set null;

alter table disputes
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table reviews
  add column if not exists contract_title text;

alter table activity_events
  add column if not exists owner_id uuid references profiles(id) on delete set null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where user_id = auth.uid()
$$;

alter table organizations alter column owner_id set default public.current_profile_id();
alter table agents alter column owner_id set default public.current_profile_id();
alter table opportunities alter column owner_id set default public.current_profile_id();
alter table applications alter column owner_id set default public.current_profile_id();
alter table negotiations alter column owner_id set default public.current_profile_id();
alter table hire_requests alter column owner_id set default public.current_profile_id();
alter table saved_opportunities alter column owner_id set default public.current_profile_id();
alter table disputes alter column owner_id set default public.current_profile_id();
alter table activity_events alter column owner_id set default public.current_profile_id();

create or replace function public.is_organization_owner(organization_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations
    where id = organization_uuid
      and owner_id = public.current_profile_id()
  )
$$;

create or replace function public.is_agent_owner(agent_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agents
    where id = agent_uuid
      and owner_id = public.current_profile_id()
  )
$$;

-- Canonical organization-side authority for an opportunity: the profile that
-- posted it, or the owner of the organization it belongs to. Authorization is
-- derived from relational ownership only -- never from organization_name,
-- agent_name, display names, or any other client-supplied text.
create or replace function public.is_opportunity_org_side(opportunity_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_uuid
      and (
        o.owner_id = public.current_profile_id()
        or public.is_organization_owner(o.organization_id)
      )
  )
$$;

create or replace function public.can_access_contract(contract_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.contracts c
    where c.id = contract_uuid
      and (
        public.is_organization_owner(c.organization_id)
        or public.is_agent_owner(c.agent_id)
      )
  )
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, display_name, account_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'account_type', 'Agent Operator')
  )
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        account_type = excluded.account_type,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace trigger profiles_set_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

create or replace trigger organizations_set_updated_at
  before update on organizations
  for each row execute function public.set_updated_at();

create or replace trigger agents_set_updated_at
  before update on agents
  for each row execute function public.set_updated_at();

create or replace trigger opportunities_set_updated_at
  before update on opportunities
  for each row execute function public.set_updated_at();

create or replace trigger applications_set_updated_at
  before update on applications
  for each row execute function public.set_updated_at();

create or replace trigger negotiations_set_updated_at
  before update on negotiations
  for each row execute function public.set_updated_at();

create or replace trigger hire_requests_set_updated_at
  before update on hire_requests
  for each row execute function public.set_updated_at();

create or replace trigger contracts_set_updated_at
  before update on contracts
  for each row execute function public.set_updated_at();

create or replace trigger contract_milestones_set_updated_at
  before update on contract_milestones
  for each row execute function public.set_updated_at();

create or replace trigger contract_deliverables_set_updated_at
  before update on contract_deliverables
  for each row execute function public.set_updated_at();

create or replace trigger disputes_set_updated_at
  before update on disputes
  for each row execute function public.set_updated_at();

create index if not exists idx_profiles_user_id on profiles(user_id);
create index if not exists idx_profiles_created_at on profiles(created_at);
create index if not exists idx_organizations_owner_id on organizations(owner_id);
create index if not exists idx_organizations_created_at on organizations(created_at);
create index if not exists idx_agents_owner_id on agents(owner_id);
create index if not exists idx_agents_created_at on agents(created_at);
create index if not exists idx_opportunities_owner_id on opportunities(owner_id);
create index if not exists idx_opportunities_organization_id on opportunities(organization_id);
create index if not exists idx_opportunities_status on opportunities(status);
create index if not exists idx_opportunities_created_at on opportunities(created_at);
create index if not exists idx_applications_owner_id on applications(owner_id);
create index if not exists idx_applications_opportunity_id on applications(opportunity_id);
create index if not exists idx_applications_agent_id on applications(agent_id);
create index if not exists idx_applications_status on applications(status);
create index if not exists idx_applications_created_at on applications(created_at);
create index if not exists idx_negotiations_owner_id on negotiations(owner_id);
create index if not exists idx_negotiations_opportunity_id on negotiations(opportunity_id);
create index if not exists idx_negotiations_agent_id on negotiations(agent_id);
create index if not exists idx_negotiations_status on negotiations(status);
create index if not exists idx_negotiations_created_at on negotiations(created_at);
create index if not exists idx_hire_requests_owner_id on hire_requests(owner_id);
create index if not exists idx_hire_requests_agent_id on hire_requests(agent_id);
create index if not exists idx_hire_requests_opportunity_id on hire_requests(opportunity_id);
create index if not exists idx_hire_requests_status on hire_requests(status);
create index if not exists idx_hire_requests_created_at on hire_requests(created_at);
create index if not exists idx_saved_opportunities_owner_id on saved_opportunities(owner_id);
create index if not exists idx_saved_opportunities_opportunity_id on saved_opportunities(opportunity_id);
create index if not exists idx_saved_opportunities_created_at on saved_opportunities(created_at);
create index if not exists idx_contracts_organization_id on contracts(organization_id);
create index if not exists idx_contracts_agent_id on contracts(agent_id);
create index if not exists idx_contracts_status on contracts(status);
create index if not exists idx_contracts_created_at on contracts(created_at);
create index if not exists idx_contract_milestones_contract_id on contract_milestones(contract_id);
create index if not exists idx_contract_milestones_created_at on contract_milestones(created_at);
create index if not exists idx_contract_deliverables_contract_id on contract_deliverables(contract_id);
create index if not exists idx_contract_deliverables_status on contract_deliverables(status);
create index if not exists idx_contract_deliverables_created_at on contract_deliverables(created_at);
create index if not exists idx_contract_messages_contract_id on contract_messages(contract_id);
create index if not exists idx_contract_messages_created_at on contract_messages(created_at);
create index if not exists idx_reviews_contract_id on reviews(contract_id);
create index if not exists idx_reviews_agent_id on reviews(agent_id);
create index if not exists idx_reviews_organization_id on reviews(organization_id);
create index if not exists idx_reviews_created_at on reviews(created_at);
create index if not exists idx_disputes_contract_id on disputes(contract_id);
create index if not exists idx_disputes_owner_id on disputes(owner_id);
create index if not exists idx_disputes_status on disputes(status);
create index if not exists idx_disputes_created_at on disputes(created_at);
create index if not exists idx_activity_events_actor_id on activity_events(actor_id);
create index if not exists idx_activity_events_owner_id on activity_events(owner_id);
create index if not exists idx_activity_events_entity_id on activity_events(entity_id);
create index if not exists idx_activity_events_event_type on activity_events(event_type);
create index if not exists idx_activity_events_created_at on activity_events(created_at);

alter table profiles enable row level security;
alter table organizations enable row level security;
alter table agents enable row level security;
alter table opportunities enable row level security;
alter table applications enable row level security;
alter table negotiations enable row level security;
alter table hire_requests enable row level security;
alter table saved_opportunities enable row level security;
alter table contracts enable row level security;
alter table contract_milestones enable row level security;
alter table contract_deliverables enable row level security;
alter table contract_messages enable row level security;
alter table reviews enable row level security;
alter table disputes enable row level security;
alter table activity_events enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (user_id = auth.uid());

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles
  for insert with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "organizations_public_read" on organizations;
create policy "organizations_public_read" on organizations
  for select using (true);

drop policy if exists "organizations_authenticated_insert" on organizations;
create policy "organizations_authenticated_insert" on organizations
  for insert to authenticated
  with check (owner_id = public.current_profile_id());

drop policy if exists "organizations_owner_update" on organizations;
create policy "organizations_owner_update" on organizations
  for update to authenticated
  using (owner_id = public.current_profile_id())
  with check (owner_id = public.current_profile_id());

drop policy if exists "agents_public_read" on agents;
create policy "agents_public_read" on agents
  for select using (true);

drop policy if exists "agents_authenticated_insert" on agents;
create policy "agents_authenticated_insert" on agents
  for insert to authenticated
  with check (owner_id = public.current_profile_id());

drop policy if exists "agents_owner_update" on agents;
create policy "agents_owner_update" on agents
  for update to authenticated
  using (owner_id = public.current_profile_id())
  with check (owner_id = public.current_profile_id());

drop policy if exists "opportunities_public_read" on opportunities;
create policy "opportunities_public_read" on opportunities
  for select using (true);

drop policy if exists "opportunities_authenticated_insert" on opportunities;
create policy "opportunities_authenticated_insert" on opportunities
  for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    or public.is_organization_owner(organization_id)
  );

drop policy if exists "opportunities_owner_update" on opportunities;
create policy "opportunities_owner_update" on opportunities
  for update to authenticated
  using (
    owner_id = public.current_profile_id()
    or public.is_organization_owner(organization_id)
  )
  with check (
    owner_id = public.current_profile_id()
    or public.is_organization_owner(organization_id)
  );

drop policy if exists "applications_authenticated_insert" on applications;
create policy "applications_authenticated_insert" on applications
  for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
  );

drop policy if exists "applications_participant_read" on applications;
create policy "applications_participant_read" on applications
  for select to authenticated
  using (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
    or exists (
      select 1 from opportunities o
      where o.id = applications.opportunity_id
        and (
          o.owner_id = public.current_profile_id()
          or public.is_organization_owner(o.organization_id)
        )
    )
  );

drop policy if exists "applications_participant_update" on applications;
create policy "applications_participant_update" on applications
  for update to authenticated
  using (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
    or public.is_opportunity_org_side(opportunity_id)
  )
  with check (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
    or public.is_opportunity_org_side(opportunity_id)
  );

drop policy if exists "negotiations_authenticated_insert" on negotiations;
create policy "negotiations_authenticated_insert" on negotiations
  for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
  );

drop policy if exists "negotiations_participant_read" on negotiations;
create policy "negotiations_participant_read" on negotiations
  for select to authenticated
  using (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
    or exists (
      select 1 from opportunities o
      where o.id = negotiations.opportunity_id
        and (
          o.owner_id = public.current_profile_id()
          or public.is_organization_owner(o.organization_id)
        )
    )
  );

drop policy if exists "negotiations_participant_update" on negotiations;
create policy "negotiations_participant_update" on negotiations
  for update to authenticated
  using (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
    or public.is_opportunity_org_side(opportunity_id)
  )
  with check (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
    or public.is_opportunity_org_side(opportunity_id)
  );

drop policy if exists "hire_requests_authenticated_insert" on hire_requests;
create policy "hire_requests_authenticated_insert" on hire_requests
  for insert to authenticated
  with check (owner_id = public.current_profile_id());

drop policy if exists "hire_requests_participant_read" on hire_requests;
create policy "hire_requests_participant_read" on hire_requests
  for select to authenticated
  using (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
  );

drop policy if exists "hire_requests_participant_update" on hire_requests;
create policy "hire_requests_participant_update" on hire_requests
  for update to authenticated
  using (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
  )
  with check (
    owner_id = public.current_profile_id()
    or public.is_agent_owner(agent_id)
  );

drop policy if exists "saved_opportunities_owner_read" on saved_opportunities;
create policy "saved_opportunities_owner_read" on saved_opportunities
  for select to authenticated
  using (owner_id = public.current_profile_id());

drop policy if exists "saved_opportunities_owner_insert" on saved_opportunities;
create policy "saved_opportunities_owner_insert" on saved_opportunities
  for insert to authenticated
  with check (owner_id = public.current_profile_id());

drop policy if exists "saved_opportunities_owner_delete" on saved_opportunities;
create policy "saved_opportunities_owner_delete" on saved_opportunities
  for delete to authenticated
  using (owner_id = public.current_profile_id());

drop policy if exists "contracts_participant_read" on contracts;
create policy "contracts_participant_read" on contracts
  for select to authenticated
  using (public.can_access_contract(id));

-- A contract binds an organization to an agent. Only the organization that is
-- being bound may create that binding. Allowing the agent side to insert let an
-- agent manufacture a contract naming an organization it does not own.
drop policy if exists "contracts_participant_insert" on contracts;
create policy "contracts_participant_insert" on contracts
  for insert to authenticated
  with check (public.is_organization_owner(organization_id));

drop policy if exists "contracts_participant_update" on contracts;
create policy "contracts_participant_update" on contracts
  for update to authenticated
  using (public.can_access_contract(id))
  with check (public.can_access_contract(id));

drop policy if exists "contract_milestones_participant_read" on contract_milestones;
create policy "contract_milestones_participant_read" on contract_milestones
  for select to authenticated
  using (public.can_access_contract(contract_id));

drop policy if exists "contract_milestones_participant_insert" on contract_milestones;
create policy "contract_milestones_participant_insert" on contract_milestones
  for insert to authenticated
  with check (public.can_access_contract(contract_id));

drop policy if exists "contract_milestones_participant_update" on contract_milestones;
create policy "contract_milestones_participant_update" on contract_milestones
  for update to authenticated
  using (public.can_access_contract(contract_id))
  with check (public.can_access_contract(contract_id));

drop policy if exists "contract_deliverables_participant_read" on contract_deliverables;
create policy "contract_deliverables_participant_read" on contract_deliverables
  for select to authenticated
  using (public.can_access_contract(contract_id));

drop policy if exists "contract_deliverables_participant_insert" on contract_deliverables;
create policy "contract_deliverables_participant_insert" on contract_deliverables
  for insert to authenticated
  with check (public.can_access_contract(contract_id));

drop policy if exists "contract_deliverables_participant_update" on contract_deliverables;
create policy "contract_deliverables_participant_update" on contract_deliverables
  for update to authenticated
  using (public.can_access_contract(contract_id))
  with check (public.can_access_contract(contract_id));

drop policy if exists "contract_messages_participant_read" on contract_messages;
create policy "contract_messages_participant_read" on contract_messages
  for select to authenticated
  using (public.can_access_contract(contract_id));

drop policy if exists "contract_messages_participant_insert" on contract_messages;
create policy "contract_messages_participant_insert" on contract_messages
  for insert to authenticated
  with check (public.can_access_contract(contract_id));

drop policy if exists "reviews_public_read" on reviews;
create policy "reviews_public_read" on reviews
  for select using (true);

drop policy if exists "reviews_contract_participant_insert" on reviews;
create policy "reviews_contract_participant_insert" on reviews
  for insert to authenticated
  with check (public.can_access_contract(contract_id));

drop policy if exists "disputes_participant_read" on disputes;
create policy "disputes_participant_read" on disputes
  for select to authenticated
  using (public.can_access_contract(contract_id));

drop policy if exists "disputes_participant_insert" on disputes;
create policy "disputes_participant_insert" on disputes
  for insert to authenticated
  with check (public.can_access_contract(contract_id));

drop policy if exists "disputes_participant_update" on disputes;
create policy "disputes_participant_update" on disputes
  for update to authenticated
  using (public.can_access_contract(contract_id))
  with check (public.can_access_contract(contract_id));

drop policy if exists "activity_events_public_read" on activity_events;
create policy "activity_events_public_read" on activity_events
  for select using (
    entity_type in ('marketplace', 'opportunity', 'agent')
    or coalesce((metadata->>'public')::boolean, false)
    or owner_id = public.current_profile_id()
  );

drop policy if exists "activity_events_authenticated_insert" on activity_events;
create policy "activity_events_authenticated_insert" on activity_events
  for insert to authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- Marketplace update authority (P0)
--
-- Row-level WITH CHECK can only inspect the post-image of a row. It cannot tell
-- that a row was moved from one security relationship to another, and it cannot
-- tell which actor performed a status transition. Both of those are required
-- here, so the invariants below are enforced by BEFORE UPDATE triggers.
--
-- Core invariant: permission to update a row must not imply permission to
-- transform it into a different security relationship. Relationship keys are
-- immutable after creation, and every status transition is actor-specific.
--
-- All authority is derived from authenticated relational ownership
-- (auth.uid() -> profiles -> organizations / agents / opportunities). Display
-- names, denormalized organization_name / agent_name text, client-supplied role
-- strings and frontend visibility are never consulted.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_application_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
begin
  -- Trusted server-side contexts (service role, migrations, seeds) have no
  -- end-user profile. Untrusted callers cannot reach this trigger without one:
  -- the UPDATE policy is restricted to `authenticated` and every branch of its
  -- USING clause requires a resolvable profile.
  if actor is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.agent_id is distinct from old.agent_id
     or new.opportunity_id is distinct from old.opportunity_id
     or new.created_at is distinct from old.created_at then
    raise exception 'applications: owner_id, agent_id and opportunity_id are immutable'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' then
      raise exception 'applications: status "%" is terminal', old.status
        using errcode = '42501';
    end if;

    if new.status not in ('accepted', 'rejected') then
      raise exception 'applications: unsupported status transition "%" -> "%"',
        old.status, new.status
        using errcode = '42501';
    end if;

    -- Accepting and rejecting are both organization-side authority. The
    -- applicant can neither self-accept nor issue the organization's rejection.
    if not public.is_opportunity_org_side(old.opportunity_id) then
      raise exception 'applications: only the opportunity owner may change application status'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_negotiation_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
begin
  if actor is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.agent_id is distinct from old.agent_id
     or new.opportunity_id is distinct from old.opportunity_id
     or new.created_at is distinct from old.created_at then
    raise exception 'negotiations: owner_id, agent_id and opportunity_id are immutable'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status not in ('pending', 'countered') then
      raise exception 'negotiations: status "%" is terminal', old.status
        using errcode = '42501';
    end if;

    if new.status not in ('accepted', 'rejected', 'countered') then
      raise exception 'negotiations: unsupported status transition "%" -> "%"',
        old.status, new.status
        using errcode = '42501';
    end if;

    -- Acceptance binds the organization, so it is organization-side authority
    -- only. Countering and rejecting/withdrawing remain available to both
    -- participants.
    if new.status = 'accepted'
       and not public.is_opportunity_org_side(old.opportunity_id) then
      raise exception 'negotiations: only the opportunity owner may accept a negotiation'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_hire_request_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
begin
  if actor is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.agent_id is distinct from old.agent_id
     or new.opportunity_id is distinct from old.opportunity_id
     or new.created_at is distinct from old.created_at then
    raise exception 'hire_requests: owner_id, agent_id and opportunity_id are immutable'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' then
      raise exception 'hire_requests: status "%" is terminal', old.status
        using errcode = '42501';
    end if;

    if new.status not in ('accepted', 'rejected') then
      raise exception 'hire_requests: unsupported status transition "%" -> "%"',
        old.status, new.status
        using errcode = '42501';
    end if;

    -- A hire request is issued by the organization and answered by the agent.
    -- Only the owner of the requested agent may accept it; the requesting
    -- organization cannot accept on the agent's behalf. Rejection stays open to
    -- both sides so the agent can decline and the organization can cancel.
    if new.status = 'accepted'
       and not public.is_agent_owner(old.agent_id) then
      raise exception 'hire_requests: only the owner of the requested agent may accept'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- Contract INSERT is restricted to the organization side. Closing only INSERT
-- would leave the same forgery reachable through UPDATE, because
-- can_access_contract() re-reads the committed row and therefore cannot
-- constrain the post-image. The binding parties are immutable instead.
create or replace function public.enforce_contract_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
begin
  if actor is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.agent_id is distinct from old.agent_id
     or new.created_at is distinct from old.created_at then
    raise exception 'contracts: organization_id and agent_id are immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists applications_enforce_update_authority on applications;
create trigger applications_enforce_update_authority
  before update on applications
  for each row execute function public.enforce_application_update_authority();

drop trigger if exists negotiations_enforce_update_authority on negotiations;
create trigger negotiations_enforce_update_authority
  before update on negotiations
  for each row execute function public.enforce_negotiation_update_authority();

drop trigger if exists hire_requests_enforce_update_authority on hire_requests;
create trigger hire_requests_enforce_update_authority
  before update on hire_requests
  for each row execute function public.enforce_hire_request_update_authority();

drop trigger if exists contracts_enforce_update_authority on contracts;
create trigger contracts_enforce_update_authority
  before update on contracts
  for each row execute function public.enforce_contract_update_authority();

-- ---------------------------------------------------------------------------
-- Hire-request contract materialization (P0 follow-up)
--
-- Generic contract INSERT is restricted to is_organization_owner(organization_id),
-- so an accepting agent can no longer create the resulting contract from the
-- client. Restoring is_agent_owner(agent_id) as generic INSERT authority would
-- reopen the P0, so the flow is re-established as two separate, narrowly scoped
-- steps instead:
--
--   1. the owning agent accepts the hire request through the ordinary RLS
--      UPDATE path, which is durable and already actor-gated by
--      enforce_hire_request_update_authority(); then
--   2. materialize_hire_request_contract() derives every contract relationship
--      field from that accepted hire request.
--
-- The caller supplies only a hire request id. organization_id, agent_id and the
-- source relationship are all derived server-side, so a legitimate acceptance
-- never confers authority to name a different organization or agent.
-- ---------------------------------------------------------------------------

-- At most one canonical contract per accepted hire request. This is the hard
-- backstop behind the advisory check inside the function below.
create unique index if not exists uq_contracts_hire_request_source
  on contracts (source_id)
  where source_type = 'hire-request' and source_id is not null;

-- Provenance must be immutable, otherwise a second hire request could be
-- repointed at an existing contract to bypass the uniqueness index above.
create or replace function public.enforce_contract_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
begin
  if actor is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.agent_id is distinct from old.agent_id
     or new.created_at is distinct from old.created_at then
    raise exception 'contracts: organization_id and agent_id are immutable'
      using errcode = '42501';
  end if;

  if new.source_id is distinct from old.source_id
     or new.source_type is distinct from old.source_type then
    raise exception 'contracts: source provenance is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.materialize_hire_request_contract(hire_request_uuid uuid)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  hr hire_requests%rowtype;
  opp opportunities%rowtype;
  org organizations%rowtype;
  requested_agent agents%rowtype;
  existing contracts%rowtype;
  materialized contracts%rowtype;
begin
  if public.current_profile_id() is null then
    raise exception 'materialize_hire_request_contract: authentication required'
      using errcode = '42501';
  end if;

  -- The row lock serialises concurrent callers, which is what makes the
  -- "already materialised" check below a reliable idempotency gate rather than
  -- a race.
  select * into hr from hire_requests where id = hire_request_uuid for update;
  if not found then
    raise exception 'materialize_hire_request_contract: hire request not found'
      using errcode = '42501';
  end if;

  -- Only the two legitimate parties may materialise. An unrelated authenticated
  -- user is refused outright.
  if not (
    public.is_agent_owner(hr.agent_id)
    or public.is_opportunity_org_side(hr.opportunity_id)
  ) then
    raise exception 'materialize_hire_request_contract: caller is not a party to this hire request'
      using errcode = '42501';
  end if;

  -- Materialisation is allowed only after a legitimate acceptance. Acceptance
  -- itself is gated to the owning agent by the hire_requests update trigger, so
  -- the requesting organization cannot manufacture this precondition.
  if hr.status <> 'accepted' then
    raise exception 'materialize_hire_request_contract: hire request is "%", not accepted', hr.status
      using errcode = '42501';
  end if;

  select * into existing
    from contracts
   where source_type = 'hire-request'
     and source_id = hr.id;
  if found then
    return existing;
  end if;

  -- Canonical derivation. Nothing here comes from the caller.
  if hr.opportunity_id is null then
    raise exception 'materialize_hire_request_contract: hire request has no opportunity, so no canonical organization can be derived'
      using errcode = '42501';
  end if;

  select * into opp from opportunities where id = hr.opportunity_id;
  if not found or opp.organization_id is null then
    raise exception 'materialize_hire_request_contract: opportunity has no organization, so no canonical organization can be derived'
      using errcode = '42501';
  end if;

  select * into org from organizations where id = opp.organization_id;
  if not found then
    raise exception 'materialize_hire_request_contract: organization not found'
      using errcode = '42501';
  end if;

  select * into requested_agent from agents where id = hr.agent_id;
  if not found then
    raise exception 'materialize_hire_request_contract: agent not found'
      using errcode = '42501';
  end if;

  -- The hire request must have been ISSUED by the organization side of its own
  -- opportunity. Without this, an agent could self-issue a hire request naming
  -- another organization's opportunity, accept it (it names their own agent),
  -- and materialize a contract against an organization that never hired them --
  -- reopening the P0 through this path.
  if hr.owner_id is null
     or (opp.owner_id is distinct from hr.owner_id
         and org.owner_id is distinct from hr.owner_id) then
    raise exception 'materialize_hire_request_contract: hire request was not issued by the organization side of its opportunity'
      using errcode = '42501';
  end if;

  insert into contracts (
    agent_id, agent_name, due_date, organization_id, organization_name,
    progress, source_id, source_type, start_date, status, title, value
  ) values (
    requested_agent.id,
    requested_agent.name,
    to_char(now() + interval '14 days', 'YYYY-MM-DD'),
    org.id,
    org.name,
    5,
    hr.id,
    'hire-request',
    to_char(now(), 'YYYY-MM-DD'),
    'Active',
    coalesce(nullif(hr.quick_job_title, ''), nullif(hr.opportunity_title, ''), opp.title, 'Hire request'),
    coalesce(opp.budget_range, 'Custom scope')
  )
  returning * into materialized;

  return materialized;
end;
$$;

-- SECURITY DEFINER functions are executable by PUBLIC unless revoked.
revoke all on function public.materialize_hire_request_contract(uuid) from public;
revoke all on function public.materialize_hire_request_contract(uuid) from anon;
grant execute on function public.materialize_hire_request_contract(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Shared-marketplace hardening (2026-09-12)
--
-- The app no longer stores a per-user JSON snapshot of its whole state in
-- activity_events; the normalized tables are the only source of truth. That
-- leaves activity_events as an append-only public timeline, so an actor may
-- only write events it owns (owner_id defaults to the caller's profile).
-- ---------------------------------------------------------------------------
drop policy if exists "activity_events_authenticated_insert" on activity_events;
create policy "activity_events_authenticated_insert" on activity_events
  for insert to authenticated
  with check (owner_id = public.current_profile_id());

-- SECURITY DEFINER helpers are executable by PUBLIC (and therefore by anon
-- over /rest/v1/rpc) unless revoked. Only current_profile_id() must stay
-- callable by anon: activity_events_public_read evaluates it for anonymous
-- readers. Everything else is consulted only by `to authenticated` policies.
revoke all on function public.is_agent_owner(uuid) from public, anon;
revoke all on function public.is_organization_owner(uuid) from public, anon;
revoke all on function public.is_opportunity_org_side(uuid) from public, anon;
revoke all on function public.can_access_contract(uuid) from public, anon;
grant execute on function public.is_agent_owner(uuid) to authenticated;
grant execute on function public.is_organization_owner(uuid) to authenticated;
grant execute on function public.is_opportunity_org_side(uuid) to authenticated;
grant execute on function public.can_access_contract(uuid) to authenticated;
-- The auth trigger runs as its owner; nobody needs to call it directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;

alter function public.set_updated_at() set search_path = public;

-- Trigger functions fire regardless of the invoking role's EXECUTE privilege
-- (proven by scripts/rls-local-verify.sh), so nobody needs to call them
-- directly and anon must not be able to reach them over /rest/v1/rpc.
revoke all on function public.enforce_application_update_authority() from public, anon, authenticated;
revoke all on function public.enforce_negotiation_update_authority() from public, anon, authenticated;
revoke all on function public.enforce_hire_request_update_authority() from public, anon, authenticated;
revoke all on function public.enforce_contract_update_authority() from public, anon, authenticated;

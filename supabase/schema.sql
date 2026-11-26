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
  gate jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every quality-gate decision on a submitted deliverable (see migrations/20260922171157_deliverable_gate.sql).
create table if not exists deliverable_gate_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  worker_profile_id uuid references profiles(id) on delete set null,
  deliverable_id uuid references contract_deliverables(id) on delete set null,
  title text,
  verdict text not null check (verdict in ('passed', 'returned', 'accepted_with_flags', 'unavailable')),
  attempt integer not null default 1,
  answers jsonb,
  flags jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists idx_deliverable_gate_events_contract_id on deliverable_gate_events(contract_id);
create index if not exists idx_deliverable_gate_events_created_at on deliverable_gate_events(created_at);

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

alter table deliverable_gate_events enable row level security;

drop policy if exists "deliverable_gate_events_participant_read" on deliverable_gate_events;
create policy "deliverable_gate_events_participant_read" on deliverable_gate_events
  for select to authenticated
  using (public.can_access_contract(contract_id));

drop policy if exists "deliverable_gate_events_participant_insert" on deliverable_gate_events;
create policy "deliverable_gate_events_participant_insert" on deliverable_gate_events
  for insert to authenticated
  with check (public.can_access_contract(contract_id) and worker_profile_id = public.current_profile_id());

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

-- ---------------------------------------------------------------------------
-- Record creation requires ownership of the party it names; trust signals are
-- platform-managed; reviews are attributed; approvals are organization-side;
-- disputes are resolved by their complainant. (2026-09-16)
--
-- Root defect closed here: the insert policies below used
--   owner_id = current_profile_id() OR is_agent_owner(agent_id)
-- and owner_id defaults to the caller, so the first term was always true and
-- the ownership term never restricted anything. Any signed-in user could
-- forge an application "from" any agent, post an opportunity under any
-- organization, and an organization could bind any agent to a contract with
-- no application, then dispute it and flip the agent's public badge.
--
-- Everything below is idempotent. Proven by scripts/rls-local-verify.sh.
-- ---------------------------------------------------------------------------

-- 1. Creation must name a party the caller owns ------------------------------

drop policy if exists "applications_authenticated_insert" on applications;
create policy "applications_authenticated_insert" on applications
  for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    and public.is_agent_owner(agent_id)
  );

drop policy if exists "negotiations_authenticated_insert" on negotiations;
create policy "negotiations_authenticated_insert" on negotiations
  for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    and public.is_agent_owner(agent_id)
  );

drop policy if exists "opportunities_authenticated_insert" on opportunities;
create policy "opportunities_authenticated_insert" on opportunities
  for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    and (organization_id is null or public.is_organization_owner(organization_id))
  );

-- A hire request is issued by the organization side of its own opportunity.
-- Quick-job requests without an opportunity stay allowed; they can never
-- materialize a contract (the RPC refuses them), so they are harmless.
drop policy if exists "hire_requests_authenticated_insert" on hire_requests;
create policy "hire_requests_authenticated_insert" on hire_requests
  for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    and (opportunity_id is null or public.is_opportunity_org_side(opportunity_id))
  );

-- 2. A contract needs the agent's consent, expressed by the agent's own
--    application or negotiation on this organization's opportunity. Hire
--    requests still materialize only through the RPC, which verifies both sides.
create or replace function public.contract_source_consents(
  source_type_in text,
  source_id_in uuid,
  agent_uuid uuid,
  organization_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case source_type_in
    when 'application' then exists (
      select 1
      from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      where a.id = source_id_in
        and a.agent_id = agent_uuid
        and o.organization_id = organization_uuid
    )
    when 'negotiation' then exists (
      select 1
      from public.negotiations n
      join public.opportunities o on o.id = n.opportunity_id
      where n.id = source_id_in
        and n.agent_id = agent_uuid
        and o.organization_id = organization_uuid
    )
    else false
  end
$$;
revoke all on function public.contract_source_consents(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.contract_source_consents(text, uuid, uuid, uuid) to authenticated;

drop policy if exists "contracts_participant_insert" on contracts;
create policy "contracts_participant_insert" on contracts
  for insert to authenticated
  with check (
    public.is_organization_owner(organization_id)
    and public.contract_source_consents(source_type, source_id, agent_id, organization_id)
  );

-- One contract per accepted application/negotiation, as a hard backstop
-- behind the app's own duplicate check (hire requests already had one).
create unique index if not exists uq_contracts_source
  on contracts (source_type, source_id)
  where source_id is not null;

-- 3. Trust signals are platform-managed ---------------------------------------
-- Owners may edit what describes their agent or organization, never what
-- vouches for it. On insert the vouching columns are normalized to defaults;
-- on update they are immutable for an end user. Service-role writes (no
-- profile) are unaffected, which is how the platform sets them.

create or replace function public.enforce_agent_trust_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.trust_score := 0;
    new.verification_status := 'Unverified';
    new.revenue := '$0';
    new.success_rate := 'New';
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
     or new.trust_score is distinct from old.trust_score
     or new.verification_status is distinct from old.verification_status
     or new.revenue is distinct from old.revenue
     or new.success_rate is distinct from old.success_rate then
    raise exception 'agents: trust_score, verification_status, revenue, success_rate and owner_id are platform-managed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_agent_trust_columns() from public, anon, authenticated;

drop trigger if exists agents_enforce_trust_columns on agents;
create trigger agents_enforce_trust_columns
  before insert or update on agents
  for each row execute function public.enforce_agent_trust_columns();

create or replace function public.enforce_organization_trust_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified := false;
    new.rating := 0;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
     or new.verified is distinct from old.verified
     or new.rating is distinct from old.rating then
    raise exception 'organizations: verified, rating and owner_id are platform-managed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_organization_trust_columns() from public, anon, authenticated;

drop trigger if exists organizations_enforce_trust_columns on organizations;
create trigger organizations_enforce_trust_columns
  before insert or update on organizations
  for each row execute function public.enforce_organization_trust_columns();

-- 4. Reviews are written by the organization about the agent it contracted --
alter table reviews
  add column if not exists reviewer_id uuid references profiles(id) on delete set null;
alter table reviews alter column reviewer_id set default public.current_profile_id();

drop policy if exists "reviews_contract_participant_insert" on reviews;
drop policy if exists "reviews_organization_insert" on reviews;
create policy "reviews_organization_insert" on reviews
  for insert to authenticated
  with check (
    reviewer_id = public.current_profile_id()
    and exists (
      select 1
      from public.contracts c
      where c.id = reviews.contract_id
        and public.is_organization_owner(c.organization_id)
        and c.agent_id = reviews.agent_id
    )
  );

-- One review per contract.
create unique index if not exists uq_reviews_contract
  on reviews (contract_id)
  where contract_id is not null;

-- 5. Deliverable decisions and milestone completion are organization-side ---
create or replace function public.is_contract_org_side(contract_uuid uuid)
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
      and public.is_organization_owner(c.organization_id)
  )
$$;
revoke all on function public.is_contract_org_side(uuid) from public, anon;
grant execute on function public.is_contract_org_side(uuid) to authenticated;

create or replace function public.enforce_deliverable_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;

  if new.contract_id is distinct from old.contract_id then
    raise exception 'contract_deliverables: contract_id is immutable' using errcode = '42501';
  end if;

  -- Either party may draft, edit and submit. Only the organization decides.
  if (new.status = 'approved' and old.status is distinct from 'approved')
     or new.approved_at is distinct from old.approved_at
     or new.decisions is distinct from old.decisions then
    if not public.is_contract_org_side(old.contract_id) then
      raise exception 'contract_deliverables: only the organization may approve, reject or record a decision'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_deliverable_update_authority() from public, anon, authenticated;

drop trigger if exists contract_deliverables_enforce_update_authority on contract_deliverables;
create trigger contract_deliverables_enforce_update_authority
  before update on contract_deliverables
  for each row execute function public.enforce_deliverable_update_authority();

create or replace function public.enforce_deliverable_insert_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;
  -- A deliverable cannot be born approved by the agent side.
  if (new.status = 'approved' or new.approved_at is not null
      or coalesce(jsonb_array_length(new.decisions), 0) > 0)
     and not public.is_contract_org_side(new.contract_id) then
    raise exception 'contract_deliverables: only the organization may approve'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_deliverable_insert_authority() from public, anon, authenticated;

drop trigger if exists contract_deliverables_enforce_insert_authority on contract_deliverables;
create trigger contract_deliverables_enforce_insert_authority
  before insert on contract_deliverables
  for each row execute function public.enforce_deliverable_insert_authority();

create or replace function public.enforce_milestone_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.contract_id is distinct from old.contract_id then
    raise exception 'contract_milestones: contract_id is immutable' using errcode = '42501';
  end if;
  -- Either party may add and edit milestones; completion is confirmed by the
  -- organization, because completed milestones drive contract progress.
  if new.completed
     and (tg_op = 'INSERT' or old.completed is distinct from true)
     and not public.is_contract_org_side(new.contract_id) then
    raise exception 'contract_milestones: only the organization may mark a milestone complete'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_milestone_authority() from public, anon, authenticated;

drop trigger if exists contract_milestones_enforce_authority on contract_milestones;
create trigger contract_milestones_enforce_authority
  before insert or update on contract_milestones
  for each row execute function public.enforce_milestone_authority();

-- 6. Disputes: either party may open one or mark it under review; only the
--    party that opened it may mark it resolved.
create or replace function public.enforce_dispute_update_authority()
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
  if new.contract_id is distinct from old.contract_id
     or new.owner_id is distinct from old.owner_id then
    raise exception 'disputes: contract_id and owner_id are immutable' using errcode = '42501';
  end if;
  if new.status = 'Resolved' and old.status is distinct from 'Resolved'
     and old.owner_id is distinct from actor then
    raise exception 'disputes: only the party that opened a dispute may resolve it'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_dispute_update_authority() from public, anon, authenticated;

drop trigger if exists disputes_enforce_update_authority on disputes;
create trigger disputes_enforce_update_authority
  before update on disputes
  for each row execute function public.enforce_dispute_update_authority();

-- ---------------------------------------------------------------------------
-- Phase 0 of payments (2026-09-18): the price becomes a number.
--
-- Until now a contract's worth was a text range copied from the opportunity
-- ("$400 - $800"), so nothing could ever be charged or paid out. This adds:
--   * contracts.amount_cents / currency          the agreed price, set once at creation
--   * contracts.payment_status / platform_fee_bps platform-managed money state
--   * hire_requests.amount_cents / currency      the organization's offer; the agent's
--                                                acceptance is consent to it, and the
--                                                materialize RPC copies it verbatim
--   * payments, payouts                          the ledger, written only by the platform
--
-- Authority follows the trust-column pattern: end users may state a price when a
-- record is born and never change it; payment_status, the fee snapshot and the
-- ledger tables are immutable to authenticated users and are written by the
-- service role (Stripe webhooks, later phases) only. No money moves yet.
-- ---------------------------------------------------------------------------

-- Single source for the platform's take rate, snapshotted onto every contract at
-- creation so a later change never re-prices existing agreements.
create or replace function public.platform_fee_bps()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 1500
$$;

alter table contracts add column if not exists amount_cents integer;
alter table contracts add column if not exists currency text not null default 'USD';
alter table contracts add column if not exists payment_status text not null default 'unfunded';
alter table contracts add column if not exists platform_fee_bps integer not null default 1500;

alter table contracts drop constraint if exists contracts_amount_cents_check;
alter table contracts add constraint contracts_amount_cents_check
  check (amount_cents is null or amount_cents >= 0);
alter table contracts drop constraint if exists contracts_currency_check;
alter table contracts add constraint contracts_currency_check
  check (currency ~ '^[A-Z]{3}$');
alter table contracts drop constraint if exists contracts_payment_status_check;
alter table contracts add constraint contracts_payment_status_check
  check (payment_status in ('unfunded', 'authorized', 'captured', 'paid_out', 'refunded'));
alter table contracts drop constraint if exists contracts_platform_fee_bps_check;
alter table contracts add constraint contracts_platform_fee_bps_check
  check (platform_fee_bps between 0 and 10000);

alter table hire_requests add column if not exists amount_cents integer;
alter table hire_requests add column if not exists currency text not null default 'USD';
alter table hire_requests drop constraint if exists hire_requests_amount_cents_check;
alter table hire_requests add constraint hire_requests_amount_cents_check
  check (amount_cents is null or amount_cents >= 0);
alter table hire_requests drop constraint if exists hire_requests_currency_check;
alter table hire_requests add constraint hire_requests_currency_check
  check (currency ~ '^[A-Z]{3}$');

-- Money columns on contracts: stated once, then platform-managed.
create or replace function public.enforce_contract_money_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    -- Service role (webhooks, operators of the platform): unrestricted.
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A contract is born unfunded at the current take rate, whatever the caller sent.
    new.payment_status := 'unfunded';
    new.platform_fee_bps := public.platform_fee_bps();
    new.currency := upper(coalesce(new.currency, 'USD'));
    return new;
  end if;

  if new.amount_cents is distinct from old.amount_cents
     or new.currency is distinct from old.currency then
    raise exception 'contracts: the agreed price is immutable'
      using errcode = '42501';
  end if;
  if new.payment_status is distinct from old.payment_status
     or new.platform_fee_bps is distinct from old.platform_fee_bps then
    raise exception 'contracts: payment_status and platform_fee_bps are platform-managed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_contract_money_columns() from public, anon, authenticated;

drop trigger if exists contracts_enforce_money_columns on contracts;
create trigger contracts_enforce_money_columns
  before insert or update on contracts
  for each row execute function public.enforce_contract_money_columns();

-- An offer cannot change once the agent can see it; withdraw and reissue instead.
create or replace function public.enforce_hire_request_money_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.currency := upper(coalesce(new.currency, 'USD'));
    return new;
  end if;
  if new.amount_cents is distinct from old.amount_cents
     or new.currency is distinct from old.currency then
    raise exception 'hire_requests: the offered price is immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_hire_request_money_columns() from public, anon, authenticated;

drop trigger if exists hire_requests_enforce_money_columns on hire_requests;
create trigger hire_requests_enforce_money_columns
  before insert or update on hire_requests
  for each row execute function public.enforce_hire_request_money_columns();

-- The ledger. Participants may read their own rows; nobody but the platform writes.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  provider text not null default 'stripe',
  provider_ref text unique,
  kind text not null check (kind in ('charge', 'refund')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('pending', 'authorized', 'captured', 'refunded', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  operator_profile_id uuid references profiles(id) on delete set null,
  gross_cents integer not null check (gross_cents >= 0),
  fee_cents integer not null check (fee_cents >= 0),
  net_cents integer not null check (net_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (net_cents = gross_cents - fee_cents)
);

create index if not exists idx_payments_contract_id on payments(contract_id);
create index if not exists idx_payouts_contract_id on payouts(contract_id);
create index if not exists idx_payouts_operator_profile_id on payouts(operator_profile_id);

create or replace trigger payments_set_updated_at
  before update on payments
  for each row execute function public.set_updated_at();
create or replace trigger payouts_set_updated_at
  before update on payouts
  for each row execute function public.set_updated_at();

alter table payments enable row level security;
alter table payouts enable row level security;

drop policy if exists "payments_participant_read" on payments;
create policy "payments_participant_read" on payments
  for select to authenticated
  using (public.can_access_contract(contract_id));

drop policy if exists "payouts_participant_read" on payouts;
create policy "payouts_participant_read" on payouts
  for select to authenticated
  using (public.can_access_contract(contract_id));

-- No insert/update/delete policies exist for authenticated, and the grants are
-- withdrawn too, so a future policy mistake cannot quietly reopen the ledger.
revoke insert, update, delete on payments from anon, authenticated;
revoke insert, update, delete on payouts from anon, authenticated;

-- The materialize RPC now carries the offered price onto the contract.
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
    progress, source_id, source_type, start_date, status, title, value,
    amount_cents, currency
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
    coalesce(opp.budget_range, 'Custom scope'),
    -- The agreed price is the organization's offer on the hire request; the
    -- agent's acceptance (gated to the agent's owner) is consent to it.
    hr.amount_cents,
    coalesce(hr.currency, 'USD')
  )
  returning * into materialized;

  return materialized;
end;
$$;
revoke all on function public.materialize_hire_request_contract(uuid) from public;
revoke all on function public.materialize_hire_request_contract(uuid) from anon;
grant execute on function public.materialize_hire_request_contract(uuid) to authenticated;
-- ---------------------------------------------------------------------------
-- Agents as first-class users (2026-09-18).
--
-- Any operator can mint API keys for the agents they run. A key authenticates
-- an agent to the marketplace's MCP server (/api/mcp) and lets it act as the
-- operator's own account — publish listings, browse briefs, apply, negotiate,
-- accept hire requests, deliver — under exactly the RLS and triggers a human
-- session gets. Only the SHA-256 of a key is stored; the raw key is shown once.
-- ---------------------------------------------------------------------------
create table if not exists agent_api_keys (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_agent_api_keys_profile_id on agent_api_keys(profile_id);

alter table agent_api_keys alter column profile_id set default public.current_profile_id();
alter table agent_api_keys enable row level security;

-- Operators manage their own keys. The hash is write-once; only name and
-- revoked_at may change, and a revocation cannot be undone.
drop policy if exists "agent_api_keys_owner_read" on agent_api_keys;
create policy "agent_api_keys_owner_read" on agent_api_keys
  for select to authenticated
  using (profile_id = public.current_profile_id());

drop policy if exists "agent_api_keys_owner_insert" on agent_api_keys;
create policy "agent_api_keys_owner_insert" on agent_api_keys
  for insert to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists "agent_api_keys_owner_update" on agent_api_keys;
create policy "agent_api_keys_owner_update" on agent_api_keys
  for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

create or replace function public.enforce_agent_api_key_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if (select count(*) from agent_api_keys where profile_id = new.profile_id and revoked_at is null) >= 10 then
      raise exception 'agent_api_keys: at most 10 active keys per operator'
        using errcode = '42501';
    end if;
    new.last_used_at := null;
    new.revoked_at := null;
    return new;
  end if;
  if new.key_hash is distinct from old.key_hash
     or new.key_prefix is distinct from old.key_prefix
     or new.profile_id is distinct from old.profile_id
     or new.created_at is distinct from old.created_at
     or new.last_used_at is distinct from old.last_used_at then
    raise exception 'agent_api_keys: only name and revoked_at may change'
      using errcode = '42501';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'agent_api_keys: a revoked key stays revoked'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_agent_api_key_columns() from public, anon, authenticated;

drop trigger if exists agent_api_keys_enforce_columns on agent_api_keys;
create trigger agent_api_keys_enforce_columns
  before insert or update on agent_api_keys
  for each row execute function public.enforce_agent_api_key_columns();

-- The MCP server resolves a presented key to its operator's auth user. Only the
-- service role may call this; a key hash never reaches an anon or user session.
create or replace function public.resolve_agent_api_key(hash_in text)
returns table (key_id uuid, profile_id uuid, user_id uuid)
language sql
security definer
set search_path = public
as $$
  select k.id, k.profile_id, p.user_id
  from agent_api_keys k
  join profiles p on p.id = k.profile_id
  where k.key_hash = hash_in and k.revoked_at is null
$$;
revoke all on function public.resolve_agent_api_key(text) from public, anon, authenticated;
-- ---------------------------------------------------------------------------
-- Negotiation closes the loop (2026-09-18).
--
-- Before: an agent could propose terms and the organization could accept,
-- counter or reject, but nothing let the agent answer a counter, and terms
-- were free text so an accepted negotiation carried no price a contract could
-- use. Now:
--   * negotiations.amount_cents         the agent's proposed price (write-once)
--   * negotiations.counter_amount_cents the organization's counter (org-side only)
--   * countering is organization-side only; the agent answers with accept,
--     withdraw, or a fresh negotiation
--   * the agent may accept a COUNTERED negotiation (the organization already
--     consented to those terms by proposing them); accepting a PENDING one
--     stays organization-only
--   * accepted_by records which side closed it, so the price is unambiguous
--   * materialize_negotiation_contract() derives the contract from an accepted
--     negotiation the way the hire-request RPC does — nothing from the caller
-- ---------------------------------------------------------------------------
alter table negotiations add column if not exists amount_cents integer;
alter table negotiations add column if not exists counter_amount_cents integer;
alter table negotiations add column if not exists currency text not null default 'USD';
alter table negotiations add column if not exists accepted_by text;

alter table negotiations drop constraint if exists negotiations_amount_cents_check;
alter table negotiations add constraint negotiations_amount_cents_check
  check (amount_cents is null or amount_cents >= 0);
alter table negotiations drop constraint if exists negotiations_counter_amount_cents_check;
alter table negotiations add constraint negotiations_counter_amount_cents_check
  check (counter_amount_cents is null or counter_amount_cents >= 0);
alter table negotiations drop constraint if exists negotiations_currency_check;
alter table negotiations add constraint negotiations_currency_check
  check (currency ~ '^[A-Z]{3}$');
alter table negotiations drop constraint if exists negotiations_accepted_by_check;
alter table negotiations add constraint negotiations_accepted_by_check
  check (accepted_by is null or accepted_by in ('organization', 'agent'));

create or replace function public.enforce_negotiation_update_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
  org_side boolean;
  agent_side boolean;
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

  -- The proposed price is stated once. accepted_by is set here, never by a caller.
  if new.amount_cents is distinct from old.amount_cents
     or new.currency is distinct from old.currency then
    raise exception 'negotiations: the proposed price is immutable'
      using errcode = '42501';
  end if;
  new.accepted_by := old.accepted_by;

  org_side := public.is_opportunity_org_side(old.opportunity_id);
  agent_side := public.is_agent_owner(old.agent_id);

  -- Counter terms are the organization's to write.
  if (new.counter_rate is distinct from old.counter_rate
      or new.counter_timeline is distinct from old.counter_timeline
      or new.counter_note is distinct from old.counter_note
      or new.counter_amount_cents is distinct from old.counter_amount_cents)
     and not org_side then
    raise exception 'negotiations: only the organization may counter'
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

    if new.status = 'countered' and not org_side then
      raise exception 'negotiations: only the organization may counter'
        using errcode = '42501';
    end if;

    if new.status = 'accepted' then
      if org_side then
        new.accepted_by := 'organization';
      elsif agent_side and old.status = 'countered' then
        -- The organization consented to these terms by proposing them.
        new.accepted_by := 'agent';
      else
        raise exception 'negotiations: the agent may accept only a countered negotiation; the organization accepts proposals'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_negotiation_update_authority() from public, anon, authenticated;

create or replace function public.enforce_negotiation_insert_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;
  new.currency := upper(coalesce(new.currency, 'USD'));
  new.counter_amount_cents := null;
  new.accepted_by := null;
  return new;
end;
$$;
revoke all on function public.enforce_negotiation_insert_columns() from public, anon, authenticated;

drop trigger if exists negotiations_enforce_insert_columns on negotiations;
create trigger negotiations_enforce_insert_columns
  before insert on negotiations
  for each row execute function public.enforce_negotiation_insert_columns();

-- Derive a contract from an accepted negotiation. Mirrors the hire-request RPC:
-- either party may call it, only after acceptance, idempotent, and every field
-- comes from the rows — the price from whichever side closed the deal.
create or replace function public.materialize_negotiation_contract(negotiation_uuid uuid)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  neg negotiations%rowtype;
  opp opportunities%rowtype;
  org organizations%rowtype;
  the_agent agents%rowtype;
  existing contracts%rowtype;
  materialized contracts%rowtype;
  price integer;
begin
  if public.current_profile_id() is null then
    raise exception 'materialize_negotiation_contract: authentication required'
      using errcode = '42501';
  end if;

  select * into neg from negotiations where id = negotiation_uuid for update;
  if not found then
    raise exception 'materialize_negotiation_contract: negotiation not found'
      using errcode = '42501';
  end if;

  if not (public.is_agent_owner(neg.agent_id) or public.is_opportunity_org_side(neg.opportunity_id)) then
    raise exception 'materialize_negotiation_contract: caller is not a party to this negotiation'
      using errcode = '42501';
  end if;

  if neg.status <> 'accepted' then
    raise exception 'materialize_negotiation_contract: negotiation is "%", not accepted', neg.status
      using errcode = '42501';
  end if;

  select * into existing from contracts where source_type = 'negotiation' and source_id = neg.id;
  if found then
    return existing;
  end if;

  select * into opp from opportunities where id = neg.opportunity_id;
  if not found or opp.organization_id is null then
    raise exception 'materialize_negotiation_contract: opportunity has no organization'
      using errcode = '42501';
  end if;
  select * into org from organizations where id = opp.organization_id;
  if not found then
    raise exception 'materialize_negotiation_contract: organization not found'
      using errcode = '42501';
  end if;
  select * into the_agent from agents where id = neg.agent_id;
  if not found then
    raise exception 'materialize_negotiation_contract: agent not found'
      using errcode = '42501';
  end if;

  price := case
    when neg.accepted_by = 'agent' then coalesce(neg.counter_amount_cents, neg.amount_cents)
    else neg.amount_cents
  end;

  insert into contracts (
    agent_id, agent_name, due_date, organization_id, organization_name,
    progress, source_id, source_type, start_date, status, title, value,
    amount_cents, currency
  ) values (
    the_agent.id,
    the_agent.name,
    to_char(now() + interval '21 days', 'YYYY-MM-DD'),
    org.id,
    org.name,
    5,
    neg.id,
    'negotiation',
    to_char(now(), 'YYYY-MM-DD'),
    'Active',
    coalesce(opp.title, 'Negotiated contract'),
    coalesce(case when neg.accepted_by = 'agent' then neg.counter_rate end, neg.rate, opp.budget_range, 'Custom scope'),
    price,
    coalesce(neg.currency, 'USD')
  )
  returning * into materialized;

  return materialized;
end;
$$;
revoke all on function public.materialize_negotiation_contract(uuid) from public;
revoke all on function public.materialize_negotiation_contract(uuid) from anon;
grant execute on function public.materialize_negotiation_contract(uuid) to authenticated;
-- Payments phase 1 (2026-09-18): Stripe webhook idempotency.
--
-- Every Stripe event the webhook handles is recorded here before it acts, so a
-- redelivered event (Stripe retries on any non-2xx, and can deliver twice) is a
-- no-op the second time. Service-role only: no policies, grants revoked.
-- ---------------------------------------------------------------------------
create table if not exists stripe_events (
  id text primary key,
  type text not null,
  contract_id uuid references contracts(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text
);

alter table stripe_events enable row level security;
revoke all on stripe_events from anon, authenticated;
-- ---------------------------------------------------------------------------
-- Deliverable emails (2026-10-15): the owner email's idempotency ledger (see
-- migrations/20261126160000_email_notifications.sql). Service-role only.
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
-- Explicit, because tables created in public after 2026-10-30 get no default
-- grant (see the Explicit Data API grants section).
grant select, insert, update on table public.email_notifications to service_role;

-- The owner's address for a deliverable email, so the service role never needs
-- direct SELECT on profiles (the same pattern as resolve_agent_api_key). The
-- auth record is the current address; profiles.email, copied at sign-up, is
-- the fallback. Service-role only.
create or replace function public.organization_owner_email(org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.email, p.email)
  from organizations o
  join profiles p on p.id = o.owner_id
  left join auth.users u on u.id = p.user_id
  where o.id = org_id
$$;
revoke all on function public.organization_owner_email(uuid) from public, anon, authenticated;
grant execute on function public.organization_owner_email(uuid) to service_role;
-- ---------------------------------------------------------------------------
-- Agent-card payments (2026-09-18): an operator saves a card once; its agents
-- may then fund contracts off-session, within a daily cap the operator sets.
--
-- billing_accounts is written only by the platform (the Stripe webhook saves
-- the payment method; the checkout/fund paths read it). Operators read their
-- own row and may change only their agent spend cap.
-- ---------------------------------------------------------------------------
create table if not exists billing_accounts (
  profile_id uuid primary key references profiles(id) on delete cascade,
  stripe_customer_id text unique,
  default_payment_method_id text,
  card_brand text,
  card_last4 text,
  card_exp_month integer,
  card_exp_year integer,
  -- What agents holding this operator's keys may authorize per rolling 24h.
  agent_daily_cap_cents integer not null default 100000 check (agent_daily_cap_cents between 0 and 10000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table billing_accounts enable row level security;

drop policy if exists "billing_accounts_owner_read" on billing_accounts;
create policy "billing_accounts_owner_read" on billing_accounts
  for select to authenticated
  using (profile_id = public.current_profile_id());

drop policy if exists "billing_accounts_owner_update" on billing_accounts;
create policy "billing_accounts_owner_update" on billing_accounts
  for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

revoke insert, delete on billing_accounts from anon, authenticated;

-- An operator may change the cap and nothing else; card fields are the platform's.
create or replace function public.enforce_billing_account_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_id() is null then
    return new;
  end if;
  if new.profile_id is distinct from old.profile_id
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.default_payment_method_id is distinct from old.default_payment_method_id
     or new.card_brand is distinct from old.card_brand
     or new.card_last4 is distinct from old.card_last4
     or new.card_exp_month is distinct from old.card_exp_month
     or new.card_exp_year is distinct from old.card_exp_year
     or new.created_at is distinct from old.created_at then
    raise exception 'billing_accounts: only agent_daily_cap_cents may be changed by the operator'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_billing_account_columns() from public, anon, authenticated;

drop trigger if exists billing_accounts_enforce_columns on billing_accounts;
create trigger billing_accounts_enforce_columns
  before update on billing_accounts
  for each row execute function public.enforce_billing_account_columns();

create or replace trigger billing_accounts_set_updated_at
  before update on billing_accounts
  for each row execute function public.set_updated_at();

-- Record which principal authorized a payment: a human at Checkout, or an agent key.
alter table payments add column if not exists authorized_by text;
alter table payments drop constraint if exists payments_authorized_by_check;
alter table payments add constraint payments_authorized_by_check
  check (authorized_by is null or authorized_by in ('human', 'agent'));

-- Payment infrastructure (2026-09-26)
-- Proposal only: apply to production after review. No existing financial rows are deleted.
alter table public.billing_accounts add column if not exists agent_per_contract_cap_cents integer not null default 0
  check (agent_per_contract_cap_cents between 0 and 10000000);
-- New accounts must explicitly opt in; existing daily caps remain unchanged.
alter table public.billing_accounts alter column agent_daily_cap_cents set default 0;

create table if not exists public.seller_accounts (
  profile_id uuid primary key references public.profiles(id),
  stripe_account_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.seller_accounts enable row level security;
grant select on public.seller_accounts to authenticated;
revoke all on public.seller_accounts from anon;
revoke insert, update, delete on public.seller_accounts from authenticated;
grant all on public.seller_accounts to service_role;
drop policy if exists seller_account_read on public.seller_accounts;
create policy seller_account_read on public.seller_accounts for select to authenticated
  using (profile_id = public.current_profile_id());

alter table public.agent_api_keys add column if not exists can_spend boolean not null default false;
-- Payment scope (migration 20261119030000): an agent may fund or release only
-- with both money actions listed and the contract's organization included.
alter table public.agent_api_keys add column if not exists organization_ids uuid[] not null default '{}';
alter table public.agent_api_keys add column if not exists allowed_actions text[] not null default array[
  'publish_agent','apply_to_opportunity','negotiate_opportunity','respond_to_negotiation',
  'respond_to_hire_request','post_message','submit_deliverable','update_progress'
];
alter table public.agent_api_keys add column if not exists paused_at timestamptz;
-- Listing review (migration 20261119050000): new listings wait for the platform
-- owner at /owner/moderation before buyers can see them.
alter table public.agents add column if not exists moderation_status text not null default 'pending';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agents_moderation_status_check' and conrelid = 'public.agents'::regclass) then
    alter table public.agents add constraint agents_moderation_status_check check (moderation_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

-- Durable operations are both the retry journal and the agent budget reservations.
-- An ambiguous funding request keeps its budget reserved until reconciled.
create table if not exists public.money_operations (
  key text primary key,
  kind text not null,
  profile_id uuid references public.profiles(id),
  contract_id uuid references public.contracts(id),
  request jsonb not null,
  result jsonb,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text
);
alter table public.money_operations enable row level security;
revoke all on public.money_operations from public, anon, authenticated;
grant all on public.money_operations to service_role;
create index if not exists money_operations_budget on public.money_operations(profile_id, created_at) where kind = 'fund_agent';
create index if not exists money_operations_pending on public.money_operations(created_at) where completed_at is null;

-- Serialize funding reservations per buyer across ALL their contracts and processes.
-- No SECURITY DEFINER: only the ledger's service role may execute this function.
create or replace function public.begin_money_operation(
  p_key text, p_kind text, p_profile uuid, p_contract uuid, p_request jsonb, p_amount integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare op public.money_operations%rowtype; b public.billing_accounts%rowtype; spent bigint; token uuid;
begin
  if p_kind = 'fund_agent' then
    select * into b from public.billing_accounts where profile_id = p_profile for update;
    if not found then raise exception 'no billing account'; end if;
  end if;
  insert into public.money_operations(key, kind, profile_id, contract_id, request, amount_cents)
    values(p_key, p_kind, p_profile, p_contract, p_request, p_amount) on conflict do nothing;
  select * into op from public.money_operations where key = p_key for update;
  if op.kind <> p_kind or op.profile_id is distinct from p_profile or op.contract_id is distinct from p_contract
     or op.request <> p_request or op.amount_cents <> p_amount then
    raise exception 'operation conflict: original request must be reused';
  end if;
  if op.completed_at is not null then return jsonb_build_object('state','done','result',op.result); end if;
  if op.lease_until > now() then return jsonb_build_object('state','busy'); end if;
  if p_kind = 'fund_agent' then
    -- Retry of a reservation does not consume the budget twice. Pending reservations
    -- never age out automatically; completed charges count for the rolling window.
    select coalesce(sum(amount_cents),0) into spent from public.money_operations
      where profile_id = p_profile and kind = 'fund_agent' and key <> p_key
        and (completed_at is null or created_at > now() - interval '24 hours');
    -- Include pre-migration agent charges so rollout cannot reset the cap.
    select spent + coalesce(sum(p.amount_cents),0) into spent from public.payments p
      join public.contracts c on c.id=p.contract_id join public.organizations o on o.id=c.organization_id
      where o.owner_id=p_profile and p.authorized_by='agent' and p.kind='charge'
        and p.status in ('authorized','captured') and p.created_at > now()-interval '24 hours'
        and not exists(select 1 from public.money_operations m where m.contract_id=c.id and m.kind='fund_agent');
    if p_amount > b.agent_per_contract_cap_cents or spent + p_amount > b.agent_daily_cap_cents then
      raise exception 'agent spend cap exceeded; owner approval required';
    end if;
  end if;
  -- Stripe may prune idempotency keys after 24h. Never recreate an unknown charge
  -- or transfer after that window. Reconciliation must resolve it first.
  if p_kind <> 'webhook' and op.attempts > 0 and op.created_at < now()-interval '23 hours' then
    return jsonb_build_object('state','review');
  end if;
  token := gen_random_uuid();
  update public.money_operations set lease_token=token, lease_until=now()+interval '5 minutes', attempts=attempts+1 where key=p_key;
  return jsonb_build_object('state','acquired','token',token);
end $$;

create or replace function public.finish_money_operation(p_key text, p_token uuid, p_result jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.money_operations set result=p_result, completed_at=now(), lease_until=null, lease_token=null, last_error=null
    where key=p_key and lease_token=p_token and completed_at is null;
  if not found then raise exception 'operation lease lost'; end if;
end $$;
create or replace function public.fail_money_operation(p_key text, p_token uuid, p_error text)
returns void language sql security invoker set search_path = '' as $$
  update public.money_operations set lease_until=null, lease_token=null, next_attempt_at=now()+interval '5 minutes', last_error=left(p_error,200)
    where key=p_key and lease_token=p_token and completed_at is null;
$$;
revoke all on function public.begin_money_operation(text,text,uuid,uuid,jsonb,integer),
  public.finish_money_operation(text,uuid,jsonb), public.fail_money_operation(text,uuid,text) from public, anon, authenticated;
grant execute on function public.begin_money_operation(text,text,uuid,uuid,jsonb,integer),
  public.finish_money_operation(text,uuid,jsonb), public.fail_money_operation(text,uuid,text) to service_role;

-- Fail migration if old data contains duplicates; investigate rather than deleting money history.
create unique index if not exists payouts_one_per_contract on public.payouts(contract_id);
alter table public.payouts add column if not exists payment_intent_id text;
alter table public.payouts add column if not exists checked_at timestamptz;
alter table public.payouts add column if not exists transferred_at timestamptz;
alter table public.payouts add column if not exists reversed_cents integer not null default 0 check (reversed_cents >= 0);
alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add constraint payouts_status_check check(status in ('pending','paid','failed','transferred','reversed'));

-- Preserve terminal state against older webhook deliveries.
create or replace function public.set_contract_payment_status(p_contract uuid, p_status text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.contracts set payment_status=p_status where id=p_contract
    and (payment_status=p_status or
      (payment_status='unfunded' and p_status in ('authorized','captured','refunded')) or
      (payment_status='authorized' and p_status in ('unfunded','captured','refunded')) or
      (payment_status in ('captured','paid_out') and p_status='refunded'));
end $$;
revoke all on function public.set_contract_payment_status(uuid,text) from public, anon, authenticated;
grant execute on function public.set_contract_payment_status(uuid,text) to service_role;

-- Rotate polling even when a provider record repeatedly fails validation.
alter table public.payments add column if not exists checked_at timestamptz;

-- Serialize polling/refund reversals per payout across overlapping cron invocations.
alter table public.payouts add column if not exists check_until timestamptz;

-- Dedicated cards belong to an owner-issued agent key. Only server writes.
create table if not exists public.agent_payment_cards (
  key_id uuid primary key references public.agent_api_keys(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('shared','dedicated')),
  setup_token uuid,
  payment_method_id text,
  card_brand text,
  card_last4 text,
  updated_at timestamptz not null default now()
);
alter table public.agent_payment_cards enable row level security;
revoke all on public.agent_payment_cards from anon, authenticated;
grant select on public.agent_payment_cards to authenticated;
grant all on public.agent_payment_cards to service_role;
drop policy if exists agent_payment_cards_owner_read on public.agent_payment_cards;
create policy agent_payment_cards_owner_read on public.agent_payment_cards for select to authenticated
using (profile_id = public.current_profile_id());
create index if not exists agent_payment_cards_profile_idx on public.agent_payment_cards(profile_id);

-- ===========================================================================
-- Production catch-up (recorded 2026-11-19)
-- ===========================================================================
-- Production ran the migrations below, in this order, before the explicit
-- grants that follow, but schema.sql never carried them. Without them a
-- project built from this file was missing 9 tables, the policy_private schema
-- and 30 functions that production has, and differed from production in about
-- 70 other definitions. Each section is the migration file of the same name.
-- Where a migration created a policy, trigger or index without a guard, the
-- copy here drops it first or adds IF NOT EXISTS so this file can be run
-- again; nothing else is changed. supabase/migrations/README.md has the
-- comparison against production's catalog.

-- --- migrations/20260927182500_bounded_marketplace_authority.sql --------
-- Existing keys retain worker capabilities, but hiring, review and payment actions
-- require explicit owner grants after this migration. No historical rows removed.
alter table public.agent_api_keys add column if not exists paused_at timestamptz;
alter table public.agent_api_keys add column if not exists organization_ids uuid[] not null default '{}';
alter table public.agent_api_keys add column if not exists allowed_actions text[] not null default array[
 'publish_agent','apply_to_opportunity','negotiate_opportunity','respond_to_negotiation','respond_to_hire_request','post_message','submit_deliverable','update_progress'];

-- A single operator cannot be both the worker and the approving organization.
create or replace function public.is_contract_org_side(contract_uuid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.contracts c where c.id=contract_uuid
  and public.is_organization_owner(c.organization_id) and not public.is_agent_owner(c.agent_id))
$$;
revoke all on function public.is_contract_org_side(uuid) from public,anon;
grant execute on function public.is_contract_org_side(uuid) to authenticated;

create or replace function public.enforce_deliverable_update_authority()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if public.current_profile_id() is null then return new; end if;
 if new.contract_id is distinct from old.contract_id or new.id is distinct from old.id or new.created_at is distinct from old.created_at then
  raise exception 'Deliverable identity is immutable' using errcode='42501'; end if;
 if old.status='approved' and to_jsonb(new)-'updated_at' is distinct from to_jsonb(old)-'updated_at' then
  raise exception 'Approved work is immutable' using errcode='42501'; end if;
 if old.status <> 'draft' and (new.title is distinct from old.title or new.notes is distinct from old.notes or new.gate is distinct from old.gate) then
  raise exception 'Only draft work can be edited' using errcode='42501'; end if;
 if new.decisions is distinct from old.decisions then
  if old.status<>'submitted' or new.status not in ('approved','draft') or new.status=old.status then raise exception 'Decisions require a submitted work transition' using errcode='42501'; end if;
  if jsonb_typeof(new.decisions)<>'array' or jsonb_array_length(new.decisions)<>jsonb_array_length(old.decisions)+1
   or exists(select 1 from jsonb_array_elements(old.decisions) with ordinality x(value,n) where new.decisions->((n-1)::int) is distinct from value) then
   raise exception 'Decision history is append-only' using errcode='42501'; end if;
 end if;
 if new.status is distinct from old.status and not ((old.status='draft' and new.status='submitted') or (old.status='submitted' and new.status in ('approved','draft'))) then
  raise exception 'Invalid deliverable transition' using errcode='42501'; end if;
 if (old.status='submitted' and new.status in ('approved','draft')) or new.approved_at is distinct from old.approved_at or new.decisions is distinct from old.decisions then
  if not public.is_contract_org_side(old.contract_id) then raise exception 'Only an independent organization reviewer can decide work' using errcode='42501'; end if;
 end if;
 return new;
end $$;
revoke all on function public.enforce_deliverable_update_authority() from public,anon,authenticated;

-- A review is evidence of approved work, not a self-asserted listing attribute.
drop policy if exists reviews_organization_insert on public.reviews;
create policy reviews_organization_insert on public.reviews for insert to authenticated with check (
 reviewer_id=public.current_profile_id() and public.is_contract_org_side(contract_id)
 and exists(select 1 from public.contracts c where c.id=reviews.contract_id and c.agent_id=reviews.agent_id)
 and exists(select 1 from public.contract_deliverables d where d.contract_id=reviews.contract_id)
 and not exists(select 1 from public.contract_deliverables d where d.contract_id=reviews.contract_id and d.status<>'approved')
);

-- Contract creation and application acceptance commit together, including browser writes.
create or replace function public.accept_contract_application() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype;
begin
 if new.source_type='application' then
  select * into a from public.applications where id=new.source_id for update;
  if not found or a.agent_id is distinct from new.agent_id or a.status not in ('pending','accepted') then
   raise exception 'Application is not eligible for a contract' using errcode='42501'; end if;
  update public.applications set status='accepted' where id=a.id;
 end if;
 return new;
end $$;
revoke all on function public.accept_contract_application() from public,anon,authenticated;
drop trigger if exists contracts_accept_application on public.contracts;
create trigger contracts_accept_application after insert on public.contracts for each row execute function public.accept_contract_application();

-- Lock the contract before changing delivery evidence, so concurrent decisions
-- serialize and the derived summary observes the previous decision's commit.
create or replace function public.lock_delivery_contract() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.contracts%rowtype;
begin
 select * into c from public.contracts where id=new.contract_id for update;
 if public.current_profile_id() is not null then
  if c.status in ('Paused','Disputed','Cancelled') or exists(select 1 from public.disputes where contract_id=c.id and status<>'Resolved') then
   raise exception 'Resolve the contract hold before changing delivery' using errcode='42501'; end if;
  if c.amount_cents>0 and c.payment_status not in ('authorized','captured','paid_out') then
   raise exception 'Priced work requires funding authorization' using errcode='42501'; end if;
  if tg_op='INSERT' and (new.status='approved' or new.approved_at is not null or jsonb_array_length(new.decisions)>0) then
   raise exception 'New work must be submitted before independent review' using errcode='42501'; end if;
 end if;
 return new;
end $$;
revoke all on function public.lock_delivery_contract() from public,anon,authenticated;
drop trigger if exists a_lock_delivery_contract on public.contract_deliverables;
create trigger a_lock_delivery_contract before insert or update on public.contract_deliverables for each row execute function public.lock_delivery_contract();
create or replace function public.summarize_contract_delivery() returns trigger
language plpgsql security definer set search_path='' as $$
declare total integer; approved integer; submitted integer; derived_progress integer;
begin
 select count(*),count(*) filter(where status='approved'),count(*) filter(where status='submitted'),
 coalesce(round(avg(case when status='approved' then 100 when status='submitted' then 50 else 0 end)),0)
 into total,approved,submitted,derived_progress from public.contract_deliverables where contract_id=new.contract_id;
 update public.contracts set status=case when total>0 and total=approved then 'Completed' when submitted>0 then 'In Review' else 'Active' end,
 progress=derived_progress where id=new.contract_id and status not in ('Paused','Disputed','Cancelled');
 return new;
end $$;
revoke all on function public.summarize_contract_delivery() from public,anon,authenticated;
drop trigger if exists delivery_summary on public.contract_deliverables;
create trigger delivery_summary after insert or update on public.contract_deliverables for each row execute function public.summarize_contract_delivery();

-- Evidence has no cascading resource foreign keys: deleting a source cannot erase it.
create table if not exists public.economic_audit (
 id uuid primary key default gen_random_uuid(),
 occurred_at timestamptz not null default clock_timestamp(),
 actor_profile_id uuid,
 actor_kind text not null,
 organization_id uuid,
 resource_table text not null,
 resource_id text not null,
 action text not null,
 authority jsonb not null default '{}'::jsonb,
 previous_state jsonb,
 next_state jsonb,
 provider_ref text
);
alter table public.economic_audit enable row level security;
revoke all on public.economic_audit from public,anon,authenticated,service_role;
grant select,insert on public.economic_audit to service_role;
create index if not exists economic_audit_resource on public.economic_audit(resource_table,resource_id,occurred_at);
create or replace function public.prevent_audit_rewrite() returns trigger
language plpgsql set search_path='' as $$ begin raise exception 'Economic audit is append-only' using errcode='42501'; end $$;
revoke all on function public.prevent_audit_rewrite() from public,anon,authenticated;
drop trigger if exists economic_audit_immutable on public.economic_audit;
create trigger economic_audit_immutable before update or delete on public.economic_audit for each row execute function public.prevent_audit_rewrite();
create or replace function public.record_economic_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare before_row jsonb; after_row jsonb; r jsonb; org uuid; cid uuid;
begin
 if tg_op<>'INSERT' then before_row=to_jsonb(old); end if;
 if tg_op<>'DELETE' then after_row=to_jsonb(new); end if;
 r=coalesce(after_row,before_row);
 -- Store contractual evidence but never card details, key hashes, tokens or raw provider payloads.
 before_row=before_row-'metadata'-'key_hash'-'key_prefix'-'setup_token'-'payment_method_id';
 after_row=after_row-'metadata'-'key_hash'-'key_prefix'-'setup_token'-'payment_method_id';
 if tg_table_name='organizations' then org=(r->>'id')::uuid;
 elsif r ? 'organization_id' then org=(r->>'organization_id')::uuid;
 elsif r ? 'contract_id' then
  cid=(r->>'contract_id')::uuid;
  select organization_id into org from public.contracts where id=cid;
 elsif r ? 'opportunity_id' then
  select organization_id into org from public.opportunities where id=(r->>'opportunity_id')::uuid;
 end if;
 insert into public.economic_audit(actor_profile_id,actor_kind,organization_id,resource_table,resource_id,action,authority,previous_state,next_state,provider_ref)
 values(public.current_profile_id(),case when public.current_profile_id() is null then 'platform' else 'operator_session' end,org,tg_table_name,coalesce(r->>'id',r->>'key',r->>'profile_id'),tg_op,
 jsonb_build_object('boundary','RLS and database triggers'),before_row,after_row,coalesce(r->>'provider_ref',r->>'payment_intent_id'));
 return coalesce(new,old);
end $$;
revoke all on function public.record_economic_change() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['opportunities','applications','negotiations','hire_requests','contracts','contract_deliverables','disputes','reviews','payments','payouts','agent_api_keys','billing_accounts'] loop
  execute format('drop trigger if exists economic_evidence on public.%I',t);
  execute format('create trigger economic_evidence after insert or update or delete on public.%I for each row execute function public.record_economic_change()',t);
 end loop;
end $$;

-- Completed means approved work, never merely a caller-supplied progress label.
create or replace function public.guard_contract_completion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if public.current_profile_id() is null then return new; end if;
 if (new.status='Completed' or new.progress=100) and
 (not exists(select 1 from public.contract_deliverables where contract_id=new.id)
  or exists(select 1 from public.contract_deliverables where contract_id=new.id and status<>'approved')) then
  raise exception 'Completion requires all deliverables approved' using errcode='42501'; end if;
 if old.status in ('Paused','Disputed','Cancelled') and new.status is distinct from old.status and not public.is_contract_org_side(old.id) then
  raise exception 'Only the organization may resume this contract' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.guard_contract_completion() from public,anon,authenticated;
drop trigger if exists contract_completion_guard on public.contracts;
create trigger contract_completion_guard before update on public.contracts for each row execute function public.guard_contract_completion();

-- A participant cannot impersonate the opposite party in the contract thread.
create or replace function public.attribute_contract_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.contracts%rowtype;
begin
 if public.current_profile_id() is null then return new; end if;
 select * into c from public.contracts where id=new.contract_id;
 if public.is_agent_owner(c.agent_id) then new.sender_type='Agent';new.author=c.agent_name;
 elsif public.is_organization_owner(c.organization_id) then new.sender_type='Organization';new.author=c.organization_name;
 else raise exception 'Contract participant required' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.attribute_contract_message() from public,anon,authenticated;
drop trigger if exists contract_message_attribution on public.contract_messages;
create trigger contract_message_attribution before insert on public.contract_messages for each row execute function public.attribute_contract_message();

-- --- migrations/20260927182521_transactional_marketplace_operations.sql ---
-- Acceptance and its contract are one transaction for every authenticated path.
create or replace function public.materialize_accepted_source() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if public.current_profile_id() is null then return new; end if;
 if tg_table_name='hire_requests' then perform public.materialize_hire_request_contract(new.id);
 else perform public.materialize_negotiation_contract(new.id); end if;
 return new;
end $$;
revoke all on function public.materialize_accepted_source() from public,anon,authenticated;
drop trigger if exists accepted_hire_contract on public.hire_requests;
create trigger accepted_hire_contract after update on public.hire_requests for each row
 when (new.status='accepted' and old.status is distinct from new.status) execute function public.materialize_accepted_source();
drop trigger if exists accepted_negotiation_contract on public.negotiations;
create trigger accepted_negotiation_contract after update on public.negotiations for each row
 when (new.status='accepted' and old.status is distinct from new.status) execute function public.materialize_accepted_source();

-- Server-issued short-lived execution context. Agents never receive the nonce or JWT.
create table if not exists public.agent_executions (
 id uuid primary key,
 token_hash text not null unique,
 profile_id uuid not null references public.profiles(id),
 key_id uuid references public.agent_api_keys(id),
 action text not null,
 read_only boolean not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table public.agent_executions enable row level security;
revoke all on public.agent_executions from public,anon,authenticated,service_role;
grant select,insert on public.agent_executions to service_role;
alter table public.economic_audit add column if not exists execution_id uuid;

create or replace function public.current_agent_execution() returns public.agent_executions
language plpgsql security definer set search_path='' as $$
declare token text; e public.agent_executions%rowtype; k public.agent_api_keys%rowtype;
begin
 token=nullif(coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb)->>'x-agent-execution','');
 if token is null then return null; end if;
 select * into e from public.agent_executions where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 if not found or e.expires_at<=clock_timestamp() or e.profile_id is distinct from public.current_profile_id() then
  raise exception 'Invalid or expired agent execution' using errcode='42501'; end if;
 if e.key_id is not null then
  -- Owner pause/revoke and an agent's database mutation have an ordered boundary.
  select * into k from public.agent_api_keys where id=e.key_id for share;
  if not found or k.profile_id<>e.profile_id or k.paused_at is not null or k.revoked_at is not null
   or (not e.read_only and not e.action=any(k.allowed_actions)) then
   raise exception 'Agent execution authority is no longer valid' using errcode='42501'; end if;
 end if;
 return e;
end $$;
revoke all on function public.current_agent_execution() from public,anon,authenticated;

create or replace function public.agent_organization_allowed(org uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare e public.agent_executions%rowtype; permitted boolean;
begin
 e=public.current_agent_execution();
 if e.id is null then return true; end if;
 if e.key_id is null then return false; end if;
 select org=any(organization_ids) into permitted from public.agent_api_keys where id=e.key_id;
 return coalesce(permitted,false);
end $$;
revoke all on function public.agent_organization_allowed(uuid) from public,anon;
grant execute on function public.agent_organization_allowed(uuid) to authenticated;
create or replace function public.is_organization_owner(organization_uuid uuid) returns boolean
language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.organizations where id=organization_uuid and owner_id=public.current_profile_id())
 and public.agent_organization_allowed(organization_uuid)
$$;
revoke all on function public.is_organization_owner(uuid) from public,anon;
grant execute on function public.is_organization_owner(uuid) to authenticated;

-- Attach exact execution provenance to each row audit in its own transaction.
create or replace function public.attribute_economic_execution() returns trigger
language plpgsql security definer set search_path='' as $$
declare e public.agent_executions%rowtype;
begin
 e=public.current_agent_execution();
 if e.id is not null then
  if e.read_only then raise exception 'Read-only execution cannot mutate data' using errcode='42501'; end if;
  new.execution_id=e.id;
  new.actor_kind='agent';
  new.authority=new.authority || jsonb_build_object('keyId',e.key_id,'action',e.action,'executionId',e.id);
 end if;
 return new;
end $$;
revoke all on function public.attribute_economic_execution() from public,anon,authenticated;
drop trigger if exists audit_execution_attribution on public.economic_audit;
create trigger audit_execution_attribution before insert on public.economic_audit for each row execute function public.attribute_economic_execution();
do $$ declare t text; begin
 foreach t in array array['agents','contract_messages','deliverable_gate_events'] loop
  execute format('drop trigger if exists economic_evidence on public.%I',t);
  execute format('create trigger economic_evidence after insert or update or delete on public.%I for each row execute function public.record_economic_change()',t);
 end loop;
end $$;

-- Opportunity authorship must not bypass the key's organization scope.
create or replace function public.is_opportunity_org_side(opportunity_uuid uuid) returns boolean
language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.opportunities o where o.id=opportunity_uuid
 and (o.owner_id=public.current_profile_id() or public.is_organization_owner(o.organization_id))
 and public.agent_organization_allowed(o.organization_id))
$$;
revoke all on function public.is_opportunity_org_side(uuid) from public,anon;
grant execute on function public.is_opportunity_org_side(uuid) to authenticated;
drop policy if exists applications_participant_read on public.applications;
create policy applications_participant_read on public.applications for select to authenticated using (
 owner_id=public.current_profile_id() or public.is_agent_owner(agent_id) or public.is_opportunity_org_side(opportunity_id));
drop policy if exists negotiations_participant_read on public.negotiations;
create policy negotiations_participant_read on public.negotiations for select to authenticated using (
 owner_id=public.current_profile_id() or public.is_agent_owner(agent_id) or public.is_opportunity_org_side(opportunity_id));
drop policy if exists hire_requests_participant_read on public.hire_requests;
create policy hire_requests_participant_read on public.hire_requests for select to authenticated using (
 (owner_id=public.current_profile_id() and public.is_opportunity_org_side(opportunity_id)) or public.is_agent_owner(agent_id));

-- Caller tokens bind intent to one committed row, including concurrent retries.
create table if not exists public.marketplace_requests (
 profile_id uuid not null default public.current_profile_id() references public.profiles(id),
 resource_table text not null,
 request_id uuid not null,
 intent jsonb not null,
 resource_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(profile_id,resource_table,request_id)
);
alter table public.marketplace_requests enable row level security;
revoke all on public.marketplace_requests from public,anon,authenticated;
grant select,insert on public.marketplace_requests to authenticated;
drop policy if exists own_marketplace_requests on public.marketplace_requests;
create policy own_marketplace_requests on public.marketplace_requests for select to authenticated using(profile_id=public.current_profile_id());
drop policy if exists insert_marketplace_requests on public.marketplace_requests;
create policy insert_marketplace_requests on public.marketplace_requests for insert to authenticated with check(profile_id=public.current_profile_id());
create or replace function public.replay_marketplace_record(p_table text,p_request uuid,p_intent jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare receipt public.marketplace_requests%rowtype; result jsonb;
begin
 if p_table not in ('agents','opportunities','applications','negotiations','hire_requests','contract_messages','contract_deliverables') then raise exception 'Unsupported creation resource'; end if;
 select * into receipt from public.marketplace_requests where profile_id=public.current_profile_id() and resource_table=p_table and request_id=p_request;
 if not found then return null; end if;
 if receipt.intent is distinct from p_intent then raise exception 'Request ID reused with different intent' using errcode='22023'; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1',p_table) into result using receipt.resource_id;
 if result is null then raise exception 'Original resource is no longer accessible' using errcode='42501'; end if;
 return result;
end $$;
create or replace function public.create_marketplace_record(p_table text,p_request uuid,p_intent jsonb,p_row jsonb,p_revision uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; columns_sql text; values_sql text;
begin
 if public.current_profile_id() is null or p_request is null then raise exception 'Authenticated caller and request ID required'; end if;
 if p_table not in ('agents','opportunities','applications','negotiations','hire_requests','contract_messages','contract_deliverables') then raise exception 'Unsupported creation resource'; end if;
 perform pg_advisory_xact_lock(hashtextextended(public.current_profile_id()::text||':'||p_table||':'||p_request::text,0));
 result=public.replay_marketplace_record(p_table,p_request,p_intent);
 if result is not null then return result; end if;
 if jsonb_typeof(p_row)<>'object' or p_row='{}'::jsonb then raise exception 'Record required'; end if;
 select string_agg(format('%I',k),',' order by k),string_agg(format('r.%I',k),',' order by k) into columns_sql,values_sql from jsonb_object_keys(p_row) k;
 if p_revision is null then
  execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r returning to_jsonb(%I.*)',p_table,columns_sql,values_sql,p_table,p_table) into result using p_row;
 else
  if p_table<>'contract_deliverables' then raise exception 'Only draft deliveries can be revised'; end if;
  execute format('update public.contract_deliverables set (%s)=(select %s from jsonb_populate_record(null::public.contract_deliverables,$1) r) where id=$2 and status=''draft'' returning to_jsonb(contract_deliverables.*)',columns_sql,values_sql) into result using p_row,p_revision;
 end if;
 if result is null then raise exception 'Creation or revision was not authorized' using errcode='42501'; end if;
 insert into public.marketplace_requests(resource_table,request_id,intent,resource_id) values(p_table,p_request,p_intent,(result->>'id')::uuid);
 return result;
end $$;
revoke all on function public.replay_marketplace_record(text,uuid,jsonb),public.create_marketplace_record(text,uuid,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.replay_marketplace_record(text,uuid,jsonb),public.create_marketplace_record(text,uuid,jsonb,jsonb,uuid) to authenticated;

create or replace function public.begin_money_operation(
  p_key text, p_kind text, p_profile uuid, p_contract uuid, p_request jsonb, p_amount integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare op public.money_operations%rowtype; b public.billing_accounts%rowtype; spent bigint; token uuid; c public.contracts%rowtype; k public.agent_api_keys%rowtype; e public.agent_executions%rowtype; required_action text;
begin
  -- A dispute and payment authorization serialize on the same contract row.
  if p_contract is not null then
    select * into c from public.contracts where id=p_contract for update;
    if not found then raise exception 'Contract unavailable'; end if;
  end if;
  if p_request ? 'agentKeyId' then
    required_action=case when p_kind='fund_agent' then 'fund_contract' else 'release_payment' end;
    select * into k from public.agent_api_keys where id=(p_request->>'agentKeyId')::uuid for share;
    if not found or k.profile_id is distinct from p_profile or k.paused_at is not null or k.revoked_at is not null
      or not k.can_spend or not required_action=any(k.allowed_actions) or not c.organization_id=any(k.organization_ids) then
      raise exception 'Current agent payment authority required'; end if;
    if not exists(select 1 from public.organizations where id=c.organization_id and owner_id=p_profile)
      or not exists(select 1 from public.agents where id=c.agent_id and owner_id<>p_profile) then
      raise exception 'Independent buyer and worker required'; end if;
  end if;
  if p_request ? 'executionId' then
    select * into e from public.agent_executions where id=(p_request->>'executionId')::uuid;
    if not found or e.profile_id is distinct from p_profile or e.key_id is distinct from (p_request->>'agentKeyId')::uuid
      or e.action is distinct from required_action or e.read_only then raise exception 'Payment execution provenance mismatch'; end if;
  end if;
  if p_kind = 'fund_agent' then
    select * into b from public.billing_accounts where profile_id = p_profile for update;
    if not found then raise exception 'no billing account'; end if;
  end if;
  insert into public.money_operations(key, kind, profile_id, contract_id, request, amount_cents)
    values(p_key, p_kind, p_profile, p_contract, p_request, p_amount) on conflict do nothing;
  select * into op from public.money_operations where key = p_key for update;
  if op.kind <> p_kind or op.profile_id is distinct from p_profile or op.contract_id is distinct from p_contract
     or (op.request-'executionId') <> (p_request-'executionId') or op.amount_cents <> p_amount then
    raise exception 'operation conflict: original request must be reused';
  end if;
  if op.completed_at is not null then return jsonb_build_object('state','done','result',op.result); end if;
  if op.lease_until > now() then return jsonb_build_object('state','busy'); end if;
  if p_kind in ('capture','transfer') then
    if c.status in ('Paused','Disputed','Cancelled') or exists(select 1 from public.disputes where contract_id=c.id and status is distinct from 'Resolved') then
      raise exception 'Open dispute or held contract blocks payment authorization'; end if;
    if not exists(select 1 from public.contract_deliverables where contract_id=c.id)
      or exists(select 1 from public.contract_deliverables where contract_id=c.id and status<>'approved') then
      raise exception 'Every deliverable must be approved before payment authorization'; end if;
  end if;
  if p_kind = 'fund_agent' then
    -- Retry of a reservation does not consume the budget twice. Pending reservations
    -- never age out automatically; completed charges count for the rolling window.
    select coalesce(sum(amount_cents),0) into spent from public.money_operations
      where profile_id = p_profile and kind = 'fund_agent' and key <> p_key
        and (completed_at is null or created_at > now() - interval '24 hours');
    -- Include pre-migration agent charges so rollout cannot reset the cap.
    select spent + coalesce(sum(p.amount_cents),0) into spent from public.payments p
      join public.contracts budget_contract on budget_contract.id=p.contract_id join public.organizations o on o.id=budget_contract.organization_id
      where o.owner_id=p_profile and p.authorized_by='agent' and p.kind='charge'
        and p.status in ('authorized','captured') and p.created_at > now()-interval '24 hours'
        and not exists(select 1 from public.money_operations m where m.contract_id=budget_contract.id and m.kind='fund_agent');
    if p_amount > b.agent_per_contract_cap_cents or spent + p_amount > b.agent_daily_cap_cents then
      raise exception 'agent spend cap exceeded; owner approval required';
    end if;
  end if;
  -- Stripe may prune idempotency keys after 24h. Never recreate an unknown charge
  -- or transfer after that window. Reconciliation must resolve it first.
  if p_kind <> 'webhook' and op.attempts > 0 and op.created_at < now()-interval '23 hours' then
    return jsonb_build_object('state','review');
  end if;
  token := gen_random_uuid();
  update public.money_operations set lease_token=token, lease_until=now()+interval '5 minutes', attempts=attempts+1 where key=p_key;
  if p_kind in ('fund_agent','capture','cancel','transfer') then
    insert into public.economic_audit(actor_profile_id,actor_kind,organization_id,resource_table,resource_id,action,authority,execution_id,next_state)
    values(p_profile,case when k.id is null then 'platform' else 'agent' end,c.organization_id,'money_operations',p_key,'payment_authorized',
      jsonb_build_object('keyId',k.id,'boundary','committed payment authorization'),e.id,jsonb_build_object('kind',p_kind));
  end if;
  return jsonb_build_object('state','acquired','token',token);
end $$;

-- An external provider call already authorized cannot be atomically recalled.
-- Record late disputes and revocations for reconciliation, without hiding them.
create table if not exists public.payment_review_cases (
 id uuid primary key default gen_random_uuid(),
 operation_key text not null references public.money_operations(key),
 reason text not null,
 source_id uuid not null,
 status text not null default 'open' check(status in ('open','resolved')),
 resolution_notes text,
 created_at timestamptz not null default now(),
 unique(operation_key,reason,source_id)
);
alter table public.payment_review_cases enable row level security;
revoke all on public.payment_review_cases from public,anon,authenticated;
grant select,insert,update on public.payment_review_cases to service_role;
create or replace function public.coordinate_dispute_payment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.contracts where id=new.contract_id for update;
 if new.status is distinct from 'Resolved' then
  insert into public.payment_review_cases(operation_key,reason,source_id)
   select key,'dispute_after_authorization',new.id from public.money_operations
   where contract_id=new.contract_id and kind in ('capture','transfer') and attempts>0
   on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.coordinate_dispute_payment() from public,anon,authenticated;
drop trigger if exists disputes_coordinate_payment on public.disputes;
create trigger disputes_coordinate_payment before insert or update on public.disputes for each row execute function public.coordinate_dispute_payment();
create or replace function public.coordinate_key_payment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.paused_at is not null or new.revoked_at is not null or not new.can_spend
  or new.allowed_actions is distinct from old.allowed_actions or new.organization_ids is distinct from old.organization_ids then
  insert into public.payment_review_cases(operation_key,reason,source_id)
   select key,'authority_changed_after_authorization',new.id from public.money_operations
   where request->>'agentKeyId'=new.id::text and completed_at is null and attempts>0 on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.coordinate_key_payment() from public,anon,authenticated;
drop trigger if exists key_coordinate_payment on public.agent_api_keys;
create trigger key_coordinate_payment after update on public.agent_api_keys for each row execute function public.coordinate_key_payment();

-- --- migrations/20260927182540_seller_bank_payout_observations.sql ------
-- Account-level provider observations, never inferred contract settlement.
create table if not exists public.seller_bank_payouts (
 account_id text not null,
 payout_id text not null,
 profile_id uuid not null references public.profiles(id),
 amount_cents bigint not null check(amount_cents>=0),
 currency text not null,
 status text not null check(status in ('pending','in_transit','paid','failed','canceled')),
 automatic boolean not null,
 arrival_date timestamptz,
 failure_code text,
 observed_at timestamptz not null,
 failure_reviewed_at timestamptz,
 failure_resolution_notes text,
 check(failure_reviewed_at is null or length(trim(coalesce(failure_resolution_notes,'')))>0),
 primary key(account_id,payout_id)
);
alter table public.seller_bank_payouts enable row level security;
revoke all on public.seller_bank_payouts from public,anon,authenticated;
grant select on public.seller_bank_payouts to authenticated;
grant select,insert,update on public.seller_bank_payouts to service_role;
drop policy if exists seller_bank_payout_owner on public.seller_bank_payouts;
create policy seller_bank_payout_owner on public.seller_bank_payouts for select to authenticated using(profile_id=public.current_profile_id());
alter table public.seller_accounts add column if not exists bank_checked_at timestamptz;
create or replace function public.observe_bank_payout(p_account text,p_payout text,p_amount bigint,p_currency text,p_status text,p_automatic boolean,p_arrival timestamptz,p_failure text,p_observed timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare owner_uuid uuid;
begin
 select profile_id into owner_uuid from public.seller_accounts where stripe_account_id=p_account;
 if not found then raise exception 'Unknown connected seller'; end if;
 insert into public.seller_bank_payouts(account_id,payout_id,profile_id,amount_cents,currency,status,automatic,arrival_date,failure_code,observed_at)
 values(p_account,p_payout,owner_uuid,p_amount,upper(p_currency),p_status,p_automatic,p_arrival,p_failure,p_observed)
 on conflict(account_id,payout_id) do update set amount_cents=excluded.amount_cents,currency=excluded.currency,status=excluded.status,
 automatic=excluded.automatic,arrival_date=excluded.arrival_date,failure_code=excluded.failure_code,observed_at=excluded.observed_at
 where public.seller_bank_payouts.observed_at<excluded.observed_at;
end $$;
revoke all on function public.observe_bank_payout(text,text,bigint,text,text,boolean,timestamptz,text,timestamptz) from public,anon,authenticated;
grant execute on function public.observe_bank_payout(text,text,bigint,text,text,boolean,timestamptz,text,timestamptz) to service_role;

-- --- migrations/20260927192810_account_self_deletion.sql ----------------
-- Guard Auth's cascading profile deletion in the same transaction. Never leave
-- marketplace records orphaned or silently cascade financial history.
create or replace function public.guard_account_deletion() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare ref record; found_record boolean;
begin
  for ref in
    select c.conrelid::regclass as relation, a.attname as column_name
    from pg_constraint c join pg_attribute a
      on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and c.confrelid='public.profiles'::regclass
      and cardinality(c.conkey)=1
      and c.conrelid not in ('public.saved_opportunities'::regclass,'public.agent_api_keys'::regclass)
  loop
    execute format('select exists(select 1 from %s where %I=$1)',ref.relation,ref.column_name)
      into found_record using old.id;
    if found_record then
      raise exception 'Account has retained marketplace or billing records; contact support for deletion review.';
    end if;
  end loop;
  return old;
end $$;
revoke all on function public.guard_account_deletion() from public,anon,authenticated;
drop trigger if exists account_deletion_guard on public.profiles;
create trigger account_deletion_guard before delete on public.profiles
for each row execute function public.guard_account_deletion();
-- Server preflight also ensures the guard has been deployed before Auth deletion.
create or replace function public.account_deletion_ready(target uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare ref record; found_record boolean;
begin
  if not exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='account_deletion_guard' and tgenabled='O') then return false; end if;
  for ref in
    select c.conrelid::regclass as relation, a.attname as column_name
    from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and c.confrelid='public.profiles'::regclass and cardinality(c.conkey)=1
      and c.conrelid not in ('public.saved_opportunities'::regclass,'public.agent_api_keys'::regclass)
  loop
    execute format('select exists(select 1 from %s where %I=$1)',ref.relation,ref.column_name) into found_record using target;
    if found_record then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function public.account_deletion_ready(uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_ready(uuid) to service_role;

-- --- migrations/20260927205255_agent_readonly_authority.sql -------------
-- PostgREST GET uses read-only transactions. Writes retain the revocation lock.
create or replace function public.current_agent_execution() returns public.agent_executions
language plpgsql security definer set search_path='' as $$
declare token text; e public.agent_executions%rowtype; k public.agent_api_keys%rowtype;
begin
 token=nullif(coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb)->>'x-agent-execution','');
 if token is null then return null; end if;
 select * into e from public.agent_executions where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 if not found or e.expires_at<=clock_timestamp() or e.profile_id is distinct from public.current_profile_id() then
  raise exception 'Invalid or expired agent execution' using errcode='42501'; end if;
 if e.key_id is not null then
  -- Owner pause/revoke and an agent's database mutation have an ordered boundary.
  if current_setting('transaction_read_only') = 'on' then
   select * into k from public.agent_api_keys where id=e.key_id;
  else
   select * into k from public.agent_api_keys where id=e.key_id for share;
  end if;
  if not found or k.profile_id<>e.profile_id or k.paused_at is not null or k.revoked_at is not null
   or (not e.read_only and not e.action=any(k.allowed_actions)) then
   raise exception 'Agent execution authority is no longer valid' using errcode='42501'; end if;
 end if;
 return e;
end $$;
revoke all on function public.current_agent_execution() from public,anon,authenticated;

-- --- migrations/20260929040621_policy_acceptance.sql --------------------
-- Server-written evidence only. User-editable auth metadata is never evidence.
create table if not exists public.policy_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null,
  policy_digest text not null check (policy_digest ~ '^[a-f0-9]{64}$'),
  policy_snapshot jsonb not null,
  adult boolean not null check (adult),
  agreed boolean not null check (agreed),
  authority boolean not null check (authority),
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_version, policy_digest)
);
alter table public.policy_acceptances enable row level security;
revoke all on public.policy_acceptances from public, anon, authenticated, service_role;
grant select, insert on public.policy_acceptances to service_role;
grant select on public.policy_acceptances to authenticated;
drop policy if exists policy_acceptance_owner_read on public.policy_acceptances;
create policy policy_acceptance_owner_read on public.policy_acceptances for select to authenticated
  using (user_id = (select auth.uid()));
-- No direct update/delete grants. Account deletion cascades remove this personal data.

-- --- migrations/20260929041133_policy_enforcement.sql -------------------
-- Inactive until the reviewed application release and DB configuration agree.
create schema if not exists policy_private;
revoke all on schema policy_private from public, anon, authenticated;
create table if not exists policy_private.requirement (
 singleton boolean primary key default true check (singleton),
 active boolean not null default false,
 version text,
 digest text,
 check (not active or (version is not null and digest ~ '^[a-f0-9]{64}$'))
);
insert into policy_private.requirement(singleton) values(true) on conflict do nothing;
revoke all on policy_private.requirement from public, anon, authenticated, service_role;

create or replace function public.current_policy_accepted(expected_version text, expected_digest text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare r policy_private.requirement;
begin
 select * into r from policy_private.requirement where singleton;
 if not found or auth.uid() is null then return false; end if;
 if not r.active or r.version is distinct from expected_version or r.digest is distinct from expected_digest then return false; end if;
 return exists(select 1 from public.policy_acceptances a where a.user_id=auth.uid() and a.policy_version=r.version and a.policy_digest=r.digest);
end $$;
revoke all on function public.current_policy_accepted(text,text) from public,anon;
grant execute on function public.current_policy_accepted(text,text) to authenticated;

create or replace function policy_private.guard_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r policy_private.requirement;
begin
 -- Trusted provider reconciliation and account-deletion cascades retain their existing permissions.
 if auth.uid() is null then
   if tg_op='DELETE' then return old; end if; return new;
 end if;
 select * into r from policy_private.requirement where singleton;
 if not found then raise exception 'Policy configuration unavailable' using errcode='42501'; end if;
 if not r.active then
   if tg_op='DELETE' then return old; end if; return new;
 end if;
 -- Revocation/pause must remain possible without accepting changed terms.
 if tg_table_name='agent_api_keys' and tg_op='UPDATE' then
   if (to_jsonb(new)-'revoked_at'-'paused_at')=(to_jsonb(old)-'revoked_at'-'paused_at')
      and (new.revoked_at is not null or new.paused_at is not null)
      and (old.revoked_at is null or new.revoked_at=old.revoked_at)
      and (old.paused_at is null or new.paused_at=old.paused_at) then return new; end if;
 end if;
 if not exists(select 1 from public.policy_acceptances a where a.user_id=auth.uid() and a.policy_version=r.version and a.policy_digest=r.digest) then
   raise exception 'Human operator policy acceptance required' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function policy_private.guard_write() from public,anon,authenticated;
-- Profiles remain available for signup; disputes, read access, deletion and provider ledgers are not gated.
do $$ declare t text; begin
 foreach t in array array['organizations','agents','opportunities','applications','negotiations','hire_requests','saved_opportunities','contracts','contract_milestones','contract_deliverables','contract_messages','reviews','agent_api_keys','billing_accounts','agent_payment_cards'] loop
  execute format('drop trigger if exists policy_acceptance_write on public.%I',t);
  execute format('create trigger policy_acceptance_write before insert or update or delete on public.%I for each row execute function policy_private.guard_write()',t);
 end loop;
end $$;

-- --- migrations/20260929041632_contract_policy_evidence.sql -------------
-- Prospective evidence only. No backfill or implied acceptance for older contracts.
alter table public.contracts add column if not exists policy_evidence jsonb;
create or replace function policy_private.record_contract_policy()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
 r policy_private.requirement;
 buyer uuid;
 seller uuid;
 buyer_acceptance public.policy_acceptances;
 seller_acceptance public.policy_acceptances;
begin
 if tg_op='UPDATE' then
   if new.policy_evidence is distinct from old.policy_evidence then
     raise exception 'Contract policy evidence is immutable' using errcode='42501';
   end if;
   if old.policy_evidence is not null and
      (new.organization_id is distinct from old.organization_id or new.agent_id is distinct from old.agent_id) then
     raise exception 'Accepted contract parties cannot be replaced' using errcode='42501';
   end if;
   return new;
 end if;
 -- Never trust evidence provided by a browser, agent, or service caller.
 new.policy_evidence := null;
 select * into r from policy_private.requirement where singleton for share;
 if not found then raise exception 'Policy configuration unavailable' using errcode='42501'; end if;
 if not r.active then return new; end if;
 select p.user_id into buyer from public.organizations o join public.profiles p on p.id=o.owner_id where o.id=new.organization_id;
 select p.user_id into seller from public.agents a join public.profiles p on p.id=a.owner_id where a.id=new.agent_id;
 if buyer is null or seller is null then raise exception 'Both contract operators are required' using errcode='42501'; end if;
 select * into buyer_acceptance from public.policy_acceptances where user_id=buyer and policy_version=r.version and policy_digest=r.digest;
 if not found then raise exception 'Buyer operator must accept current policies' using errcode='42501'; end if;
 select * into seller_acceptance from public.policy_acceptances where user_id=seller and policy_version=r.version and policy_digest=r.digest;
 if not found then raise exception 'Seller operator must accept current policies' using errcode='42501'; end if;
 if buyer_acceptance.policy_snapshot is distinct from seller_acceptance.policy_snapshot then
   raise exception 'Policy evidence mismatch' using errcode='42501';
 end if;
 new.policy_evidence := jsonb_build_object(
   'version',r.version,'digest',r.digest,'documents',buyer_acceptance.policy_snapshot,
   'buyer_user_id',buyer,'buyer_accepted_at',buyer_acceptance.accepted_at,
   'seller_user_id',seller,'seller_accepted_at',seller_acceptance.accepted_at,
   'recorded_at',statement_timestamp(),
   'scope','Operator policy acceptance at contract creation; not a signature on negotiated exceptions');
 return new;
end $$;
revoke all on function policy_private.record_contract_policy() from public,anon,authenticated;
drop trigger if exists contract_policy_evidence on public.contracts;
create trigger contract_policy_evidence before insert or update on public.contracts
for each row execute function policy_private.record_contract_policy();

-- --- migrations/20261011021649_native_safety_and_deletion_requests.sql ---
alter table public.agents add column if not exists moderation_status text not null default 'pending' check(moderation_status in ('pending','approved','rejected'));
-- Private, authenticated request queues. No client can resolve a request or read another user's report.
create table if not exists public.account_deletion_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 status text not null default 'requested' check(status in ('requested','processing','completed')),
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 response text not null default 'Your deletion request has been received. We will complete it within 30 days unless specific records must be retained by law. Updates appear here.'
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public,anon,authenticated;
grant select on public.account_deletion_requests to authenticated;
grant select,insert,update,delete on public.account_deletion_requests to service_role;
drop policy if exists deletion_request_owner_read on public.account_deletion_requests;
create policy deletion_request_owner_read on public.account_deletion_requests for select to authenticated using(user_id=(select auth.uid()));

create table if not exists public.content_reports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 content_kind text not null check(content_kind in ('agent','contract','message','deliverable')),
 content_id uuid not null,
 reason text not null check(reason in ('abuse','sexual','violence','fraud','other')),
 details text not null default '' check(char_length(details)<=2000),
 status text not null default 'received' check(status in ('received','reviewing','resolved')),
 response text not null default 'Report received. We review abuse reports within 24 hours and post updates here.',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.content_reports enable row level security;
revoke all on public.content_reports from public,anon,authenticated;
grant select on public.content_reports to authenticated;
grant select,insert,update,delete on public.content_reports to service_role;
drop policy if exists report_owner_read on public.content_reports;
create policy report_owner_read on public.content_reports for select to authenticated using(user_id=(select auth.uid()));
create index if not exists content_reports_queue on public.content_reports(status,created_at);
create index if not exists content_reports_owner on public.content_reports(user_id,created_at);

create table if not exists public.blocked_operators (
 user_id uuid not null references auth.users(id) on delete cascade,
 target_user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,target_user_id),
 check(user_id<>target_user_id)
);
alter table public.blocked_operators enable row level security;
revoke all on public.blocked_operators from public,anon,authenticated;
grant select,delete on public.blocked_operators to authenticated;
grant all on public.blocked_operators to service_role;
drop policy if exists block_owner_read on public.blocked_operators;
create policy block_owner_read on public.blocked_operators for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists block_owner_remove on public.blocked_operators;
create policy block_owner_remove on public.blocked_operators for delete to authenticated using(user_id=(select auth.uid()));
create index if not exists blocked_operators_target on public.blocked_operators(target_user_id);

create or replace function public.report_content(kind text,target uuid,report_reason text,report_details text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); cid uuid; report_id uuid;
begin
 if actor is null then raise exception 'Sign in to report content' using errcode='42501'; end if;
 if report_reason not in ('abuse','sexual','violence','fraud','other') or char_length(coalesce(report_details,''))>2000 then raise exception 'Invalid report'; end if;
 if kind='agent' then
  if not exists(select 1 from public.agents where id=target and (moderation_status='approved' or owner_id=public.current_profile_id())) then raise exception 'Content unavailable' using errcode='42501'; end if;
 elsif kind in ('contract','message','deliverable') then
  if kind='contract' then cid:=target;
  elsif kind='message' then select contract_id into cid from public.contract_messages where id=target;
  else select contract_id into cid from public.contract_deliverables where id=target; end if;
  if cid is null or not coalesce(public.can_access_contract(cid),false) then raise exception 'Content unavailable' using errcode='42501'; end if;
 else raise exception 'Invalid content type'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,719));
 -- Bound persisted report volume per signed-in user without logging IP addresses.
 if (select count(*) from public.content_reports where user_id=actor and created_at>now()-interval '1 hour')>=20 then raise exception 'Please wait before reporting again' using errcode='P0001'; end if;
 insert into public.content_reports(user_id,content_kind,content_id,reason,details)
 values(actor,kind,target,report_reason,coalesce(report_details,'')) returning id into report_id;
 return report_id;
end $$;
revoke all on function public.report_content(text,uuid,text,text) from public,anon;
grant execute on function public.report_content(text,uuid,text,text) to authenticated;

create or replace function public.block_agent_operator(target_agent uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target_user uuid;
begin
 if actor is null then raise exception 'Sign in to block an operator' using errcode='42501'; end if;
 select p.user_id into target_user from public.agents a join public.profiles p on p.id=a.owner_id where a.id=target_agent;
 if target_user is null or target_user=actor then raise exception 'This operator cannot be blocked' using errcode='42501'; end if;
 insert into public.blocked_operators(user_id,target_user_id) values(actor,target_user) on conflict do nothing;
end $$;
revoke all on function public.block_agent_operator(uuid) from public,anon;
grant execute on function public.block_agent_operator(uuid) to authenticated;

create or replace function public.operator_blocked(profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.blocked_operators b join public.profiles p on p.user_id=b.target_user_id where b.user_id=auth.uid() and p.id=profile)
$$;
revoke all on function public.operator_blocked(uuid) from public,anon;
grant execute on function public.operator_blocked(uuid) to authenticated;
drop policy if exists agents_respect_blocks on public.agents;
create policy agents_respect_blocks on public.agents as restrictive for select to authenticated using(not public.operator_blocked(owner_id));

-- New/edited public profiles are held for a human review before public display.
-- Existing profiles also require an explicit review; no content is automatically certified.

create or replace function public.guard_agent_moderation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return new; end if;
 if tg_op='INSERT' then new.moderation_status:='pending';
 elsif new.moderation_status is distinct from old.moderation_status then raise exception 'Moderation status is managed by the review team' using errcode='42501';
 elsif (new.name,new.specialty,new.description,new.skills,new.tool_access,new.availability,new.verification_status,new.starting_rate,new.revenue,new.success_rate) is distinct from (old.name,old.specialty,old.description,old.skills,old.tool_access,old.availability,old.verification_status,old.starting_rate,old.revenue,old.success_rate) then new.moderation_status:='pending'; end if;
 return new;
end $$;
revoke all on function public.guard_agent_moderation() from public,anon,authenticated;
drop trigger if exists agent_moderation_guard on public.agents;
create trigger agent_moderation_guard before insert or update on public.agents for each row execute function public.guard_agent_moderation();
drop policy if exists agents_public_moderation on public.agents;
create policy agents_public_moderation on public.agents as restrictive for select to anon using(moderation_status='approved');
drop policy if exists agents_member_moderation on public.agents;
create policy agents_member_moderation on public.agents as restrictive for select to authenticated using(moderation_status='approved' or owner_id=public.current_profile_id());

-- A block stops new contact in both directions, including direct REST/MCP writes.
create or replace function public.guard_blocked_contact() returns trigger
language plpgsql security definer set search_path='' as $$
declare buyer uuid; seller uuid; org uuid; agent uuid;
begin
 if auth.uid() is null then return new; end if;
 if tg_table_name='contracts' then org:=new.organization_id; agent:=new.agent_id;
 elsif tg_table_name in ('applications','negotiations') then
  select p.user_id into buyer from public.opportunities o join public.profiles p on p.id=o.owner_id where o.id=new.opportunity_id;
  agent:=new.agent_id;
 elsif tg_table_name='hire_requests' then
  select user_id into buyer from public.profiles where id=new.owner_id;
  agent:=new.agent_id;
 else select organization_id,agent_id into org,agent from public.contracts where id=new.contract_id; end if;
 if org is not null then select p.user_id into buyer from public.organizations o join public.profiles p on p.id=o.owner_id where o.id=org; end if;
 select p.user_id into seller from public.agents a join public.profiles p on p.id=a.owner_id where a.id=agent;
 if exists(select 1 from public.blocked_operators where (user_id=buyer and target_user_id=seller) or (user_id=seller and target_user_id=buyer)) then
  raise exception 'Contact is blocked between these operators' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function public.guard_blocked_contact() from public,anon,authenticated;
drop trigger if exists block_new_contract on public.contracts;
create trigger block_new_contract before insert on public.contracts for each row execute function public.guard_blocked_contact();
drop trigger if exists block_new_message on public.contract_messages;
create trigger block_new_message before insert on public.contract_messages for each row execute function public.guard_blocked_contact();
drop trigger if exists block_new_deliverable on public.contract_deliverables;
create trigger block_new_deliverable before insert on public.contract_deliverables for each row execute function public.guard_blocked_contact();

drop trigger if exists block_new_application on public.applications;
create trigger block_new_application before insert or update on public.applications for each row execute function public.guard_blocked_contact();
drop trigger if exists block_new_negotiation on public.negotiations;
create trigger block_new_negotiation before insert or update on public.negotiations for each row execute function public.guard_blocked_contact();
drop trigger if exists block_new_hire_request on public.hire_requests;
create trigger block_new_hire_request before insert or update on public.hire_requests for each row execute function public.guard_blocked_contact();

create or replace function public.block_contract_operator(target_contract uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); buyer uuid; seller uuid; target_user uuid;
begin
 if actor is null or not coalesce(public.can_access_contract(target_contract),false) then raise exception 'Contract unavailable' using errcode='42501'; end if;
 select bp.user_id,sp.user_id into buyer,seller from public.contracts c
 left join public.organizations o on o.id=c.organization_id left join public.profiles bp on bp.id=o.owner_id
 left join public.agents a on a.id=c.agent_id left join public.profiles sp on sp.id=a.owner_id where c.id=target_contract;
 if actor=buyer then target_user:=seller; elsif actor=seller then target_user:=buyer; end if;
 if target_user is null or target_user=actor then raise exception 'Operator unavailable' using errcode='42501'; end if;
 insert into public.blocked_operators(user_id,target_user_id) values(actor,target_user) on conflict do nothing;
end $$;
revoke all on function public.block_contract_operator(uuid) from public,anon;
grant execute on function public.block_contract_operator(uuid) to authenticated;

-- --- migrations/20261015002429_disputes_owner_and_metadata.sql ----------
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

-- --- migrations/20261015014913_payment_provider_mode.sql ----------------
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

-- --- migrations/20261015040104_managed_services.sql ---------------------
-- Managed services: agents that work inside the buyer's own accounts (paid ads,
-- SEO, social, email) for a number of weeks, paid one week at a time.
-- See docs/MANAGED_SERVICES.md.
--
-- 1. A brief can be a managed service. It names the kind of work, the platforms
--    the buyer will share access to, an optional weekly ad-spend cap (spend the
--    buyer pays the platform directly, never through AgentExchange) and how many
--    weeks the service runs.
-- 2. Each contract freezes those terms in contracts.service_terms when it is
--    created, so editing the brief later cannot change an agreed contract.
-- 3. A managed-service contract is born with its checklist: access shared on
--    each platform, plan approved, launched, and the week's report. Only the
--    organization can tick milestones off (enforce_milestone_authority).
-- 4. Week N+1 is a new contract with source_type 'renewal' and source_id the
--    week-N contract. It copies the price and terms, and is allowed only between
--    the same two parties, while week N is funded or paid, and only up to the
--    number of weeks the agent agreed to. uq_contracts_source allows one renewal
--    per contract.
--
-- Additive: new nullable columns, functions and triggers. Apply before deploying
-- the code that reads these columns.

alter table public.opportunities
  add column if not exists work_type text not null default 'deliverable',
  add column if not exists service_kind text,
  add column if not exists service_platforms text[] not null default '{}',
  add column if not exists ad_spend_cap_cents integer,
  add column if not exists service_weeks integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'opportunities_managed_service_terms') then
    alter table public.opportunities
      add constraint opportunities_managed_service_terms check (
        work_type in ('deliverable', 'managed_service')
        and (service_kind is null or service_kind in ('paid_ads', 'seo', 'social', 'email', 'other'))
        and cardinality(service_platforms) <= 8
        and char_length(array_to_string(service_platforms, '|')) <= 400
        and (ad_spend_cap_cents is null or ad_spend_cap_cents between 0 and 100000000)
        and (service_weeks is null or service_weeks between 1 and 52)
        and (work_type <> 'managed_service' or (service_kind is not null and service_weeks is not null))
      );
  end if;
end $$;

alter table public.contracts add column if not exists service_terms jsonb;

-- The brief a contract source belongs to. Internal: used by the triggers below.
create or replace function public.contract_source_opportunity(source_type_in text, source_id_in uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case source_type_in
    when 'application' then (select opportunity_id from public.applications where id = source_id_in)
    when 'negotiation' then (select opportunity_id from public.negotiations where id = source_id_in)
    when 'hire-request' then (select opportunity_id from public.hire_requests where id = source_id_in)
    else null
  end
$$;

revoke all on function public.contract_source_opportunity(text, uuid) from public, anon, authenticated;

-- Freeze service terms at creation; copy price and terms for a renewal.
create or replace function public.apply_contract_service_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prev public.contracts%rowtype;
  opp public.opportunities%rowtype;
  next_week integer;
begin
  if tg_op = 'UPDATE' then
    if new.service_terms is distinct from old.service_terms and public.current_profile_id() is not null then
      raise exception 'contracts: service terms are fixed when the contract is created'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.source_type = 'renewal' then
    select * into prev from public.contracts where id = new.source_id;
    if not found or prev.service_terms is null then
      raise exception 'contracts: only a managed-service contract can be renewed'
        using errcode = '42501';
    end if;
    next_week := coalesce((prev.service_terms->>'week')::integer, 1) + 1;
    new.amount_cents := prev.amount_cents;
    new.currency := prev.currency;
    new.title := regexp_replace(prev.title, ' · week [0-9]+$', '') || ' · week ' || next_week;
    new.service_terms := prev.service_terms || jsonb_build_object('week', next_week, 'renewedFrom', prev.id);
    return new;
  end if;

  -- Never trust terms supplied by a browser or agent: derive them from the brief.
  new.service_terms := null;
  select o.* into opp
    from public.opportunities o
   where o.id = public.contract_source_opportunity(new.source_type, new.source_id);
  if found and opp.work_type = 'managed_service' then
    new.service_terms := jsonb_build_object(
      'kind', opp.service_kind,
      'platforms', to_jsonb(opp.service_platforms),
      'adSpendCapCents', opp.ad_spend_cap_cents,
      'weeks', opp.service_weeks,
      'week', 1,
      'opportunityId', opp.id
    );
  end if;
  return new;
end;
$$;

revoke all on function public.apply_contract_service_terms() from public, anon, authenticated;

drop trigger if exists contracts_apply_service_terms on public.contracts;
create trigger contracts_apply_service_terms
  before insert or update on public.contracts
  for each row execute function public.apply_contract_service_terms();

-- A managed-service contract starts with its checklist.
create or replace function public.seed_service_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
  week integer;
  weeks integer;
  cap integer;
  cap_text text := '';
  platform text;
  plan_scope text;
  launch_title text;
  launch_notes text;
begin
  if new.service_terms is null then
    return new;
  end if;

  kind := coalesce(new.service_terms->>'kind', 'other');
  week := coalesce((new.service_terms->>'week')::integer, 1);
  weeks := coalesce((new.service_terms->>'weeks')::integer, week);
  cap := (new.service_terms->>'adSpendCapCents')::integer;
  if cap is not null then
    cap_text := ' Ad spend stays within $'
      || case when cap % 100 = 0 then (cap / 100)::text else to_char(cap / 100.0, 'FM999999990.00') end
      || ' this week, billed by the platform to your own account.';
  end if;

  plan_scope := case kind
    when 'paid_ads' then 'audience, creative, copy and budget'
    when 'seo' then 'audit findings and the exact changes to make'
    when 'social' then 'content calendar and the first posts'
    when 'email' then 'audience segments, sequence and copy'
    else 'the plan for the work'
  end;
  launch_title := case kind
    when 'paid_ads' then 'Campaigns live'
    when 'seo' then 'Changes published'
    when 'social' then 'Posting started'
    when 'email' then 'Sending started'
    else 'Work started'
  end;
  launch_notes := case kind
    when 'paid_ads' then 'The agent posts the campaign IDs and live links.'
    when 'seo' then 'The agent lists every page changed, with before and after.'
    when 'social' then 'The agent posts links to the published posts.'
    when 'email' then 'The agent posts the campaign names and send reports.'
    else 'The agent posts links to what changed.'
  end;

  if week = 1 then
    for platform in select jsonb_array_elements_text(coalesce(new.service_terms->'platforms', '[]'::jsonb)) loop
      insert into public.contract_milestones (contract_id, title, notes, completed)
      values (
        new.id,
        'Access shared: ' || platform,
        'Add the agent''s operator through ' || platform || '''s own partner or user settings, with the least access the work needs. Never share a password. You can remove the access at any time.',
        false
      );
    end loop;
    insert into public.contract_milestones (contract_id, title, notes, completed)
    values (
      new.id,
      'Plan approved',
      'The agent submits the plan as a deliverable: ' || plan_scope || '. Nothing goes live until you approve it.' || cap_text,
      false
    );
    insert into public.contract_milestones (contract_id, title, notes, completed)
    values (new.id, launch_title, launch_notes, false);
  end if;

  insert into public.contract_milestones (contract_id, title, notes, completed)
  values (
    new.id,
    'Week ' || week || ' of ' || weeks || ' report',
    'Spend, results and next steps, with links you can check.' || cap_text,
    false
  );
  return new;
end;
$$;

revoke all on function public.seed_service_milestones() from public, anon, authenticated;

drop trigger if exists contracts_seed_service_milestones on public.contracts;
create trigger contracts_seed_service_milestones
  after insert on public.contracts
  for each row execute function public.seed_service_milestones();

-- Who may create a contract from which source. Adds 'renewal'; the application
-- and negotiation cases are unchanged.
create or replace function public.contract_source_consents(
  source_type_in text,
  source_id_in uuid,
  agent_uuid uuid,
  organization_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case source_type_in
    when 'application' then exists (
      select 1
      from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      where a.id = source_id_in
        and a.agent_id = agent_uuid
        and o.organization_id = organization_uuid
    )
    when 'negotiation' then exists (
      select 1
      from public.negotiations n
      join public.opportunities o on o.id = n.opportunity_id
      where n.id = source_id_in
        and n.agent_id = agent_uuid
        and o.organization_id = organization_uuid
    )
    when 'renewal' then exists (
      select 1
      from public.contracts p
      where p.id = source_id_in
        and p.agent_id = agent_uuid
        and p.organization_id = organization_uuid
        and p.service_terms is not null
        and coalesce((p.service_terms->>'week')::integer, 1) < coalesce((p.service_terms->>'weeks')::integer, 1)
        and p.payment_status in ('authorized', 'captured', 'paid_out')
        and p.status not in ('Cancelled', 'Disputed')
    )
    else false
  end
$$;

revoke all on function public.contract_source_consents(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.contract_source_consents(text, uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- --- migrations/20261015042847_job_catalog.sql --------------------------
-- The job catalog (src/lib/jobCatalog.ts, docs/AGENT_JOBS.md) in the database.
--
-- 1. Every brief can name its job kind (opportunities.job_kind), and every
--    contract records the job kind of the brief it came from (contracts.job_kind),
--    derived by the database and immutable, like service_terms.
-- 2. A managed-service brief carries its week-1 checklist (service_checklist)
--    and limits beyond the ad-spend cap (service_limits) as data. Both are
--    frozen into contracts.service_terms, and the checklist seeds the contract's
--    milestones. New kinds therefore need no migration; service_kind is any
--    catalog id rather than a fixed list.
-- 3. Agent listings declare the job kinds they do (agents.job_kinds), so buyers
--    and the matcher can find the right agent.
--
-- Additive except the replaced check constraint, which only widens what is
-- allowed (catalog ids instead of five kinds; up to 12 platforms). Apply before
-- deploying the code that reads these columns.

alter table public.opportunities
  add column if not exists job_kind text,
  add column if not exists service_checklist jsonb,
  add column if not exists service_limits jsonb;

alter table public.contracts add column if not exists job_kind text;

alter table public.agents add column if not exists job_kinds text[] not null default '{}';

alter table public.opportunities drop constraint if exists opportunities_managed_service_terms;
alter table public.opportunities
  add constraint opportunities_managed_service_terms check (
    work_type in ('deliverable', 'managed_service')
    and (job_kind is null or job_kind ~ '^[a-z][a-z0-9_]{1,39}$')
    and (service_kind is null or service_kind ~ '^[a-z][a-z0-9_]{1,39}$')
    and cardinality(service_platforms) <= 12
    and char_length(array_to_string(service_platforms, '|')) <= 600
    and (ad_spend_cap_cents is null or ad_spend_cap_cents between 0 and 100000000)
    and (service_weeks is null or service_weeks between 1 and 52)
    and (service_checklist is null or (
      jsonb_typeof(service_checklist) = 'array'
      and jsonb_array_length(service_checklist) <= 10
      and octet_length(service_checklist::text) <= 6000
    ))
    and (service_limits is null or (
      jsonb_typeof(service_limits) = 'object'
      and octet_length(service_limits::text) <= 500
    ))
    and (work_type <> 'managed_service' or (service_kind is not null and service_weeks is not null))
  );

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agents_job_kinds_check') then
    alter table public.agents
      add constraint agents_job_kinds_check check (
        cardinality(job_kinds) <= 24
        and array_to_string(job_kinds, ',') ~ '^([a-z][a-z0-9_]{1,39}(,[a-z][a-z0-9_]{1,39})*)?$'
      );
  end if;
end $$;

-- Freeze service terms and the job kind at creation; copy them for a renewal.
create or replace function public.apply_contract_service_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prev public.contracts%rowtype;
  opp public.opportunities%rowtype;
  next_week integer;
begin
  if tg_op = 'UPDATE' then
    if public.current_profile_id() is not null
       and (new.service_terms is distinct from old.service_terms or new.job_kind is distinct from old.job_kind) then
      raise exception 'contracts: service terms and job kind are fixed when the contract is created'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.source_type = 'renewal' then
    select * into prev from public.contracts where id = new.source_id;
    if not found or prev.service_terms is null then
      raise exception 'contracts: only a managed-service contract can be renewed'
        using errcode = '42501';
    end if;
    next_week := coalesce((prev.service_terms->>'week')::integer, 1) + 1;
    new.amount_cents := prev.amount_cents;
    new.currency := prev.currency;
    new.title := regexp_replace(prev.title, ' · week [0-9]+$', '') || ' · week ' || next_week;
    new.service_terms := prev.service_terms || jsonb_build_object('week', next_week, 'renewedFrom', prev.id);
    new.job_kind := prev.job_kind;
    return new;
  end if;

  -- Never trust terms supplied by a browser or agent: derive them from the brief.
  new.service_terms := null;
  new.job_kind := null;
  select o.* into opp
    from public.opportunities o
   where o.id = public.contract_source_opportunity(new.source_type, new.source_id);
  if found then
    new.job_kind := coalesce(opp.job_kind, opp.service_kind);
    if opp.work_type = 'managed_service' then
      new.service_terms := jsonb_build_object(
        'kind', opp.service_kind,
        'platforms', to_jsonb(opp.service_platforms),
        'adSpendCapCents', opp.ad_spend_cap_cents,
        'weeks', opp.service_weeks,
        'week', 1,
        'opportunityId', opp.id,
        'checklist', coalesce(opp.service_checklist, '[]'::jsonb),
        'limits', coalesce(opp.service_limits, '{}'::jsonb)
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.apply_contract_service_terms() from public, anon, authenticated;

-- A managed-service contract starts with its checklist: access per platform,
-- the brief's checklist (or the built-in one for briefs saved before the
-- catalog), then the week's report. Each milestone gets a strictly later
-- created_at so the checklist reads in order (rows in one transaction would
-- otherwise share now()).
create or replace function public.seed_service_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
  week integer;
  weeks integer;
  cap integer;
  cap_text text := '';
  platform text;
  item jsonb;
  checklist jsonb;
  plan_scope text;
  launch_title text;
  launch_notes text;
  seq integer := 0;
begin
  if new.service_terms is null then
    return new;
  end if;

  kind := coalesce(new.service_terms->>'kind', 'other');
  week := coalesce((new.service_terms->>'week')::integer, 1);
  weeks := coalesce((new.service_terms->>'weeks')::integer, week);
  cap := (new.service_terms->>'adSpendCapCents')::integer;
  if cap is not null then
    cap_text := ' Ad spend stays within $'
      || case when cap % 100 = 0 then (cap / 100)::text else to_char(cap / 100.0, 'FM999999990.00') end
      || ' this week, billed by the platform to your own account.';
  end if;
  checklist := new.service_terms->'checklist';

  if week = 1 then
    for platform in select jsonb_array_elements_text(coalesce(new.service_terms->'platforms', '[]'::jsonb)) loop
      insert into public.contract_milestones (contract_id, title, notes, completed, created_at)
      values (
        new.id,
        'Access shared: ' || platform,
        'Add the agent''s operator through ' || platform || '''s own partner or user settings, with the least access the work needs. Never share a password. You can remove the access at any time.',
        false,
        now() + seq * interval '1 millisecond'
      );
      seq := seq + 1;
    end loop;

    if jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) > 0 then
      for item in select value from jsonb_array_elements(checklist) loop
        if jsonb_typeof(item) = 'object' and coalesce(btrim(item->>'title'), '') <> '' then
          insert into public.contract_milestones (contract_id, title, notes, completed, created_at)
          values (new.id, left(item->>'title', 160), left(coalesce(item->>'notes', ''), 1000), false, now() + seq * interval '1 millisecond');
          seq := seq + 1;
        end if;
      end loop;
    else
      plan_scope := case kind
        when 'paid_ads' then 'audience, creative, copy and budget'
        when 'seo' then 'audit findings and the exact changes to make'
        when 'social' then 'content calendar and the first posts'
        when 'email' then 'audience segments, sequence and copy'
        else 'the plan for the work'
      end;
      launch_title := case kind
        when 'paid_ads' then 'Campaigns live'
        when 'seo' then 'Changes published'
        when 'social' then 'Posting started'
        when 'email' then 'Sending started'
        else 'Work started'
      end;
      launch_notes := case kind
        when 'paid_ads' then 'The agent posts the campaign IDs and live links.'
        when 'seo' then 'The agent lists every page changed, with before and after.'
        when 'social' then 'The agent posts links to the published posts.'
        when 'email' then 'The agent posts the campaign names and send reports.'
        else 'The agent posts links to what changed.'
      end;
      insert into public.contract_milestones (contract_id, title, notes, completed, created_at)
      values (
        new.id,
        'Plan approved',
        'The agent submits the plan as a deliverable: ' || plan_scope || '. Nothing goes live until you approve it.' || cap_text,
        false,
        now() + seq * interval '1 millisecond'
      );
      seq := seq + 1;
      insert into public.contract_milestones (contract_id, title, notes, completed, created_at)
      values (new.id, launch_title, launch_notes, false, now() + seq * interval '1 millisecond');
      seq := seq + 1;
    end if;
  end if;

  insert into public.contract_milestones (contract_id, title, notes, completed, created_at)
  values (
    new.id,
    'Week ' || week || ' of ' || weeks || ' report',
    'Spend, results and next steps, with links you can check.' || cap_text,
    false,
    now() + seq * interval '1 millisecond'
  );
  return new;
end;
$$;

revoke all on function public.seed_service_milestones() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- --- migrations/20261119090000_agent_webhooks.sql ----------------------
-- Agent webhooks: tell an agent the moment something it is a party to changes,
-- instead of making it poll.
--
-- * agent_webhooks: at most one HTTPS endpoint per agent API key, with the
--   signing secret (Standard Webhooks). Service role only; the owner and the
--   agent manage it through /api/agent-webhooks and the MCP tools.
-- * agent_events: the outbox. Triggers on the marketplace tables record each
--   change for the profile that should hear about it, whatever wrote it (the
--   browser, an agent over MCP, Stripe or the platform). An event is recorded
--   only when that profile has a live webhook, and never for the profile that
--   caused it. Events carry identifiers and a status, never content.
-- * agent_event_deliveries: one row per event and key, retried with backoff by
--   the /api/agent-events job until delivered or given up.
--
-- Recording an event can never fail the write that caused it: errors become
-- warnings. Additive only and safe to run more than once.

create table if not exists public.agent_webhooks (
  key_id uuid primary key references public.agent_api_keys(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  url text not null check (url ~ '^https://' and length(url) <= 2048),
  secret text not null,
  events text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  disabled_reason text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_status integer
);
create index if not exists agent_webhooks_profile_idx on public.agent_webhooks(profile_id);
alter table public.agent_webhooks enable row level security;
revoke all on public.agent_webhooks from public, anon, authenticated;
grant select, insert, update, delete on public.agent_webhooks to service_role;

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_profile_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_events_created_idx on public.agent_events(created_at);
alter table public.agent_events enable row level security;
revoke all on public.agent_events from public, anon, authenticated;
grant select, insert, delete on public.agent_events to service_role;

create table if not exists public.agent_event_deliveries (
  event_id uuid not null references public.agent_events(id) on delete cascade,
  key_id uuid not null references public.agent_api_keys(id) on delete cascade,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  last_status integer,
  created_at timestamptz not null default now(),
  primary key (event_id, key_id)
);
create index if not exists agent_event_deliveries_due_idx on public.agent_event_deliveries(next_attempt_at)
  where delivered_at is null and failed_at is null;
alter table public.agent_event_deliveries enable row level security;
revoke all on public.agent_event_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.agent_event_deliveries to service_role;

-- Record one event for a recipient and queue it for each of their live webhooks.
create or replace function public.emit_agent_event(p_type text, p_recipient uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid; ev uuid;
begin
  begin
    actor := public.current_profile_id();
    if p_recipient is null or p_recipient is not distinct from actor then return; end if;
    if not exists (
      select 1 from public.agent_webhooks w join public.agent_api_keys k on k.id = w.key_id
      where w.profile_id = p_recipient and w.disabled_at is null and k.revoked_at is null and k.paused_at is null
        and (cardinality(w.events) = 0 or p_type = any(w.events))
    ) then return; end if;
    insert into public.agent_events(type, recipient_profile_id, actor_profile_id, data)
      values (p_type, p_recipient, actor, coalesce(p_data, '{}'::jsonb)) returning id into ev;
    insert into public.agent_event_deliveries(event_id, key_id)
      select ev, w.key_id from public.agent_webhooks w join public.agent_api_keys k on k.id = w.key_id
      where w.profile_id = p_recipient and w.disabled_at is null and k.revoked_at is null and k.paused_at is null
        and (cardinality(w.events) = 0 or p_type = any(w.events))
      on conflict do nothing;
  exception when others then
    raise warning 'agent event % not recorded: %', p_type, sqlstate;
  end;
end $$;
revoke all on function public.emit_agent_event(text, uuid, jsonb) from public, anon, authenticated;

-- Who decides on the organization side of an opportunity: its organization's owner, else whoever posted it.
create or replace function public.agent_event_opportunity_owner(p_opportunity uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(o.owner_id, op.owner_id)
  from public.opportunities op left join public.organizations o on o.id = op.organization_id
  where op.id = p_opportunity
$$;
revoke all on function public.agent_event_opportunity_owner(uuid) from public, anon, authenticated;

create or replace function public.agent_events_hire_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ids jsonb := jsonb_build_object('hireRequestId', new.id, 'agentId', new.agent_id, 'opportunityId', new.opportunity_id, 'status', new.status);
begin
  if tg_op = 'INSERT' then
    perform public.emit_agent_event('hire_request.created', (select owner_id from public.agents where id = new.agent_id), ids);
  elsif new.status is distinct from old.status and new.status in ('accepted', 'rejected') then
    perform public.emit_agent_event('hire_request.' || new.status, new.owner_id, ids);
  end if;
  return null;
exception when others then
  raise warning 'agent events (hire_requests): %', sqlstate;
  return null;
end $$;

create or replace function public.agent_events_application() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ids jsonb := jsonb_build_object('applicationId', new.id, 'agentId', new.agent_id, 'opportunityId', new.opportunity_id, 'status', new.status);
begin
  if tg_op = 'INSERT' then
    perform public.emit_agent_event('application.created', public.agent_event_opportunity_owner(new.opportunity_id), ids);
  elsif new.status is distinct from old.status and new.status in ('accepted', 'rejected') then
    perform public.emit_agent_event('application.' || new.status, new.owner_id, ids);
  end if;
  return null;
exception when others then
  raise warning 'agent events (applications): %', sqlstate;
  return null;
end $$;

create or replace function public.agent_events_negotiation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ids jsonb := jsonb_build_object('negotiationId', new.id, 'agentId', new.agent_id, 'opportunityId', new.opportunity_id, 'status', new.status);
  org_side uuid := public.agent_event_opportunity_owner(new.opportunity_id);
begin
  if tg_op = 'INSERT' then
    perform public.emit_agent_event('negotiation.created', org_side, ids);
  elsif new.status is distinct from old.status and new.status in ('countered', 'accepted', 'rejected') then
    -- The party that made the change is skipped by emit_agent_event.
    perform public.emit_agent_event('negotiation.' || new.status, new.owner_id, ids);
    if new.status <> 'countered' then perform public.emit_agent_event('negotiation.' || new.status, org_side, ids); end if;
  end if;
  return null;
exception when others then
  raise warning 'agent events (negotiations): %', sqlstate;
  return null;
end $$;

create or replace function public.agent_events_contract() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  org_owner uuid := (select owner_id from public.organizations where id = new.organization_id);
  agent_owner uuid := (select owner_id from public.agents where id = new.agent_id);
  ids jsonb := jsonb_build_object('contractId', new.id, 'agentId', new.agent_id, 'organizationId', new.organization_id, 'paymentStatus', new.payment_status);
  kind text;
begin
  if tg_op = 'INSERT' then
    kind := 'contract.created';
  elsif new.payment_status is distinct from old.payment_status then
    kind := case
      when new.payment_status = 'authorized' then 'contract.funded'
      when new.payment_status = 'captured' then 'payment.released'
      when new.payment_status = 'unfunded' and old.payment_status = 'authorized' then 'contract.hold_ended'
      when new.payment_status = 'refunded' then 'payment.refunded'
    end;
  end if;
  if kind is not null then
    perform public.emit_agent_event(kind, agent_owner, ids);
    perform public.emit_agent_event(kind, org_owner, ids);
  end if;
  return null;
exception when others then
  raise warning 'agent events (contracts): %', sqlstate;
  return null;
end $$;

create or replace function public.agent_events_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select organization_id, agent_id into c from public.contracts where id = new.contract_id;
  perform public.emit_agent_event('message.created',
    case when new.sender_type = 'Organization' then (select owner_id from public.agents where id = c.agent_id)
         else (select owner_id from public.organizations where id = c.organization_id) end,
    jsonb_build_object('contractId', new.contract_id, 'messageId', new.id, 'from', new.sender_type));
  return null;
exception when others then
  raise warning 'agent events (contract_messages): %', sqlstate;
  return null;
end $$;

create or replace function public.agent_events_deliverable() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  ids jsonb := jsonb_build_object('contractId', new.contract_id, 'deliverableId', new.id, 'status', new.status);
  was text := case when tg_op = 'INSERT' then null else old.status end;
begin
  if new.status is not distinct from was then return null; end if;
  select organization_id, agent_id into c from public.contracts where id = new.contract_id;
  if new.status = 'submitted' then
    perform public.emit_agent_event('deliverable.submitted', (select owner_id from public.organizations where id = c.organization_id), ids);
  elsif new.status = 'approved' then
    perform public.emit_agent_event('deliverable.approved', (select owner_id from public.agents where id = c.agent_id), ids);
  elsif new.status = 'draft' and was = 'submitted' then
    perform public.emit_agent_event('deliverable.returned', (select owner_id from public.agents where id = c.agent_id), ids);
  end if;
  return null;
exception when others then
  raise warning 'agent events (contract_deliverables): %', sqlstate;
  return null;
end $$;

create or replace function public.agent_events_dispute() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  kind text;
  ids jsonb := jsonb_build_object('contractId', new.contract_id, 'disputeId', new.id, 'status', new.status);
begin
  if tg_op = 'INSERT' then kind := 'dispute.opened';
  elsif new.status is distinct from old.status and new.status = 'Resolved' then kind := 'dispute.resolved';
  else return null;
  end if;
  select organization_id, agent_id into c from public.contracts where id = new.contract_id;
  perform public.emit_agent_event(kind, (select owner_id from public.agents where id = c.agent_id), ids);
  perform public.emit_agent_event(kind, (select owner_id from public.organizations where id = c.organization_id), ids);
  return null;
exception when others then
  raise warning 'agent events (disputes): %', sqlstate;
  return null;
end $$;

revoke all on function public.agent_events_hire_request() from public, anon, authenticated;
revoke all on function public.agent_events_application() from public, anon, authenticated;
revoke all on function public.agent_events_negotiation() from public, anon, authenticated;
revoke all on function public.agent_events_contract() from public, anon, authenticated;
revoke all on function public.agent_events_message() from public, anon, authenticated;
revoke all on function public.agent_events_deliverable() from public, anon, authenticated;
revoke all on function public.agent_events_dispute() from public, anon, authenticated;

drop trigger if exists agent_events_hire_request on public.hire_requests;
create trigger agent_events_hire_request after insert or update of status on public.hire_requests
  for each row execute function public.agent_events_hire_request();
drop trigger if exists agent_events_application on public.applications;
create trigger agent_events_application after insert or update of status on public.applications
  for each row execute function public.agent_events_application();
drop trigger if exists agent_events_negotiation on public.negotiations;
create trigger agent_events_negotiation after insert or update of status on public.negotiations
  for each row execute function public.agent_events_negotiation();
drop trigger if exists agent_events_contract on public.contracts;
create trigger agent_events_contract after insert or update of payment_status on public.contracts
  for each row execute function public.agent_events_contract();
drop trigger if exists agent_events_message on public.contract_messages;
create trigger agent_events_message after insert on public.contract_messages
  for each row execute function public.agent_events_message();
drop trigger if exists agent_events_deliverable on public.contract_deliverables;
create trigger agent_events_deliverable after insert or update of status on public.contract_deliverables
  for each row execute function public.agent_events_deliverable();
drop trigger if exists agent_events_dispute on public.disputes;
create trigger agent_events_dispute after insert or update of status on public.disputes
  for each row execute function public.agent_events_dispute();

-- --- migrations/20261119110000_agent_listing_visibility.sql ------------
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

-- --- migrations/20261126120000_seller_trust.sql ------------------------
-- Two answers sellers kept emailing support for (2026-11-26).
--
-- 1. "Can I withdraw before the buyer accepts?" An applicant could not: only the
--    organization could move an application out of pending. The applicant side
--    (the profile that applied, or the agent's owner) may now withdraw a pending
--    application. Accepting and rejecting stay organization-side only, and a
--    withdrawn application can no longer become a contract
--    (accept_contract_application requires pending or accepted).
--
-- 2. "Is this brief real, and has anyone been hired?" Brief pages could not say,
--    because applications, negotiations and contracts are private to their
--    parties. brief_public_facts returns counts only, never who or how much: how
--    many agents have proposed, how many funded contracts the brief has, when
--    the organization joined, and how many of its contracts were paid in live
--    mode. Unfunded contracts are not counted as hires.
--
-- Replaces one function and adds one. Safe to run more than once.

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

    if new.status = 'withdrawn' then
      -- Only the applicant side may withdraw its own application.
      if not (old.owner_id = actor or public.is_agent_owner(old.agent_id)) then
        raise exception 'applications: only the applicant may withdraw an application'
          using errcode = '42501';
      end if;
      return new;
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
revoke all on function public.enforce_application_update_authority() from public, anon, authenticated;

create or replace function public.brief_public_facts(brief_ids uuid[])
returns table (
  opportunity_id uuid,
  proposals integer,
  funded_contracts integer,
  organization_since timestamptz,
  organization_paid_contracts integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    (select count(distinct x.agent_id)::integer from (
       select a.agent_id from public.applications a
        where a.opportunity_id = o.id and a.status <> 'withdrawn'
       union
       select n.agent_id from public.negotiations n
        where n.opportunity_id = o.id
     ) x),
    (select count(*)::integer from public.contracts c
      where c.organization_id = o.organization_id
        and public.contract_source_opportunity(c.source_type, c.source_id) = o.id
        and c.payment_status in ('authorized', 'captured', 'paid_out')),
    org.created_at,
    (select count(distinct p.contract_id)::integer from public.payments p
       join public.contracts c on c.id = p.contract_id
      where c.organization_id = o.organization_id
        and p.provider_mode = 'live'
        and p.status = 'captured')
  from public.opportunities o
  left join public.organizations org on org.id = o.organization_id
  where o.id = any (brief_ids[1:200]);
$$;
revoke all on function public.brief_public_facts(uuid[]) from public;
grant execute on function public.brief_public_facts(uuid[]) to anon, authenticated, service_role;


-- --- migrations/20261126150000_owner_review.sql ------------------------
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


-- --- migrations/20261126180000_payout_dispute_restore.sql ---------------
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


-- ---------------------------------------------------------------------------
-- Explicit Data API grants (2026-10-22)
--
-- Supabase stops granting new public tables to anon, authenticated and
-- service_role by default: new projects since 2026-05-30, every project's new
-- tables from 2026-10-30 (github.com/orgs/supabase/discussions/45329). Existing
-- tables keep their grants. Without these statements a project built from this
-- schema answers every supabase-js call with 42501 "permission denied", and
-- RLS never gets to decide.
--
-- Each grant matches an RLS policy and a call the app makes. GRANT only adds,
-- so on a project that already has the old blanket grants this changes nothing.
-- It never widens the ledger: payments, payouts and stripe_events get no write
-- grant for anon or authenticated, billing_accounts gets no insert or delete,
-- and seller_accounts, money_operations and agent_payment_cards keep the
-- grants they already declare.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- Public marketplace reads (anon: server/publicData.ts and the signed-out app).
grant select on table public.organizations, public.agents, public.opportunities,
  public.reviews, public.activity_events to anon;

-- loadSupabaseState() reads these for a signed-out visitor too and expects an
-- empty result (no policy targets anon), not an error. SELECT is the only grant.
grant select on table public.applications, public.negotiations, public.hire_requests,
  public.contracts, public.saved_opportunities, public.disputes to anon;

-- Signed-in users (browser, /api routes with the caller's JWT, MCP agent sessions).
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.organizations to authenticated;
grant select, insert, update on table public.agents to authenticated;
grant select, insert, update on table public.opportunities to authenticated;
grant select, insert, update on table public.applications to authenticated;
grant select, insert, update on table public.negotiations to authenticated;
grant select, insert, update on table public.hire_requests to authenticated;
grant select, insert, delete on table public.saved_opportunities to authenticated;
grant select, insert, update on table public.contracts to authenticated;
grant select, insert, update on table public.contract_milestones to authenticated;
grant select, insert, update on table public.contract_deliverables to authenticated;
grant select, insert on table public.deliverable_gate_events to authenticated;
grant select, insert on table public.contract_messages to authenticated;
grant select, insert on table public.reviews to authenticated;
grant select, insert, update on table public.disputes to authenticated;
grant select, insert on table public.activity_events to authenticated;
grant select, insert, update on table public.agent_api_keys to authenticated;
grant select, update on table public.billing_accounts to authenticated;
grant select on table public.payments, public.payouts to authenticated;

-- Service role (server/ledger.ts, server/reconcile.ts, server/agentKeys.ts,
-- server/revenue.ts and the SECURITY INVOKER money functions). It bypasses RLS,
-- so keep it to what the server code does.
grant select on table public.organizations, public.agents, public.contract_deliverables,
  public.disputes to service_role;
grant select, update on table public.contracts to service_role;
grant select, update on table public.agent_api_keys to service_role;
grant select, insert, update on table public.billing_accounts to service_role;
grant select, insert, update on table public.payments to service_role;
grant select, insert, update on table public.payouts to service_role;
grant select, insert, update on table public.stripe_events to service_role;


-- API-key resolution is service-only; PUBLIC/anon/authenticated remain revoked.
-- Explicit EXECUTE is needed when fresh projects have no role default grants.
grant execute on function public.resolve_agent_api_key(text) to service_role;

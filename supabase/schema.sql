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
  contract_id uuid references contracts(id) on delete cascade,
  reason text not null,
  status text not null default 'Open',
  resolution_notes text,
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
    or exists (
      select 1 from opportunities o
      where o.id = applications.opportunity_id
        and (
          o.owner_id = public.current_profile_id()
          or public.is_organization_owner(o.organization_id)
        )
    )
  )
  with check (true);

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
    or exists (
      select 1 from opportunities o
      where o.id = negotiations.opportunity_id
        and (
          o.owner_id = public.current_profile_id()
          or public.is_organization_owner(o.organization_id)
        )
    )
  )
  with check (true);

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
  with check (true);

drop policy if exists "contracts_participant_read" on contracts;
create policy "contracts_participant_read" on contracts
  for select to authenticated
  using (public.can_access_contract(id));

drop policy if exists "contracts_participant_insert" on contracts;
create policy "contracts_participant_insert" on contracts
  for insert to authenticated
  with check (
    public.is_organization_owner(organization_id)
    or public.is_agent_owner(agent_id)
  );

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

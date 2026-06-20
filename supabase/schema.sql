create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text,
  display_name text,
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
  actor_type text,
  actor_id uuid,
  entity_type text,
  entity_id uuid,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

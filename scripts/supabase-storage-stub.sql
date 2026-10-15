-- The parts of Supabase Storage that supabase/schema.sql touches, for the
-- plain-Postgres harnesses (scripts/rls-local-verify.sh, scripts/verify-money-db.py).
-- Column names and types match the hosted storage schema; RLS is on, as it is
-- in production. Policy checks against storage.objects here are the same checks
-- Storage runs before it signs an upload URL (INSERT) or a download URL (SELECT).
-- What Storage itself enforces on the bytes (the bucket's size and type limits)
-- is not simulated; the attachment trigger re-checks both from object metadata.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  owner_id text,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  user_metadata jsonb,
  version text,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

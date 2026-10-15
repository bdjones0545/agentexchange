-- Deliverable file attachments: PDFs, spreadsheets, images and archives that an
-- agent delivers alongside a deliverable's markdown body.
--
-- Security model
--   * Files live in the private Storage bucket `deliverable-attachments` under
--     {contract_id}/{upload_id}/{file_name}. The bucket is never public; files
--     are read through short-lived signed URLs, which Storage only signs for a
--     caller its SELECT policy admits.
--   * Read: a contract's two sides (can_access_contract), nobody else.
--   * Upload: only the agent side (is_contract_agent_side), only while the
--     contract is not on hold, mirroring lock_delivery_contract: no open
--     dispute, not Paused/Disputed/Cancelled, and a priced contract funded.
--     A contract holds at most 100 uploads. Nobody can overwrite (no upsert),
--     move or delete a file through the API: there are no UPDATE or DELETE
--     policies, and restrictive guards keep any later permissive storage policy
--     from widening this bucket.
--   * Size, type and name: the bucket caps files at 25 MB and to an allow-list
--     of content types (no HTML, SVG, scripts or executables); the path policy
--     only admits sanitised names ([A-Za-z0-9._-], at most 120 characters).
--   * Attach: contract_deliverable_attachments links an uploaded object to a
--     deliverable. Rows are written only by the agent side, only while the
--     deliverable is a draft and the contract is not on hold, at most 10 per
--     deliverable. Size, type and file name are copied from the stored object,
--     never from the caller. Rows are immutable; the agent may unlink a file
--     from a draft. submit_deliverable_with_attachments() attaches and flips
--     the draft to submitted in one transaction, so a submitted or approved
--     deliverable's files cannot change.
--
-- The limits are mirrored in src/lib/attachmentRules.ts (checked by
-- tests/deliverable-attachments.test.ts). Safe to run more than once.

-- 1. Limits ------------------------------------------------------------------
create or replace function public.deliverable_attachment_types()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'application/pdf',
    'text/csv',
    'text/plain',
    'text/markdown',
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/zip',
    'application/gzip'
  ]::text[]
$$;
revoke all on function public.deliverable_attachment_types() from public, anon;
grant execute on function public.deliverable_attachment_types() to authenticated;

-- 2. The private bucket ------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deliverable-attachments', 'deliverable-attachments', false, 26214400, public.deliverable_attachment_types())
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Helpers -----------------------------------------------------------------
-- The contract a storage path belongs to, or null when the path is not
-- {uuid}/{uuid}/{safe name}. Lowercase UUIDs only, so one file has one path.
create or replace function public.deliverable_attachment_contract(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'
      and position('..' in object_name) = 0
    then split_part(object_name, '/', 1)::uuid
  end
$$;
revoke all on function public.deliverable_attachment_contract(text) from public, anon;
grant execute on function public.deliverable_attachment_contract(text) to authenticated;

-- The agent side of a contract: the operator who owns the contracted agent.
create or replace function public.is_contract_agent_side(contract_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contracts c
    where c.id = contract_uuid and public.is_agent_owner(c.agent_id)
  )
$$;
revoke all on function public.is_contract_agent_side(uuid) from public, anon;
grant execute on function public.is_contract_agent_side(uuid) to authenticated;

-- Why delivery on a contract is frozen, or null when it is not. The same
-- conditions and wording as the lock_delivery_contract trigger.
create or replace function public.delivery_hold_reason(contract_uuid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.id is null then 'Contract not found'
    when c.status in ('Paused', 'Disputed', 'Cancelled')
      or exists (select 1 from public.disputes d where d.contract_id = c.id and d.status <> 'Resolved')
      then 'Resolve the contract hold before changing delivery'
    when coalesce(c.amount_cents, 0) > 0
      and coalesce(c.payment_status, 'unfunded') not in ('authorized', 'captured', 'paid_out')
      then 'Priced work requires funding authorization'
  end
  from (select contract_uuid as id) k
  left join public.contracts c on c.id = k.id
$$;
revoke all on function public.delivery_hold_reason(uuid) from public, anon, authenticated;

-- The storage INSERT check: a well-formed path on a contract the caller is
-- the agent side of, not on hold, under the per-contract upload cap.
create or replace function public.can_upload_deliverable_attachment(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cid uuid := public.deliverable_attachment_contract(object_name);
begin
  if cid is null or not public.is_contract_agent_side(cid) then
    return false;
  end if;
  if public.delivery_hold_reason(cid) is not null then
    return false;
  end if;
  return (
    select count(*) from storage.objects o
    where o.bucket_id = 'deliverable-attachments' and o.name like cid::text || '/%'
  ) < 100;
end;
$$;
revoke all on function public.can_upload_deliverable_attachment(text) from public, anon;
grant execute on function public.can_upload_deliverable_attachment(text) to authenticated;

-- 4. Storage policies --------------------------------------------------------
drop policy if exists "deliverable_attachments_party_read" on storage.objects;
create policy "deliverable_attachments_party_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'deliverable-attachments'
    and public.can_access_contract(public.deliverable_attachment_contract(name))
  );

drop policy if exists "deliverable_attachments_agent_upload" on storage.objects;
create policy "deliverable_attachments_agent_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'deliverable-attachments'
    and public.can_upload_deliverable_attachment(name)
  );

-- Restrictive guards: every permissive policy is ANDed with these, so a broad
-- storage policy added later for another bucket cannot open this one.
drop policy if exists "deliverable_attachments_guard_read" on storage.objects;
create policy "deliverable_attachments_guard_read" on storage.objects
  as restrictive for select to authenticated
  using (
    bucket_id <> 'deliverable-attachments'
    or public.can_access_contract(public.deliverable_attachment_contract(name))
  );

drop policy if exists "deliverable_attachments_guard_upload" on storage.objects;
create policy "deliverable_attachments_guard_upload" on storage.objects
  as restrictive for insert to authenticated
  with check (
    bucket_id <> 'deliverable-attachments'
    or public.can_upload_deliverable_attachment(name)
  );

drop policy if exists "deliverable_attachments_guard_update" on storage.objects;
create policy "deliverable_attachments_guard_update" on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'deliverable-attachments')
  with check (bucket_id <> 'deliverable-attachments');

drop policy if exists "deliverable_attachments_guard_delete" on storage.objects;
create policy "deliverable_attachments_guard_delete" on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'deliverable-attachments');

-- anon gets no access at all; its guard calls no function anon cannot execute.
drop policy if exists "deliverable_attachments_guard_anon" on storage.objects;
create policy "deliverable_attachments_guard_anon" on storage.objects
  as restrictive for all to anon
  using (bucket_id <> 'deliverable-attachments')
  with check (bucket_id <> 'deliverable-attachments');

-- 5. Attachment records ------------------------------------------------------
create table if not exists public.contract_deliverable_attachments (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.contract_deliverables(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_deliverable_attachments_deliverable_id
  on public.contract_deliverable_attachments(deliverable_id);
create index if not exists idx_contract_deliverable_attachments_contract_id
  on public.contract_deliverable_attachments(contract_id);

alter table public.contract_deliverable_attachments enable row level security;

-- Policies use only the row's own contract_id (no self-reference), so
-- INSERT ... RETURNING works. There is no UPDATE policy: rows are immutable.
drop policy if exists "contract_deliverable_attachments_participant_read" on public.contract_deliverable_attachments;
create policy "contract_deliverable_attachments_participant_read" on public.contract_deliverable_attachments
  for select to authenticated
  using (public.can_access_contract(contract_id));

drop policy if exists "contract_deliverable_attachments_participant_insert" on public.contract_deliverable_attachments;
create policy "contract_deliverable_attachments_participant_insert" on public.contract_deliverable_attachments
  for insert to authenticated
  with check (public.can_access_contract(contract_id));

drop policy if exists "contract_deliverable_attachments_participant_delete" on public.contract_deliverable_attachments;
create policy "contract_deliverable_attachments_participant_delete" on public.contract_deliverable_attachments
  for delete to authenticated
  using (public.can_access_contract(contract_id));

create or replace function public.enforce_deliverable_attachment_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d_contract uuid;
  d_status text;
  hold text;
  meta jsonb;
  mime text;
  bytes bigint;
begin
  select d.contract_id, d.status into d_contract, d_status
  from public.contract_deliverables d
  where d.id = new.deliverable_id
  for update;
  if not found then
    raise exception 'Deliverable not found' using errcode = '42501';
  end if;

  new.contract_id := d_contract;
  if public.deliverable_attachment_contract(new.storage_path) is distinct from d_contract then
    raise exception 'Attachment path must be an upload for this contract' using errcode = '42501';
  end if;

  if public.current_profile_id() is not null then
    if not public.is_contract_agent_side(d_contract) then
      raise exception 'Only the agent side can attach files' using errcode = '42501';
    end if;
    if d_status <> 'draft' then
      raise exception 'Files can only be attached while the deliverable is a draft' using errcode = '42501';
    end if;
    hold := public.delivery_hold_reason(d_contract);
    if hold is not null then
      raise exception '%', hold using errcode = '42501';
    end if;
  end if;

  if exists (select 1 from public.contract_deliverable_attachments a where a.storage_path = new.storage_path) then
    raise exception 'This upload is already attached; request a new upload URL' using errcode = '23505';
  end if;
  if (select count(*) from public.contract_deliverable_attachments a where a.deliverable_id = new.deliverable_id) >= 10 then
    raise exception 'A deliverable carries at most 10 files' using errcode = '54000';
  end if;

  -- Facts about the file come from Storage, never from the caller.
  select o.metadata into meta
  from storage.objects o
  where o.bucket_id = 'deliverable-attachments' and o.name = new.storage_path;
  if not found then
    raise exception 'Upload the file before attaching it' using errcode = 'P0002';
  end if;
  mime := lower(btrim(split_part(coalesce(meta ->> 'mimetype', ''), ';', 1)));
  bytes := nullif(meta ->> 'size', '')::bigint;
  if not (mime = any (public.deliverable_attachment_types())) then
    raise exception 'File type % is not allowed', coalesce(nullif(mime, ''), 'unknown') using errcode = '22023';
  end if;
  if bytes is null or bytes <= 0 or bytes > 26214400 then
    raise exception 'Files must be between 1 byte and 25 MB' using errcode = '22023';
  end if;

  new.file_name := split_part(new.storage_path, '/', 3);
  new.content_type := mime;
  new.size_bytes := bytes;
  new.uploaded_by := public.current_profile_id();
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.enforce_deliverable_attachment_insert() from public, anon, authenticated;

drop trigger if exists contract_deliverable_attachments_enforce_insert on public.contract_deliverable_attachments;
create trigger contract_deliverable_attachments_enforce_insert
  before insert on public.contract_deliverable_attachments
  for each row execute function public.enforce_deliverable_attachment_insert();

create or replace function public.enforce_deliverable_attachment_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d_contract uuid;
  d_status text;
  hold text;
begin
  if public.current_profile_id() is null then
    return old;
  end if;
  select d.contract_id, d.status into d_contract, d_status
  from public.contract_deliverables d
  where d.id = old.deliverable_id
  for update;
  -- The deliverable itself is being deleted (cascade): nothing left to protect.
  if not found then
    return old;
  end if;
  if not public.is_contract_agent_side(d_contract) then
    raise exception 'Only the agent side can remove files' using errcode = '42501';
  end if;
  if d_status <> 'draft' then
    raise exception 'Files can only be removed while the deliverable is a draft' using errcode = '42501';
  end if;
  hold := public.delivery_hold_reason(d_contract);
  if hold is not null then
    raise exception '%', hold using errcode = '42501';
  end if;
  return old;
end;
$$;
revoke all on function public.enforce_deliverable_attachment_delete() from public, anon, authenticated;

drop trigger if exists contract_deliverable_attachments_enforce_delete on public.contract_deliverable_attachments;
create trigger contract_deliverable_attachments_enforce_delete
  before delete on public.contract_deliverable_attachments
  for each row execute function public.enforce_deliverable_attachment_delete();

-- Production gates writes to every contract table on the operator's policy
-- acceptance (policy_private.guard_write); attachments follow when it exists.
do $$
begin
  if to_regprocedure('policy_private.guard_write()') is not null then
    execute 'drop trigger if exists policy_acceptance_write on public.contract_deliverable_attachments';
    execute 'create trigger policy_acceptance_write before insert or update or delete on public.contract_deliverable_attachments for each row execute function policy_private.guard_write()';
  end if;
end $$;

-- 6. Submit with attachments, atomically ------------------------------------
-- Writes the draft (a new one, or the named draft revised), makes its file set
-- exactly p_paths, then submits it — all as the caller, so RLS and every
-- trigger above and on contract_deliverables decide. Any refusal rolls the
-- whole submission back.
create or replace function public.submit_deliverable_with_attachments(
  p_contract uuid,
  p_deliverable uuid,
  p_title text,
  p_notes text,
  p_gate jsonb,
  p_paths text[],
  p_submitted_at timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_paths text[] := coalesce(p_paths, '{}'::text[]);
  result jsonb;
begin
  if cardinality(v_paths) > 10 then
    raise exception 'A deliverable carries at most 10 files' using errcode = '54000';
  end if;
  if (select count(distinct p) from unnest(v_paths) p) <> cardinality(v_paths) then
    raise exception 'Each file can be attached once' using errcode = '22023';
  end if;

  if p_deliverable is null then
    insert into public.contract_deliverables (contract_id, title, notes, status, gate)
    values (p_contract, p_title, p_notes, 'draft', p_gate)
    returning id into v_id;
  else
    update public.contract_deliverables
      set title = p_title, notes = p_notes, gate = p_gate
      where id = p_deliverable and contract_id = p_contract and status = 'draft'
      returning id into v_id;
    if v_id is null then
      raise exception 'Only a draft on this contract can be revised' using errcode = '42501';
    end if;
  end if;

  delete from public.contract_deliverable_attachments a
  where a.deliverable_id = v_id and not (a.storage_path = any (v_paths));

  insert into public.contract_deliverable_attachments (deliverable_id, storage_path)
  select v_id, p
  from unnest(v_paths) with ordinality as u(p, n)
  where not exists (
    select 1 from public.contract_deliverable_attachments a
    where a.deliverable_id = v_id and a.storage_path = u.p
  )
  order by u.n;

  update public.contract_deliverables
    set status = 'submitted', submitted_at = coalesce(p_submitted_at, now())
    where id = v_id;

  select jsonb_build_object(
    'id', d.id,
    'title', d.title,
    'status', d.status,
    'submitted_at', d.submitted_at,
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'path', a.storage_path,
        'fileName', a.file_name,
        'contentType', a.content_type,
        'sizeBytes', a.size_bytes
      ) order by a.created_at, a.file_name)
      from public.contract_deliverable_attachments a
      where a.deliverable_id = d.id
    ), '[]'::jsonb)
  )
  into result
  from public.contract_deliverables d
  where d.id = v_id;
  return result;
end;
$$;
revoke all on function public.submit_deliverable_with_attachments(uuid, uuid, text, text, jsonb, text[], timestamptz) from public, anon;
grant execute on function public.submit_deliverable_with_attachments(uuid, uuid, text, text, jsonb, text[], timestamptz) to authenticated;

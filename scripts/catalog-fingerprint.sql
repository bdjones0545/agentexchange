-- Catalog fingerprint: one row per fact group, `kind | key | md5`.
--
-- Run the same text against production (read-only) and against a database
-- built from supabase/schema.sql, then diff the two outputs. Equal rows mean
-- equal definitions; a row on one side only is an object the other lacks.
--
--   psql "$DATABASE_URL" -qAt -F '|' -f scripts/catalog-fingerprint.sql > live.txt
--
-- It covers public tables (RLS flags, columns, constraints, indexes, policies,
-- triggers, table grants), functions in public and policy_private (bodies,
-- SECURITY DEFINER, settings, return type, EXECUTE grants), views and enums.
-- Function bodies are compared without `--` comments or whitespace, index
-- names are ignored (only definitions count) and every ordering uses the "C"
-- collation, so the hash does not depend on the server's locale.
with
tbl as (
  select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p')
),
ext_objs as (select objid from pg_depend where deptype = 'e'),
facts as (
  select 'table'::text kind, t.relname::text key, md5('rls=' || t.relrowsecurity || ',force=' || t.relforcerowsecurity) h from tbl t
  union all
  select 'columns', t.relname, md5(string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), ''), '|' order by a.attname::text collate "C"))
  from tbl t join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = t.oid and d.adnum = a.attnum group by t.relname
  union all
  select 'constraints', t.relname, md5(string_agg(c.contype::text || ':' || pg_get_constraintdef(c.oid), '|' order by (c.contype::text || ':' || pg_get_constraintdef(c.oid)) collate "C"))
  from tbl t join pg_constraint c on c.conrelid = t.oid group by t.relname
  union all
  select 'indexes', t.relname, md5(string_agg(regexp_replace(pg_get_indexdef(i.indexrelid), 'INDEX \S+ ON', 'INDEX ON'), '|' order by regexp_replace(pg_get_indexdef(i.indexrelid), 'INDEX \S+ ON', 'INDEX ON') collate "C"))
  from tbl t join pg_index i on i.indrelid = t.oid group by t.relname
  union all
  select 'policies', t.relname, md5(string_agg(p.polname || ':' || p.polcmd::text || ':' || p.polpermissive::text || ':' || coalesce((select string_agg(r.rolname, ',' order by r.rolname::text collate "C") from pg_roles r where r.oid = any(p.polroles)), 'public') || ':' || coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ':' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''), '|' order by p.polname::text collate "C"))
  from tbl t join pg_policy p on p.polrelid = t.oid group by t.relname
  union all
  select 'triggers', t.relname, md5(string_agg(pg_get_triggerdef(g.oid), '|' order by g.tgname::text collate "C"))
  from tbl t join pg_trigger g on g.tgrelid = t.oid and not g.tgisinternal group by t.relname
  union all
  select 'grants', t.relname, md5(coalesce(string_agg(x.grantee || ':' || x.privilege_type, '|' order by (x.grantee || ':' || x.privilege_type)::text collate "C"), ''))
  from tbl t left join information_schema.role_table_grants x on x.table_schema = 'public' and x.table_name = t.relname and x.grantee in ('anon','authenticated','service_role')
  group by t.relname
  union all
  select 'function', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         md5(btrim(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', ' ', 'g')) || ':secdef=' || p.prosecdef || ':cfg=' || coalesce(array_to_string(p.proconfig, ','), '') || ':ret=' || pg_get_function_result(p.oid))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','policy_private') and p.oid not in (select objid from ext_objs)
  union all
  select 'function_grant', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         md5(coalesce(array_to_string(array(select r.rolname::text from pg_roles r where r.rolname in ('anon','authenticated','service_role') and has_function_privilege(r.oid, p.oid, 'EXECUTE') order by r.rolname::text collate "C"), ','), ''))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','policy_private') and p.oid not in (select objid from ext_objs)
  union all
  select 'schema', n.nspname, md5(n.nspname) from pg_namespace n where n.nspname in ('public','policy_private')
  union all
  select 'view', c.relname, md5(pg_get_viewdef(c.oid)) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('v','m')
  union all
  select 'enum', t.typname, md5(string_agg(e.enumlabel, ',' order by e.enumsortorder)) from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' group by t.typname
)
select kind, key, h from facts order by kind collate "C", key collate "C";

# AgentExchange PR69 release gate repair (local only)

Base: bdjones0545/agentexchange PR69 head b7ef4ac5be9767cfcc5e9fb4886a8e3e9b129e58,
verified October 25, 2026. Main remains b772b2f4f924175eaabdc11ce55a2027c035fe39.

## Implemented

- Add only service_role EXECUTE on public.resolve_agent_api_key(text) to the
  schema and PR69's existing, not-yet-merged forward migration. Existing revokes
  for PUBLIC, anon and authenticated are preserved. No direct profiles SELECT
  grant is needed: the existing SECURITY DEFINER resolver supplies that lookup.
- Add nine isolated PostgreSQL/WASM tests with no default table privileges and
  no blanket grants. Cover anonymous hydration, private-data exclusion, owner
  boundaries, billing-column guards, ledger writes, resolver access/revocation,
  migration idempotency and a negative control against the ungranted bootstrap.
- Add a separate CI job with a pinned, integrity-locked PGlite test runtime;
  application dependencies and existing RLS-only tests remain unchanged.

## Evidence

Before fix, the fetched PR69 schema and migration fail 3 of 9 tests with SQLSTATE
42501: permission denied for function resolve_agent_api_key. With the narrow
EXECUTE grant, 9 of 9 pass. An actual synthetic valid key resolves for service_role
without direct profile-table access; revoked and unknown keys return no rows.
Anonymous and authenticated roles remain denied the resolver.

Run from the repository root:

    npm ci --prefix tests/grant-runtime --ignore-scripts --no-audit --no-fund
    node --test tests/fresh-schema-grants.test.mjs

This is in-memory PostgreSQL/WASM, not hosted Supabase/PostgREST/JWT or a production
probe. The only schema adaptation removes CREATE EXTENSION pgcrypto because the
runtime has gen_random_uuid built in. No project URL, key, live money or external
service is used. The lack of function default grants is a clean-setup scenario,
not a claimed consequence of the October 30 TABLE-default change. Existing
production function ACLs were not queried and no production outage is asserted.

## Still required before release

- Review and publish this as a delta on PR69, not alongside the old full grants
  patch. No publication, merge, migration application or deployment was done.
- Resolve the separate dependency-audit CI failure. Oct22 CI passed app tests,
  diagnostics, build and database authorization, but failed dependency auditing.
- Run hosted isolated Supabase/JWT integration where appropriate and verify the
  approved deployment's source/configuration. Do not use a production-shared
  preview for synthetic writes.

Sources:
https://github.com/bdjones0545/agentexchange/pull/69
https://github.com/bdjones0545/agentexchange/actions/runs/39849085454
https://supabase.com/docs/guides/api/securing-your-api


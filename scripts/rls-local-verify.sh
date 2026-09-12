#!/usr/bin/env bash
# Proves the RLS + trigger authorization boundary in supabase/schema.sql on a
# plain local Postgres, without Docker or the Supabase CLI.
#
# It stubs the parts GoTrue/PostgREST provide (auth schema, auth.uid(), the
# anon/authenticated/service_role roles), applies the real schema, then runs
# attack and legitimate-path checks as three authenticated actors:
#   A = organization side, B = agent operator, C = unrelated user.
#
# Every attack asserts the forbidden state is UNCHANGED afterwards, not merely
# that an error came back. Exit 0 only when every check passes.
#
# Usage: PGPORT=5432 PGUSER=postgres scripts/rls-local-verify.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}" PGHOST="${PGHOST:-/tmp}"
DB="agentexchange_rls_verify_$$"
# Override to run the same checks against another schema (e.g. the vulnerable
# baseline) and confirm the attack checks actually FAIL there.
SCHEMA="${SCHEMA:-supabase/schema.sql}"
psql -d postgres -qc "create database $DB" >/dev/null
trap 'psql -d postgres -qc "drop database if exists $DB" >/dev/null' EXIT

psql -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
-- ---- GoTrue / PostgREST stub ------------------------------------------
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
SQL

psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$SCHEMA"

psql -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
-- Grants must be issued AFTER every table exists (a missing grant makes an
-- attack fail with "permission denied" and look blocked).
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

create table verify_results (name text, kind text, passed boolean, detail text);

create or replace function act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;
create or replace function act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;
create or replace function act_as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

-- Actors: the on_auth_user_created trigger materializes profiles.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.invalid', '{"account_type":"Organization","display_name":"Actor A"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.invalid', '{"account_type":"Agent Operator","display_name":"Actor B"}'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'c@test.invalid', '{"account_type":"Agent Operator","display_name":"Actor C"}');
SQL

# The checks. Each runs in its own transaction so a raised exception in an
# attack does not poison the next check.
run_check () {
  local name="$1" kind="$2" sql="$3" verify="$4" expected="$5"
  local outcome actual
  set +e
  outcome=$(psql -d "$DB" -qAt -c "$sql" 2>&1 | tail -1)
  set -e
  actual=$(psql -d "$DB" -qAt -c "$verify" 2>/dev/null | tail -1)
  if [ "$actual" = "$expected" ]; then
    echo "  PASS  [$kind] $name -- state=$actual"
  else
    echo "  FAIL  [$kind] $name -- state=$actual expected=$expected outcome=$outcome"
    FAILED=1
  fi
}
FAILED=0
A=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa; B=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb; C=cccccccc-cccc-4ccc-8ccc-cccccccccccc
PA=$(psql -d "$DB" -qAt -c "select id from profiles where user_id='$A'")
PB=$(psql -d "$DB" -qAt -c "select id from profiles where user_id='$B'")

# --- Seed as the real app would: A posts (org + opportunity), B publishes an agent.
psql -d "$DB" -v ON_ERROR_STOP=1 -qAt <<SQL >/dev/null
select act_as('$A');
insert into organizations (id, name, industry) values ('11111111-1111-4111-8111-111111111111', 'Acme', 'Research');
insert into opportunities (id, organization_id, organization_name, title, category) values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Acme', 'Market memo', 'Research');
select act_as('$B');
insert into agents (id, name, specialty) values ('33333333-3333-4333-8333-333333333333', 'Scout', 'Research');
select act_as('$C');
insert into agents (id, name, specialty) values ('99999999-9999-4999-8999-999999999999', 'Intruder', 'Research');
SQL
run_check "S1 defaults resolve owner_id from the session (org owned by A, agent by B)" legit "select 1" \
  "select (select owner_id from organizations where id='11111111-1111-4111-8111-111111111111')='$PA' and (select owner_id from agents where id='33333333-3333-4333-8333-333333333333')='$PB'" "t"

# --- Applications
psql -d "$DB" -qAt -c "select act_as('$B'); insert into applications (id, opportunity_id, agent_id, agent_name, proposal) values ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','Scout','Hire me');" >/dev/null
run_check "L1 B can apply to A's opportunity" legit "select 1" "select count(*) from applications where id='44444444-4444-4444-8444-444444444444'" "1"
run_check "A1 B cannot accept B's own application" attack \
  "select act_as('$B'); update applications set status='accepted' where id='44444444-4444-4444-8444-444444444444';" \
  "select status from applications where id='44444444-4444-4444-8444-444444444444'" "pending"
run_check "A2 B cannot rewrite application owner_id" attack \
  "select act_as('$B'); update applications set owner_id='$PA' where id='44444444-4444-4444-8444-444444444444';" \
  "select owner_id from applications where id='44444444-4444-4444-8444-444444444444'" "$PB"
run_check "A3 B cannot rewrite application agent_id" attack \
  "select act_as('$B'); update applications set agent_id='99999999-9999-4999-8999-999999999999' where id='44444444-4444-4444-8444-444444444444';" \
  "select agent_id from applications where id='44444444-4444-4444-8444-444444444444'" "33333333-3333-4333-8333-333333333333"
run_check "A5 C cannot mutate the A/B application" attack \
  "select act_as('$C'); update applications set status='rejected' where id='44444444-4444-4444-8444-444444444444';" \
  "select status from applications where id='44444444-4444-4444-8444-444444444444'" "pending"
run_check "A12 B cannot manufacture a contract naming A's organization" attack \
  "select act_as('$B'); insert into contracts (organization_id, agent_id, organization_name, agent_name, title) values ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Acme','Scout','Forged');" \
  "select count(*) from contracts" "0"
run_check "L2 A accepts B's application and creates the contract (org side)" legit \
  "select act_as('$A'); insert into contracts (organization_id, agent_id, organization_name, agent_name, title, source_id, source_type) values ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Acme','Scout','Market memo','44444444-4444-4444-8444-444444444444','application'); update applications set status='accepted' where id='44444444-4444-4444-8444-444444444444';" \
  "select (select status from applications where id='44444444-4444-4444-8444-444444444444') || ':' || (select count(*) from contracts where source_id='44444444-4444-4444-8444-444444444444')" "accepted:1"
run_check "A14 B cannot re-point the contract at another agent (parties immutable)" attack \
  "select act_as('$B'); update contracts set agent_id='99999999-9999-4999-8999-999999999999' where source_id='44444444-4444-4444-8444-444444444444';" \
  "select agent_id from contracts where source_id='44444444-4444-4444-8444-444444444444'" "33333333-3333-4333-8333-333333333333"
run_check "L15 agent side B can read the contract" legit "select 1" \
  "select act_as('$B'); select count(*) from contracts" "1"
run_check "A13 unrelated C cannot read the contract" attack "select 1" \
  "select act_as('$C'); select count(*) from contracts" "0"

# --- Negotiations
psql -d "$DB" -qAt -c "select act_as('$B'); insert into negotiations (id, opportunity_id, agent_id, agent_name, rate, timeline) values ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','Scout','\$5k','2 weeks');" >/dev/null
run_check "A6 B cannot perform org-side negotiation acceptance" attack \
  "select act_as('$B'); update negotiations set status='accepted' where id='55555555-5555-4555-8555-555555555555';" \
  "select status from negotiations where id='55555555-5555-4555-8555-555555555555'" "pending"
run_check "L3 A can counter a negotiation" legit \
  "select act_as('$A'); update negotiations set status='countered', counter_rate='\$4k' where id='55555555-5555-4555-8555-555555555555';" \
  "select status from negotiations where id='55555555-5555-4555-8555-555555555555'" "countered"
run_check "L4 A can accept the countered negotiation" legit \
  "select act_as('$A'); update negotiations set status='accepted' where id='55555555-5555-4555-8555-555555555555';" \
  "select status from negotiations where id='55555555-5555-4555-8555-555555555555'" "accepted"
run_check "A15 accepted negotiation is terminal even for A" attack \
  "select act_as('$A'); update negotiations set status='rejected' where id='55555555-5555-4555-8555-555555555555';" \
  "select status from negotiations where id='55555555-5555-4555-8555-555555555555'" "accepted"

# --- Hire requests + materialization
psql -d "$DB" -qAt -c "select act_as('$A'); insert into hire_requests (id, agent_id, opportunity_id, agent_name, opportunity_title) values ('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','Scout','Market memo');" >/dev/null
run_check "L5 A can issue a hire request for B's agent" legit "select 1" "select count(*) from hire_requests where id='66666666-6666-4666-8666-666666666666'" "1"
run_check "A10 A cannot accept the hire request on the agent's behalf" attack \
  "select act_as('$A'); update hire_requests set status='accepted' where id='66666666-6666-4666-8666-666666666666';" \
  "select status from hire_requests where id='66666666-6666-4666-8666-666666666666'" "pending"
run_check "M2 B cannot materialize from an UNACCEPTED hire request" attack \
  "select act_as('$B'); select materialize_hire_request_contract('66666666-6666-4666-8666-666666666666');" \
  "select count(*) from contracts where source_id='66666666-6666-4666-8666-666666666666'" "0"
run_check "L6 owning agent B accepts the hire request" legit \
  "select act_as('$B'); update hire_requests set status='accepted' where id='66666666-6666-4666-8666-666666666666';" \
  "select status from hire_requests where id='66666666-6666-4666-8666-666666666666'" "accepted"
run_check "M4 C cannot materialize an accepted hire request" attack \
  "select act_as('$C'); select materialize_hire_request_contract('66666666-6666-4666-8666-666666666666');" \
  "select count(*) from contracts where source_id='66666666-6666-4666-8666-666666666666'" "0"
run_check "M7 anon cannot even call materialize" attack \
  "select act_as_anon(); select materialize_hire_request_contract('66666666-6666-4666-8666-666666666666');" \
  "select count(*) from contracts where source_id='66666666-6666-4666-8666-666666666666'" "0"
run_check "L10 B materializes the contract through the secure path" legit \
  "select act_as('$B'); select materialize_hire_request_contract('66666666-6666-4666-8666-666666666666');" \
  "select organization_id || ':' || agent_id from contracts where source_id='66666666-6666-4666-8666-666666666666'" "11111111-1111-4111-8111-111111111111:33333333-3333-4333-8333-333333333333"
run_check "L14 retry is idempotent (no duplicate contract)" legit \
  "select act_as('$B'); select materialize_hire_request_contract('66666666-6666-4666-8666-666666666666');" \
  "select count(*) from contracts where source_id='66666666-6666-4666-8666-666666666666'" "1"
# M5: B self-issues a hire request naming A's opportunity, accepts it, tries to materialize.
psql -d "$DB" -qAt -c "select act_as('$B'); insert into hire_requests (id, agent_id, opportunity_id, agent_name, opportunity_title) values ('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','Scout','Self issued'); update hire_requests set status='accepted' where id='77777777-7777-4777-8777-777777777777';" >/dev/null
run_check "M5 B cannot bind A's organization via a self-issued hire request" attack \
  "select act_as('$B'); select materialize_hire_request_contract('77777777-7777-4777-8777-777777777777');" \
  "select count(*) from contracts where source_id='77777777-7777-4777-8777-777777777777'" "0"

# --- Contract workspace and activity events
CID=$(psql -d "$DB" -qAt -c "select id from contracts where source_id='66666666-6666-4666-8666-666666666666'")
run_check "L16 agent side can add a milestone to its contract" legit \
  "select act_as('$B'); insert into contract_milestones (contract_id, title) values ('$CID','Outline');" \
  "select count(*) from contract_milestones where contract_id='$CID'" "1"
run_check "A16 C cannot add a milestone to a contract it is not party to" attack \
  "select act_as('$C'); insert into contract_milestones (contract_id, title) values ('$CID','Intrusion');" \
  "select count(*) from contract_milestones where contract_id='$CID'" "1"
run_check "A17 C cannot read the contract's messages" attack \
  "select act_as('$B'); insert into contract_messages (contract_id, sender_type, author, body) values ('$CID','Agent','Scout','hello');" \
  "select act_as('$C'); select count(*) from contract_messages where contract_id='$CID'" "0"
run_check "L18 organization side A can read the agent's message" legit "select 1" \
  "select act_as('$A'); select count(*) from contract_messages where contract_id='$CID'" "1"
run_check "A18 B cannot write an activity event owned by someone else" attack \
  "select act_as('$B'); insert into activity_events (owner_id, actor_type, entity_type, event_type, message) values ('$PA','agent','agent','status_changed','forged');" \
  "select count(*) from activity_events where message='forged'" "0"
run_check "L17 an agent timeline event is publicly readable" legit \
  "select act_as('$B'); insert into activity_events (actor_type, actor_id, entity_type, entity_id, event_type, message) values ('agent','33333333-3333-4333-8333-333333333333','agent','33333333-3333-4333-8333-333333333333','application_submitted','Scout applied.');" \
  "select act_as_anon(); select count(*) from activity_events where message='Scout applied.'" "1"
run_check "A19 anon cannot read A's private workspace snapshot-style event" attack \
  "select act_as('$A'); insert into activity_events (event_type, message, metadata) values ('agentexchange_state_snapshot','private','{}');" \
  "select act_as_anon(); select count(*) from activity_events where message='private'" "0"
run_check "A20 anon cannot execute the security-definer helpers" attack \
  "select act_as_anon(); select is_agent_owner('33333333-3333-4333-8333-333333333333');" \
  "select has_function_privilege('anon','public.is_agent_owner(uuid)','execute') or has_function_privilege('anon','public.can_access_contract(uuid)','execute')" "f"
run_check "L19 authenticated keeps EXECUTE on the helpers the policies call" legit "select 1" \
  "select has_function_privilege('authenticated','public.is_agent_owner(uuid)','execute') and has_function_privilege('anon','public.current_profile_id()','execute')" "t"

echo
if [ "$FAILED" -ne 0 ]; then echo "RLS LOCAL VERIFY: FAILED"; exit 1; fi
echo "RLS LOCAL VERIFY: ALL CHECKS PASSED"

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

# Storage stub (buckets + objects with RLS), then the schema, then the newest
# migration again: reapplying it over the full schema must be a no-op.
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f scripts/supabase-storage-stub.sql
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$SCHEMA"
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f supabase/migrations/20261015120000_deliverable_attachments.sql

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
# (Since 2026-09-16 the insert itself is refused — see R4 — so this seed may fail; the
# materialize check below must still see zero contracts either way.)
psql -d "$DB" -qAt -c "select act_as('$B'); insert into hire_requests (id, agent_id, opportunity_id, agent_name, opportunity_title) values ('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','Scout','Self issued'); update hire_requests set status='accepted' where id='77777777-7777-4777-8777-777777777777';" >/dev/null 2>&1 || true
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


# --- 2026-09-16 audit: record creation must name a party the caller owns ---
PC=$(psql -d "$DB" -qAt -c "select id from profiles where user_id='$C'")
psql -d "$DB" -qAt -c "select act_as('$C'); insert into agents (id, name, specialty) values ('99999999-9999-4999-8999-999999999999','Intruder','Research') on conflict (id) do nothing;" >/dev/null
run_check "R1  B cannot forge an application naming C's agent" attack \
  "select act_as('$B'); insert into applications (id, opportunity_id, agent_id, agent_name, proposal) values ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1','22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999','Intruder','forged');" \
  "select count(*) from applications where id='a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'" "0"
run_check "R2  B cannot open a negotiation naming C's agent" attack \
  "select act_as('$B'); insert into negotiations (id, opportunity_id, agent_id, agent_name, rate) values ('a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2','22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999','Intruder','x');" \
  "select count(*) from negotiations where id='a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2'" "0"
run_check "R3  B cannot post an opportunity under A's organization" attack \
  "select act_as('$B'); insert into opportunities (id, organization_id, organization_name, title, category) values ('a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3','11111111-1111-4111-8111-111111111111','Acme','Impersonated','Research');" \
  "select count(*) from opportunities where id='a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3'" "0"
run_check "R4  B cannot issue a hire request against A's opportunity" attack \
  "select act_as('$B'); insert into hire_requests (id, agent_id, opportunity_id, agent_name, opportunity_title) values ('a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4','33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','Scout','spam');" \
  "select count(*) from hire_requests where id='a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4'" "0"
run_check "R5  A cannot create a contract binding an agent that never applied" attack \
  "select act_as('$A'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title) values ('a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5','11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999','Acme','Intruder','Unilateral');" \
  "select count(*) from contracts where id='a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5'" "0"
run_check "R6  A cannot create a second contract for the same application" attack \
  "select act_as('$A'); insert into contracts (organization_id, agent_id, organization_name, agent_name, title, source_id, source_type) values ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Acme','Scout','Dup','44444444-4444-4444-8444-444444444444','application');" \
  "select count(*) from contracts where source_id='44444444-4444-4444-8444-444444444444'" "1"

# --- trust signals are platform-managed ---
run_check "T1  new agents start Unverified with trust 0 even if the insert claims otherwise" legit \
  "select act_as('$B'); insert into agents (id, name, specialty, trust_score, verification_status, revenue, success_rate) values ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1','Braggart','x',100,'Enterprise Verified','\$9M','100%');" \
  "select verification_status||'/'||trust_score||'/'||revenue||'/'||success_rate from agents where id='b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1'" "Unverified/0.00/\$0/New"
run_check "T2  owner cannot raise its own trust score or verification" attack \
  "select act_as('$B'); update agents set trust_score=100, verification_status='Enterprise Verified' where id='33333333-3333-4333-8333-333333333333';" \
  "select verification_status||'/'||trust_score from agents where id='33333333-3333-4333-8333-333333333333'" "Unverified/0.00"
run_check "T3  owner can still edit its agent's description" legit \
  "select act_as('$B'); update agents set description='edited' where id='33333333-3333-4333-8333-333333333333';" \
  "select description from agents where id='33333333-3333-4333-8333-333333333333'" "edited"
run_check "T4  organization owner cannot mark itself verified" attack \
  "select act_as('$A'); update organizations set verified=true, rating=5 where id='11111111-1111-4111-8111-111111111111';" \
  "select verified::text||'/'||rating from organizations where id='11111111-1111-4111-8111-111111111111'" "false/0.00"

# --- reviews are organization-side, attributed, one per contract ---
run_check "V1  agent cannot review itself" attack \
  "select act_as('$B'); insert into reviews (contract_id, agent_id, agent_name, organization_name, rating, review) values ('$CID','33333333-3333-4333-8333-333333333333','Scout','Acme',5,'self');" \
  "select count(*) from reviews where contract_id='$CID'" "0"
run_check "V2  organization can review the contracted agent, attributed to itself" legit \
  "select act_as('$A'); insert into reviews (contract_id, agent_id, agent_name, organization_name, rating, review) values ('$CID','33333333-3333-4333-8333-333333333333','Scout','Acme',4,'good');" \
  "select count(*)||':'||(reviewer_id='$PA')::text from reviews where contract_id='$CID' group by reviewer_id" "1:true"
run_check "V3  organization cannot review a different agent on that contract" attack \
  "select act_as('$A'); insert into reviews (contract_id, agent_id, agent_name, organization_name, rating, review) values ('$CID','99999999-9999-4999-8999-999999999999','Intruder','Acme',1,'wrong agent');" \
  "select count(*) from reviews where contract_id='$CID'" "1"
run_check "V4  second review on the same contract is refused" attack \
  "select act_as('$A'); insert into reviews (contract_id, agent_id, agent_name, organization_name, rating, review) values ('$CID','33333333-3333-4333-8333-333333333333','Scout','Acme',5,'again');" \
  "select count(*) from reviews where contract_id='$CID'" "1"

# --- approvals and completion are organization-side; disputes resolved by complainant ---
psql -d "$DB" -qAt -c "select act_as('$B'); insert into contract_deliverables (id, contract_id, title, status) values ('d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1','$CID','Draft','submitted');" >/dev/null
run_check "W1  agent cannot approve its own deliverable" attack \
  "select act_as('$B'); update contract_deliverables set status='approved', approved_at=now() where id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1';" \
  "select status from contract_deliverables where id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1'" "submitted"
run_check "W2  agent cannot insert a deliverable born approved" attack \
  "select act_as('$B'); insert into contract_deliverables (id, contract_id, title, status, approved_at) values ('d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2','$CID','Sneaky','approved',now());" \
  "select count(*) from contract_deliverables where id='d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2'" "0"
run_check "W3  organization approves the deliverable" legit \
  "select act_as('$A'); update contract_deliverables set status='approved', approved_at=now(), decisions='[{\"status\":\"approved\"}]'::jsonb where id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1';" \
  "select status from contract_deliverables where id='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1'" "approved"
run_check "W4  agent cannot mark a milestone complete" attack \
  "select act_as('$B'); update contract_milestones set completed=true, completed_at=now() where contract_id='$CID';" \
  "select bool_or(completed)::text from contract_milestones where contract_id='$CID'" "false"
run_check "W5  organization marks the milestone complete" legit \
  "select act_as('$A'); update contract_milestones set completed=true, completed_at=now() where contract_id='$CID';" \
  "select bool_or(completed)::text from contract_milestones where contract_id='$CID'" "true"
psql -d "$DB" -qAt -c "select act_as('$A'); insert into disputes (id, contract_id, reason) values ('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1','$CID','late');" >/dev/null
run_check "X1  the accused agent cannot resolve a dispute against it" attack \
  "select act_as('$B'); update disputes set status='Resolved' where id='e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1';" \
  "select status from disputes where id='e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1'" "Open"
run_check "X2  the agent can mark it under review" legit \
  "select act_as('$B'); update disputes set status='Under Review' where id='e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1';" \
  "select status from disputes where id='e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1'" "Under Review"
run_check "X3  the complainant resolves it" legit \
  "select act_as('$A'); update disputes set status='Resolved' where id='e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1';" \
  "select status from disputes where id='e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1'" "Resolved"

# --- Payments phase 0 (P checks): stated once, then platform-managed; ledger is read-only.
psql -d "$DB" -qAt -c "select act_as('$A'); insert into hire_requests (id, agent_id, agent_name, opportunity_id, opportunity_title, amount_cents, currency) values ('aaaa1111-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','Scout','22222222-2222-4222-8222-222222222222','Market memo', 60000, 'usd');" >/dev/null
run_check "P1  A offers a price on a hire request; currency is normalised" legit "select 1" \
  "select amount_cents::text || ' ' || currency from hire_requests where id='aaaa1111-0000-4000-8000-000000000001'" "60000 USD"
run_check "P2  A cannot change the offered price after issuing it" attack \
  "select act_as('$A'); update hire_requests set amount_cents=10000 where id='aaaa1111-0000-4000-8000-000000000001';" \
  "select amount_cents from hire_requests where id='aaaa1111-0000-4000-8000-000000000001'" "60000"
run_check "P3  B cannot raise the offered price either" attack \
  "select act_as('$B'); update hire_requests set amount_cents=99900 where id='aaaa1111-0000-4000-8000-000000000001';" \
  "select amount_cents from hire_requests where id='aaaa1111-0000-4000-8000-000000000001'" "60000"
psql -d "$DB" -qAt -c "select act_as('$B'); update hire_requests set status='accepted' where id='aaaa1111-0000-4000-8000-000000000001'; select materialize_hire_request_contract('aaaa1111-0000-4000-8000-000000000001');" >/dev/null
run_check "P4  materialize copies the offer onto the contract, unfunded, at the current fee" legit "select 1" \
  "select amount_cents::text || ' ' || currency || ' ' || payment_status || ' ' || platform_fee_bps::text from contracts where source_id='aaaa1111-0000-4000-8000-000000000001'" "60000 USD unfunded 1500"
MC=$(psql -d "$DB" -qAt -c "select id from contracts where source_id='aaaa1111-0000-4000-8000-000000000001'")
run_check "P5  the organization cannot re-price the contract" attack \
  "select act_as('$A'); update contracts set amount_cents=1 where id='$MC';" \
  "select amount_cents from contracts where id='$MC'" "60000"
run_check "P6  the agent cannot mark the contract paid" attack \
  "select act_as('$B'); update contracts set payment_status='captured' where id='$MC';" \
  "select payment_status from contracts where id='$MC'" "unfunded"
run_check "P7  nobody can lower their own fee" attack \
  "select act_as('$B'); update contracts set platform_fee_bps=0 where id='$MC';" \
  "select platform_fee_bps from contracts where id='$MC'" "1500"
psql -d "$DB" -qAt -c "select act_as('$B'); insert into applications (id, opportunity_id, agent_id, agent_name, proposal) values ('aaaa1111-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','Scout','Second brief');" >/dev/null
run_check "P8  a contract inserted with payment_status=captured is born unfunded anyway" legit \
  "select act_as('$A'); insert into contracts (id, organization_id, agent_id, source_type, source_id, organization_name, agent_name, title, amount_cents, payment_status, platform_fee_bps) values ('aaaa1111-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','application','aaaa1111-0000-4000-8000-000000000004','Acme','Scout','Memo', 5000, 'captured', 0);" \
  "select coalesce((select payment_status || ' ' || platform_fee_bps::text from contracts where id='aaaa1111-0000-4000-8000-000000000002'), 'not created')" "unfunded 1500"
run_check "P9  the agent cannot write a payout to itself" attack \
  "select act_as('$B'); insert into payouts (contract_id, agent_id, operator_profile_id, gross_cents, fee_cents, net_cents) values ('$MC','33333333-3333-4333-8333-333333333333','$PB',60000,0,60000);" \
  "select count(*) from payouts" "0"
run_check "P10 the organization cannot record a payment" attack \
  "select act_as('$A'); insert into payments (contract_id, kind, amount_cents, status) values ('$MC','charge',60000,'captured');" \
  "select count(*) from payments" "0"
psql -d "$DB" -qAt -c "select act_as_admin(); insert into payments (id, contract_id, kind, amount_cents, status) values ('aaaa1111-0000-4000-8000-000000000003','$MC','charge',60000,'captured');" >/dev/null
run_check "P11a the platform's payment is readable by the organization" legit "select 1" \
  "select act_as('$A'); select count(*) from payments where contract_id='$MC'" "1"
run_check "P11b ...and by the agent operator" legit "select 1" \
  "select act_as('$B'); select count(*) from payments where contract_id='$MC'" "1"
run_check "P11c ...but not by an unrelated user" attack "select 1" \
  "select act_as('$C'); select count(*) from payments where contract_id='$MC'" "0"
run_check "P12 neither party can delete the ledger" attack \
  "select act_as('$A'); delete from payments where id='aaaa1111-0000-4000-8000-000000000003';" \
  "select act_as_admin(); select count(*) from payments" "1"

# --- Agent API keys (K checks): operator-owned, hash write-once, revocation irreversible, resolver private.
psql -d "$DB" -qAt -c "select act_as('$B'); insert into agent_api_keys (id, name, key_hash, key_prefix) values ('bbbb1111-0000-4000-8000-000000000001','prod','hash-b-1','axk_bbbbbbbb');" >/dev/null
run_check "K1  B mints a key; profile_id defaults to B" legit "select 1" \
  "select profile_id from agent_api_keys where id='bbbb1111-0000-4000-8000-000000000001'" "$PB"
run_check "K2  C cannot see B's key" attack "select 1" \
  "select act_as('$C'); select count(*) from agent_api_keys" "0"
run_check "K3  B cannot change the hash of an existing key" attack \
  "select act_as('$B'); update agent_api_keys set key_hash='hash-b-2' where id='bbbb1111-0000-4000-8000-000000000001';" \
  "select key_hash from agent_api_keys where id='bbbb1111-0000-4000-8000-000000000001'" "hash-b-1"
run_check "K4  C cannot insert a key under B's profile" attack \
  "select act_as('$C'); insert into agent_api_keys (name, key_hash, key_prefix, profile_id) values ('steal','hash-c-1','axk_cccccccc','$PB');" \
  "select count(*) from agent_api_keys where key_hash='hash-c-1'" "0"
run_check "K5  the resolver is not callable by an authenticated user" attack \
  "select act_as('$B'); select * from resolve_agent_api_key('hash-b-1');" \
  "select act_as_admin(); select count(*) from resolve_agent_api_key('hash-b-1')" "1"
run_check "K6  B revokes the key; the resolver stops returning it" legit \
  "select act_as('$B'); update agent_api_keys set revoked_at=now() where id='bbbb1111-0000-4000-8000-000000000001';" \
  "select act_as_admin(); select count(*) from resolve_agent_api_key('hash-b-1')" "0"
run_check "K7  a revoked key cannot be un-revoked" attack \
  "select act_as('$B'); update agent_api_keys set revoked_at=null where id='bbbb1111-0000-4000-8000-000000000001';" \
  "select revoked_at is not null from agent_api_keys where id='bbbb1111-0000-4000-8000-000000000001'" "t"

# --- Negotiation loop (N checks): counters are the organization's; the agent accepts a counter; the RPC prices the contract.
psql -d "$DB" -qAt -c "select act_as('$B'); insert into negotiations (id, opportunity_id, agent_id, agent_name, rate, timeline, amount_cents, currency) values ('cccc1111-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','Scout','\$600','3 days', 60000, 'usd');" >/dev/null
run_check "N1  B proposes terms with a price; currency normalised, accepted_by empty" legit "select 1" \
  "select amount_cents::text || ' ' || currency || ' ' || coalesce(accepted_by,'-') from negotiations where id='cccc1111-0000-4000-8000-000000000001'" "60000 USD -"
run_check "N2  B cannot change the proposed price" attack \
  "select act_as('$B'); update negotiations set amount_cents=90000 where id='cccc1111-0000-4000-8000-000000000001';" \
  "select amount_cents from negotiations where id='cccc1111-0000-4000-8000-000000000001'" "60000"
run_check "N3  B cannot counter its own proposal" attack \
  "select act_as('$B'); update negotiations set status='countered', counter_amount_cents=70000 where id='cccc1111-0000-4000-8000-000000000001';" \
  "select status from negotiations where id='cccc1111-0000-4000-8000-000000000001'" "pending"
run_check "N4  B cannot accept its own pending proposal" attack \
  "select act_as('$B'); update negotiations set status='accepted' where id='cccc1111-0000-4000-8000-000000000001';" \
  "select status from negotiations where id='cccc1111-0000-4000-8000-000000000001'" "pending"
run_check "N5  A counters at 45000" legit \
  "select act_as('$A'); update negotiations set status='countered', counter_rate='\$450', counter_amount_cents=45000, counter_note='budget' where id='cccc1111-0000-4000-8000-000000000001';" \
  "select status || ' ' || counter_amount_cents::text from negotiations where id='cccc1111-0000-4000-8000-000000000001'" "countered 45000"
run_check "N6  C cannot accept the countered negotiation" attack \
  "select act_as('$C'); update negotiations set status='accepted' where id='cccc1111-0000-4000-8000-000000000001';" \
  "select status from negotiations where id='cccc1111-0000-4000-8000-000000000001'" "countered"
run_check "N7  B accepts the counter; accepted_by is recorded by the trigger, not the caller" legit \
  "select act_as('$B'); update negotiations set status='accepted', accepted_by='organization' where id='cccc1111-0000-4000-8000-000000000001';" \
  "select status || ' ' || accepted_by from negotiations where id='cccc1111-0000-4000-8000-000000000001'" "accepted agent"
run_check "N8  C cannot materialize it" attack \
  "select act_as('$C'); select materialize_negotiation_contract('cccc1111-0000-4000-8000-000000000001');" \
  "select count(*) from contracts where source_id='cccc1111-0000-4000-8000-000000000001'" "0"
run_check "N9  B materializes: contract priced at the COUNTER, unfunded, org derived from the opportunity" legit \
  "select act_as('$B'); select materialize_negotiation_contract('cccc1111-0000-4000-8000-000000000001');" \
  "select amount_cents::text || ' ' || payment_status || ' ' || organization_id::text from contracts where source_id='cccc1111-0000-4000-8000-000000000001'" "45000 unfunded 11111111-1111-4111-8111-111111111111"
run_check "N10 materializing again returns the same contract" legit \
  "select act_as('$A'); select materialize_negotiation_contract('cccc1111-0000-4000-8000-000000000001');" \
  "select count(*) from contracts where source_id='cccc1111-0000-4000-8000-000000000001'" "1"

# --- Deliverable attachments (F checks): a private bucket the contract's two sides
# read; only the agent side uploads and attaches, only to a draft, never on hold.
# An INSERT here is the check Storage runs before signing an upload URL; a SELECT
# is the check before signing a download URL.
BKT=deliverable-attachments
U=f0000000-0000-4000-8000-0000000000
q () { psql -d "$DB" -v ON_ERROR_STOP=1 -qAt -c "$1" >/dev/null; }
try () { psql -d "$DB" -qAt -c "$1" >/dev/null 2>&1 || true; }
obj () { echo "insert into storage.objects (bucket_id, name, owner_id, metadata) values ('$BKT', '$1', 'x', jsonb_build_object('size', $2, 'mimetype', '$3'));"; }
stored () { echo "select act_as_admin(); select count(*) from storage.objects where bucket_id='$BKT' and name like '$1%'"; }
attached () { echo "select act_as_admin(); select count(*) from contract_deliverable_attachments where deliverable_id='$1'"; }
P1="$CID/${U}01/report.pdf"
run_check "F1  the bucket is private, capped at 25 MB, and refuses HTML and SVG" legit "select 1" \
  "select public::text || ' ' || file_size_limit || ' ' || (not ('text/html' = any(allowed_mime_types) or 'image/svg+xml' = any(allowed_mime_types)))::text from storage.buckets where id='$BKT'" "false 26214400 true"
run_check "F2  agent side B uploads a file to its contract" legit \
  "select act_as('$B'); $(obj "$P1" 1024 application/pdf)" "$(stored "$P1")" "1"
run_check "F3  organization side A cannot upload into the contract" attack \
  "select act_as('$A'); $(obj "$CID/${U}02/org.pdf" 1024 application/pdf)" "$(stored "$CID/${U}02/")" "0"
run_check "F4  unrelated C cannot upload into the contract" attack \
  "select act_as('$C'); $(obj "$CID/${U}03/c.pdf" 1024 application/pdf)" "$(stored "$CID/${U}03/")" "0"
run_check "F5  anon cannot upload" attack \
  "select act_as_anon(); $(obj "$CID/${U}04/anon.pdf" 1024 application/pdf)" "$(stored "$CID/${U}04/")" "0"
for bad in "../escape.pdf" ".env" "nested/dir.pdf" "evil<script>.pdf" "a..b.pdf"; do
  try "select act_as('$B'); $(obj "$CID/${U}05/$bad" 1024 application/pdf)"
done
run_check "F6  B cannot upload a traversal, hidden, nested or unsanitised name" attack "select 1" "$(stored "$CID/${U}05/")" "0"
try "select act_as('$B'); $(obj "$(echo "$CID" | tr a-f A-F)/${U}05/upper.pdf" 1024 application/pdf)"
run_check "F6b B cannot upload under a second spelling of the contract id" attack "select 1" \
  "select act_as_admin(); select count(*) from storage.objects where bucket_id='$BKT' and name like '%upper.pdf'" "0"
run_check "F7  B cannot upload to a priced contract before it is funded" attack \
  "select act_as('$B'); $(obj "$MC/${U}06/early.pdf" 1024 application/pdf)" "$(stored "$MC/")" "0"
run_check "F8  organization side A can read the agent's file" legit "select 1" \
  "select act_as('$A'); select count(*) from storage.objects where name='$P1'" "1"
run_check "F9  agent side B can read its file" legit "select 1" \
  "select act_as('$B'); select count(*) from storage.objects where name='$P1'" "1"
run_check "F10 unrelated C cannot read or list the contract's files" attack "select 1" \
  "select act_as('$C'); select count(*) from storage.objects where bucket_id='$BKT'" "0"
run_check "F11 anon cannot read the contract's files" attack "select 1" \
  "select act_as_anon(); select count(*) from storage.objects where bucket_id='$BKT'" "0"
run_check "F12 B cannot overwrite a stored file" attack \
  "select act_as('$B'); update storage.objects set metadata=jsonb_build_object('size', 1, 'mimetype', 'text/html') where name='$P1';" \
  "select act_as_admin(); select metadata->>'mimetype' from storage.objects where name='$P1'" "application/pdf"
run_check "F13 B cannot delete a stored file" attack \
  "select act_as('$B'); delete from storage.objects where name='$P1';" "$(stored "$P1")" "1"
# A broad permissive policy added later (say, for a public avatars bucket) must not open this one.
q "create policy sim_broad_storage on storage.objects for all to authenticated using (true) with check (true);"
run_check "F14 with a broad storage policy present, C still cannot read the files" attack "select 1" \
  "select act_as('$C'); select count(*) from storage.objects where bucket_id='$BKT'" "0"
run_check "F15 ...C still cannot upload into the contract" attack \
  "select act_as('$C'); $(obj "$CID/${U}08/c.pdf" 1024 application/pdf)" "$(stored "$CID/${U}08/")" "0"
run_check "F16 ...and B still cannot delete its file" attack \
  "select act_as('$B'); delete from storage.objects where name='$P1';" "$(stored "$P1")" "1"
q "drop policy sim_broad_storage on storage.objects;"

DRAFT=f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1
q "select act_as('$B'); insert into contract_deliverables (id, contract_id, title, status) values ('$DRAFT','$CID','Report','draft');"
run_check "F20 organization side A cannot attach files to a deliverable" attack \
  "select act_as('$A'); insert into contract_deliverable_attachments (deliverable_id, storage_path) values ('$DRAFT','$P1');" "$(attached "$DRAFT")" "0"
run_check "F21 unrelated C cannot attach files" attack \
  "select act_as('$C'); insert into contract_deliverable_attachments (deliverable_id, storage_path) values ('$DRAFT','$P1');" "$(attached "$DRAFT")" "0"
run_check "F22 B cannot attach a file that was never uploaded" attack \
  "select act_as('$B'); insert into contract_deliverable_attachments (deliverable_id, storage_path) values ('$DRAFT','$CID/${U}09/missing.pdf');" "$(attached "$DRAFT")" "0"
q "$(obj "$MC/${U}10/other.pdf" 1024 application/pdf)"
run_check "F23 B cannot attach another contract's upload" attack \
  "select act_as('$B'); insert into contract_deliverable_attachments (deliverable_id, storage_path) values ('$DRAFT','$MC/${U}10/other.pdf');" "$(attached "$DRAFT")" "0"
q "$(obj "$CID/${U}11/page.pdf" 1024 text/html)"
run_check "F24 B cannot attach a file whose stored type is not allowed" attack \
  "select act_as('$B'); insert into contract_deliverable_attachments (deliverable_id, storage_path) values ('$DRAFT','$CID/${U}11/page.pdf');" "$(attached "$DRAFT")" "0"
q "$(obj "$CID/${U}12/huge.pdf" 26214401 application/pdf)"
run_check "F25 B cannot attach a file over 25 MB" attack \
  "select act_as('$B'); insert into contract_deliverable_attachments (deliverable_id, storage_path) values ('$DRAFT','$CID/${U}12/huge.pdf');" "$(attached "$DRAFT")" "0"
run_check "F26 B attaches its upload; name, type and size come from storage, not the caller" legit \
  "select act_as('$B'); insert into contract_deliverable_attachments (deliverable_id, contract_id, storage_path, file_name, content_type, size_bytes) values ('$DRAFT','$MC','$P1','setup.exe','application/x-msdownload',1);" \
  "select file_name || ' ' || content_type || ' ' || size_bytes || ' ' || (contract_id='$CID')::text || ' ' || (uploaded_by='$PB')::text from contract_deliverable_attachments where storage_path='$P1'" "report.pdf application/pdf 1024 true true"
run_check "F27 organization side A can see the attachment" legit "select 1" \
  "select act_as('$A'); select count(*) from contract_deliverable_attachments where deliverable_id='$DRAFT'" "1"
run_check "F28 unrelated C cannot see it" attack "select 1" \
  "select act_as('$C'); select count(*) from contract_deliverable_attachments" "0"
run_check "F29 attachment records are immutable" attack \
  "select act_as('$B'); update contract_deliverable_attachments set storage_path='$CID/${U}11/page.pdf', size_bytes=1 where deliverable_id='$DRAFT';" \
  "select storage_path || ' ' || size_bytes from contract_deliverable_attachments where deliverable_id='$DRAFT'" "$P1 1024"
DRAFT2=f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2
q "select act_as('$B'); insert into contract_deliverables (id, contract_id, title, status) values ('$DRAFT2','$CID','Second','draft');"
run_check "F30 one upload cannot be attached to two deliverables" attack \
  "select act_as('$B'); insert into contract_deliverable_attachments (deliverable_id, storage_path) values ('$DRAFT2','$P1');" "$(attached "$DRAFT2")" "0"
q "insert into storage.objects (bucket_id, name, owner_id, metadata) select '$BKT', '$CID/${U}' || n || '/part.pdf', 'x', jsonb_build_object('size', 10, 'mimetype', 'application/pdf') from generate_series(13, 22) n;"
q "select act_as('$B'); insert into contract_deliverable_attachments (deliverable_id, storage_path) select '$DRAFT', '$CID/${U}' || n || '/part.pdf' from generate_series(13, 21) n;"
run_check "F31 a deliverable carries at most 10 files" attack \
  "select act_as('$B'); insert into contract_deliverable_attachments (deliverable_id, storage_path) values ('$DRAFT','$CID/${U}22/part.pdf');" "$(attached "$DRAFT")" "10"
run_check "F32 B removes files from its draft" legit \
  "select act_as('$B'); delete from contract_deliverable_attachments where deliverable_id='$DRAFT' and file_name='part.pdf';" "$(attached "$DRAFT")" "1"
run_check "F33 organization side A cannot remove the agent's files" attack \
  "select act_as('$A'); delete from contract_deliverable_attachments where deliverable_id='$DRAFT';" "$(attached "$DRAFT")" "1"
q "select act_as('$A'); insert into disputes (id, contract_id, reason) values ('e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2','$CID','missing appendix');"
run_check "F34 B cannot upload while a dispute is open" attack \
  "select act_as('$B'); $(obj "$CID/${U}23/held.pdf" 1024 application/pdf)" "$(stored "$CID/${U}23/")" "0"
q "$(obj "$CID/${U}24/held.pdf" 1024 application/pdf)"
run_check "F35 B cannot attach while a dispute is open" attack \
  "select act_as('$B'); insert into contract_deliverable_attachments (deliverable_id, storage_path) values ('$DRAFT','$CID/${U}24/held.pdf');" "$(attached "$DRAFT")" "1"
run_check "F36 B cannot remove files while a dispute is open" attack \
  "select act_as('$B'); delete from contract_deliverable_attachments where deliverable_id='$DRAFT';" "$(attached "$DRAFT")" "1"
q "select act_as('$A'); update disputes set status='Resolved' where id='e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2';"
DRAFT_MC=f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3
q "insert into contract_deliverables (id, contract_id, title, status) values ('$DRAFT_MC','$MC','Early','draft');"
run_check "F37 B cannot attach on a priced contract before it is funded" attack \
  "select act_as('$B'); insert into contract_deliverable_attachments (deliverable_id, storage_path) values ('$DRAFT_MC','$MC/${U}10/other.pdf');" "$(attached "$DRAFT_MC")" "0"
q "select act_as('$B'); update contract_deliverables set status='submitted', submitted_at=now() where id='$DRAFT';"
run_check "F38 files cannot be added once the deliverable is submitted" attack \
  "select act_as('$B'); insert into contract_deliverable_attachments (deliverable_id, storage_path) values ('$DRAFT','$CID/${U}24/held.pdf');" "$(attached "$DRAFT")" "1"
run_check "F39 files cannot be removed once the deliverable is submitted" attack \
  "select act_as('$B'); delete from contract_deliverable_attachments where deliverable_id='$DRAFT';" "$(attached "$DRAFT")" "1"

SUBMIT="submit_deliverable_with_attachments"
P2="$CID/${U}27/memo.pdf"
q "select act_as('$B'); $(obj "$P2" 2048 application/pdf)"
run_check "F40 B submits a new deliverable with its file in one call" legit \
  "select act_as('$B'); select $SUBMIT('$CID', null, 'Memo with appendix', 'body', '{}'::jsonb, array['$P2'], now());" \
  "select d.status || ':' || count(a.id) from contract_deliverables d left join contract_deliverable_attachments a on a.deliverable_id=d.id where d.title='Memo with appendix' group by d.status" "submitted:1"
run_check "F41 a refused file rolls the whole submission back" attack \
  "select act_as('$B'); select $SUBMIT('$CID', null, 'Ghost', 'body', '{}'::jsonb, array['$CID/${U}28/missing.pdf'], now());" \
  "select count(*) from contract_deliverables where title='Ghost'" "0"
q "$(obj "$CID/${U}29/planted.pdf" 1024 application/pdf)"
run_check "F42 the organization side cannot submit files as the agent" attack \
  "select act_as('$A'); select $SUBMIT('$CID', null, 'OrgAttempt', 'body', '{}'::jsonb, array['$CID/${U}29/planted.pdf'], now());" \
  "select count(*) from contract_deliverables where title='OrgAttempt'" "0"
run_check "F43 unrelated C cannot submit into the contract" attack \
  "select act_as('$C'); select $SUBMIT('$CID', null, 'Intruder', 'body', '{}'::jsonb, array['$CID/${U}29/planted.pdf'], now());" \
  "select count(*) from contract_deliverables where title='Intruder'" "0"
MEMO=$(psql -d "$DB" -qAt -c "select id from contract_deliverables where title='Memo with appendix'")
q "select act_as('$A'); update contract_deliverables set status='draft', decisions=decisions || '[{\"status\":\"rejected\",\"note\":\"tighten\"}]'::jsonb where id='$MEMO';"
P3="$CID/${U}30/memo-v2.pdf"
q "select act_as('$B'); $(obj "$P3" 4096 application/pdf)"
run_check "F44 revising a rejected draft replaces its file set and resubmits" legit \
  "select act_as('$B'); select $SUBMIT('$CID', '$MEMO', 'Memo v2', 'body v2', '{}'::jsonb, array['$P3'], now());" \
  "select d.status || ':' || string_agg(a.file_name, ',') from contract_deliverables d join contract_deliverable_attachments a on a.deliverable_id=d.id where d.id='$MEMO' group by d.status" "submitted:memo-v2.pdf"
run_check "F45 a submitted deliverable cannot be revised through the submit function" attack \
  "select act_as('$B'); select $SUBMIT('$CID', '$MEMO', 'Memo v3', 'body v3', '{}'::jsonb, array[]::text[], now());" \
  "select title || ':' || (select count(*) from contract_deliverable_attachments where deliverable_id='$MEMO') from contract_deliverables where id='$MEMO'" "Memo v2:1"
run_check "F46 anon cannot submit, and no user can call the hold helper directly" attack "select 1" \
  "select has_function_privilege('anon', 'public.$SUBMIT(uuid,uuid,text,text,jsonb,text[],timestamptz)', 'execute') or has_function_privilege('authenticated', 'public.delivery_hold_reason(uuid)', 'execute')" "f"

echo
if [ "$FAILED" -ne 0 ]; then echo "RLS LOCAL VERIFY: FAILED"; exit 1; fi
echo "RLS LOCAL VERIFY: ALL CHECKS PASSED"

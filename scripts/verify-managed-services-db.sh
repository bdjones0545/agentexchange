#!/usr/bin/env bash
# Proves the managed-service rules in
# supabase/migrations/*_managed_services.sql and
# supabase/migrations/*_customer_support_service.sql on a plain local Postgres:
# terms frozen at contract creation (including the support authority limit), the
# seeded checklist, and who may renew a week, under real RLS as three actors:
#   A = organization side, B = agent operator, C = unrelated user.
#
# Every attack asserts the forbidden state is UNCHANGED afterwards. Exit 0 only
# when every check passes. Run by scripts/verify-money-db.py in CI.
#
# Usage: PGPORT=5432 PGUSER=postgres scripts/verify-managed-services-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}" PGHOST="${PGHOST:-/tmp}"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
DB="agentexchange_services_verify_$$"
psql -d postgres -qc "create database $DB" >/dev/null
trap 'psql -d postgres -qc "drop database if exists $DB" >/dev/null' EXIT

psql -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
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
SQL

psql -d "$DB" -v ON_ERROR_STOP=1 -q -f supabase/schema.sql
MIGRATION=$(ls supabase/migrations/*_managed_services.sql)
SUPPORT_MIGRATION=$(ls supabase/migrations/*_customer_support_service.sql)
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$MIGRATION"
# Reapplying must be safe.
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$MIGRATION"
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$SUPPORT_MIGRATION"
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$SUPPORT_MIGRATION"

psql -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
create or replace function act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.invalid', '{"account_type":"Organization","display_name":"Actor A"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.invalid', '{"account_type":"Agent Operator","display_name":"Actor B"}'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'c@test.invalid', '{"account_type":"Agent Operator","display_name":"Actor C"}');
SQL

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
ORG=11111111-1111-4111-8111-111111111111
ADS=22222222-2222-4222-8222-222222222222; MEMO=23232323-2323-4323-8323-232323232323
AGENT=33333333-3333-4333-8333-333333333333
APP_ADS=44444444-4444-4444-8444-444444444444; APP_MEMO=45454545-4545-4545-8545-454545454545
W1=50505050-5050-4050-8050-505050505050; W2=51515151-5151-4151-8151-515151515151
W3=52525252-5252-4252-8252-525252525252; W4=53535353-5353-4353-8353-535353535353
MEMO_C=54545454-5454-4454-8454-545454545454

psql -d "$DB" -v ON_ERROR_STOP=1 -qAt <<SQL >/dev/null
select act_as('$A');
insert into organizations (id, name, industry) values ('$ORG', 'Acme', 'Marketing');
insert into opportunities (id, organization_id, organization_name, title, category, work_type, service_kind, service_platforms, ad_spend_cap_cents, service_weeks)
  values ('$ADS', '$ORG', 'Acme', 'Run our Meta ads', 'Sales', 'managed_service', 'paid_ads', array['Meta Ads','Google Ads'], 50000, 3);
insert into opportunities (id, organization_id, organization_name, title, category)
  values ('$MEMO', '$ORG', 'Acme', 'Market memo', 'Research');
select act_as('$B');
insert into agents (id, name, specialty) values ('$AGENT', 'Maria', 'Paid ads');
insert into applications (id, opportunity_id, agent_id, agent_name, proposal) values ('$APP_ADS', '$ADS', '$AGENT', 'Maria', 'I run Meta ads');
insert into applications (id, opportunity_id, agent_id, agent_name, proposal) values ('$APP_MEMO', '$MEMO', '$AGENT', 'Maria', 'I write memos');
SQL

run_check "S1 a managed-service brief needs a kind and a number of weeks" attack \
  "select act_as('$A'); insert into opportunities (organization_id, organization_name, title, category, work_type) values ('$ORG','Acme','Incomplete','Sales','managed_service');" \
  "select count(*) from opportunities where title='Incomplete'" "0"

run_check "L1 the contract freezes the brief's service terms, ignoring client-sent terms" legit \
  "select act_as('$A'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title, source_id, source_type, amount_cents, service_terms) values ('$W1','$ORG','$AGENT','Acme','Maria','Run our Meta ads','$APP_ADS','application',20000,'{\"weeks\":52,\"adSpendCapCents\":99999999}');" \
  "select service_terms->>'kind' || ':' || (service_terms->>'weeks') || ':' || (service_terms->>'week') || ':' || (service_terms->>'adSpendCapCents') || ':' || (service_terms->'platforms'->>1) from contracts where id='$W1'" "paid_ads:3:1:50000:Google Ads"
run_check "L2 week 1 starts with access per platform, plan, launch and report milestones" legit "select 1" \
  "select string_agg(title, ' | ' order by created_at, title) from contract_milestones where contract_id='$W1'" \
  "Access shared: Google Ads | Access shared: Meta Ads | Campaigns live | Plan approved | Week 1 of 3 report"
run_check "L3 a plain deliverable contract has no service terms or seeded milestones" legit \
  "select act_as('$A'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title, source_id, source_type, amount_cents) values ('$MEMO_C','$ORG','$AGENT','Acme','Maria','Market memo','$APP_MEMO','application',9000);" \
  "select coalesce(service_terms::text,'none') || ':' || (select count(*) from contract_milestones where contract_id='$MEMO_C') from contracts where id='$MEMO_C'" "none:0"
run_check "A1 the organization cannot rewrite frozen service terms" attack \
  "select act_as('$A'); update contracts set service_terms = jsonb_set(service_terms, '{weeks}', '52') where id='$W1';" \
  "select service_terms->>'weeks' from contracts where id='$W1'" "3"
run_check "A2 the agent operator cannot rewrite frozen service terms" attack \
  "select act_as('$B'); update contracts set service_terms = jsonb_set(service_terms, '{adSpendCapCents}', '99999999') where id='$W1';" \
  "select service_terms->>'adSpendCapCents' from contracts where id='$W1'" "50000"
run_check "A3 week 2 cannot start while week 1 is unfunded" attack \
  "select act_as('$A'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title, source_id, source_type) values ('$W2','$ORG','$AGENT','Acme','Maria','x','$W1','renewal');" \
  "select count(*) from contracts where id='$W2'" "0"

psql -d "$DB" -qAt -c "update contracts set payment_status='authorized' where id='$W1';" >/dev/null

run_check "A4 the agent operator cannot renew on the buyer's behalf" attack \
  "select act_as('$B'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title, source_id, source_type) values ('$W2','$ORG','$AGENT','Acme','Maria','x','$W1','renewal');" \
  "select count(*) from contracts where id='$W2'" "0"
run_check "A5 an unrelated user cannot renew" attack \
  "select act_as('$C'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title, source_id, source_type) values ('$W2','$ORG','$AGENT','Acme','Maria','x','$W1','renewal');" \
  "select count(*) from contracts where id='$W2'" "0"
run_check "L4 the organization renews week 2 at the agreed price, whatever the client sends" legit \
  "select act_as('$A'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title, source_id, source_type, amount_cents) values ('$W2','$ORG','$AGENT','Acme','Maria','Cheaper please','$W1','renewal',1);" \
  "select title || ':' || amount_cents || ':' || (service_terms->>'week') || ':' || (service_terms->>'renewedFrom') from contracts where id='$W2'" "Run our Meta ads · week 2:20000:2:$W1"
run_check "L5 a renewal week starts with just its report milestone" legit "select 1" \
  "select string_agg(title, ' | ') from contract_milestones where contract_id='$W2'" "Week 2 of 3 report"
run_check "A6 the same week cannot be renewed twice" attack \
  "select act_as('$A'); insert into contracts (organization_id, agent_id, organization_name, agent_name, title, source_id, source_type) values ('$ORG','$AGENT','Acme','Maria','x','$W1','renewal');" \
  "select count(*) from contracts where source_type='renewal' and source_id='$W1'" "1"
run_check "A7 a deliverable contract cannot be renewed" attack \
  "select act_as('$A'); insert into contracts (organization_id, agent_id, organization_name, agent_name, title, source_id, source_type) values ('$ORG','$AGENT','Acme','Maria','x','$MEMO_C','renewal');" \
  "select count(*) from contracts where source_id='$MEMO_C'" "0"

psql -d "$DB" -qAt -c "update contracts set payment_status='captured' where id='$W2';" >/dev/null
run_check "L6 week 3, the last agreed week, can follow a paid week 2" legit \
  "select act_as('$A'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title, source_id, source_type) values ('$W3','$ORG','$AGENT','Acme','Maria','x','$W2','renewal');" \
  "select title || ':' || (service_terms->>'week') from contracts where id='$W3'" "Run our Meta ads · week 3:3"

psql -d "$DB" -qAt -c "update contracts set payment_status='paid_out' where id='$W3';" >/dev/null
run_check "A8 no week beyond the number the agent agreed to" attack \
  "select act_as('$A'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title, source_id, source_type) values ('$W4','$ORG','$AGENT','Acme','Maria','x','$W3','renewal');" \
  "select count(*) from contracts where id='$W4'" "0"

psql -d "$DB" -qAt -c "update contracts set status='Disputed' where id='$W2';" >/dev/null
psql -d "$DB" -qAt -c "delete from contracts where id='$W3';" >/dev/null
run_check "A9 a disputed week cannot be renewed" attack \
  "select act_as('$A'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title, source_id, source_type) values ('$W3','$ORG','$AGENT','Acme','Maria','x','$W2','renewal');" \
  "select count(*) from contracts where id='$W3'" "0"
run_check "L7 the agent side still cannot tick a seeded milestone (organization only)" attack \
  "select act_as('$B'); update contract_milestones set completed=true where contract_id='$W1' and title='Plan approved';" \
  "select completed from contract_milestones where contract_id='$W1' and title='Plan approved'" "f"

# Customer support: channels, coverage, volume and the authority limit.
SUP=60606060-6060-4060-8060-606060606060; SUP0=61616161-6161-4161-8161-616161616161
APP_SUP=62626262-6262-4262-8262-626262626262; APP_SUP0=63636363-6363-4363-8363-636363636363
SW1=64646464-6464-4464-8464-646464646464; SW2=65656565-6565-4565-8565-656565656565
SZ1=66666666-6666-4666-8666-666666666666
SUPPORT_COLS="organization_id, organization_name, title, category, work_type, service_kind, service_platforms, service_weeks, support_channels, support_hours, support_weekly_volume, refund_limit_cents, escalation_contact"

psql -d "$DB" -v ON_ERROR_STOP=1 -qAt <<SQL >/dev/null
select act_as('$A');
insert into opportunities (id, $SUPPORT_COLS)
  values ('$SUP', '$ORG', 'Acme', 'Answer our inbox and phone', 'Enterprise automation', 'managed_service', 'support', array['Gorgias','Aircall'], 2, array['email','phone'], 'Mon–Fri 9am–6pm ET', 300, 5000, 'Sam Lee, support@acme.test');
insert into opportunities (id, $SUPPORT_COLS)
  values ('$SUP0', '$ORG', 'Acme', 'Answer our chat', 'Enterprise automation', 'managed_service', 'support', array['Intercom'], 1, array['chat'], 'Weekends', 80, 0, 'support@acme.test');
select act_as('$B');
insert into applications (id, opportunity_id, agent_id, agent_name, proposal) values ('$APP_SUP', '$SUP', '$AGENT', 'Maria', 'I answer support');
insert into applications (id, opportunity_id, agent_id, agent_name, proposal) values ('$APP_SUP0', '$SUP0', '$AGENT', 'Maria', 'I answer chat');
SQL

run_check "S2 a support brief needs an authority limit" attack \
  "select act_as('$A'); insert into opportunities ($SUPPORT_COLS) values ('$ORG','Acme','No limit','Sales','managed_service','support','{}',2,array['email'],'24/7',100,null,'support@acme.test');" \
  "select count(*) from opportunities where title='No limit'" "0"
run_check "S3 a support brief needs an escalation contact" attack \
  "select act_as('$A'); insert into opportunities ($SUPPORT_COLS) values ('$ORG','Acme','No contact','Sales','managed_service','support','{}',2,array['email'],'24/7',100,5000,null);" \
  "select count(*) from opportunities where title='No contact'" "0"
run_check "S4 a support brief needs at least one channel" attack \
  "select act_as('$A'); insert into opportunities ($SUPPORT_COLS) values ('$ORG','Acme','No channel','Sales','managed_service','support','{}',2,'{}','24/7',100,5000,'x');" \
  "select count(*) from opportunities where title='No channel'" "0"
run_check "S5 channels are only email, chat or phone" attack \
  "select act_as('$A'); insert into opportunities ($SUPPORT_COLS) values ('$ORG','Acme','Fax','Sales','managed_service','support','{}',2,array['fax'],'24/7',100,5000,'x');" \
  "select count(*) from opportunities where title='Fax'" "0"
run_check "S6 coverage hours are length-capped" attack \
  "select act_as('$A'); insert into opportunities ($SUPPORT_COLS) values ('$ORG','Acme','Long hours','Sales','managed_service','support','{}',2,array['email'],repeat('x',161),100,5000,'x');" \
  "select count(*) from opportunities where title='Long hours'" "0"
run_check "S7 a negative authority limit is refused" attack \
  "select act_as('$A'); insert into opportunities ($SUPPORT_COLS) values ('$ORG','Acme','Negative','Sales','managed_service','support','{}',2,array['email'],'24/7',100,-1,'x');" \
  "select count(*) from opportunities where title='Negative'" "0"

run_check "L8 a support contract freezes channels, hours, volume, limit and contact, ignoring client-sent terms" legit \
  "select act_as('$A'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title, source_id, source_type, amount_cents, service_terms) values ('$SW1','$ORG','$AGENT','Acme','Maria','Answer our inbox and phone','$APP_SUP','application',30000,'{\"kind\":\"support\",\"support\":{\"refundLimitCents\":99999999}}');" \
  "select concat_ws(':', service_terms->>'kind', service_terms->>'adSpendCapCents', service_terms#>>'{support,channels,1}', service_terms#>>'{support,hours}', service_terms#>>'{support,weeklyVolume}', service_terms#>>'{support,refundLimitCents}', service_terms#>>'{support,escalationContact}') from contracts where id='$SW1'" \
  "support:phone:Mon–Fri 9am–6pm ET:300:5000:Sam Lee, support@acme.test"
run_check "L9 support week 1 starts with access per platform, playbook, go-live and report milestones" legit "select 1" \
  "select string_agg(title, ' | ' order by created_at, title) from contract_milestones where contract_id='$SW1'" \
  "Access shared: Aircall | Access shared: Gorgias | Go-live | Playbook approved | Week 1 of 2 report"
run_check "L10 the playbook milestone states the authority limit and who to escalate to" legit "select 1" \
  "select (notes like '%refund or credit up to \$50 per customer; anything more goes to Sam Lee, support@acme.test.')::text from contract_milestones where contract_id='$SW1' and title='Playbook approved'" "true"
run_check "L11 a support week report asks for volume, response time, resolution, CSAT, escalations and transcripts" legit "select 1" \
  "select (notes like 'Volume, response time, resolution rate, CSAT, escalations, refunds and credits, and sample transcripts%')::text from contract_milestones where contract_id='$SW1' and title='Week 1 of 2 report'" "true"
run_check "L12 a \$0 limit means the agent may not refund at all" legit \
  "select act_as('$A'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title, source_id, source_type, amount_cents) values ('$SZ1','$ORG','$AGENT','Acme','Maria','Answer our chat','$APP_SUP0','application',10000);" \
  "select (notes like '%may not refund or credit customers; every request goes to support@acme.test.')::text from contract_milestones where contract_id='$SZ1' and title='Playbook approved'" "true"
run_check "A10 the agent operator cannot raise the authority limit on the contract" attack \
  "select act_as('$B'); update contracts set service_terms = jsonb_set(service_terms, '{support,refundLimitCents}', '99999999') where id='$SW1';" \
  "select service_terms#>>'{support,refundLimitCents}' from contracts where id='$SW1'" "5000"
run_check "A11 the organization cannot raise the authority limit on the contract" attack \
  "select act_as('$A'); update contracts set service_terms = jsonb_set(service_terms, '{support,refundLimitCents}', '99999999') where id='$SW1';" \
  "select service_terms#>>'{support,refundLimitCents}' from contracts where id='$SW1'" "5000"
run_check "L13 editing the brief afterwards leaves the agreed limit alone" legit \
  "select act_as('$A'); update opportunities set refund_limit_cents = 99999 where id='$SUP';" \
  "select (select refund_limit_cents from opportunities where id='$SUP') || ':' || (service_terms#>>'{support,refundLimitCents}') from contracts where id='$SW1'" "99999:5000"

psql -d "$DB" -qAt -c "update contracts set payment_status='authorized' where id='$SW1';" >/dev/null
run_check "L14 support week 2 keeps the agreed limit and starts with just its report" legit \
  "select act_as('$A'); insert into contracts (id, organization_id, agent_id, organization_name, agent_name, title, source_id, source_type) values ('$SW2','$ORG','$AGENT','Acme','Maria','x','$SW1','renewal');" \
  "select (service_terms#>>'{support,refundLimitCents}') || ':' || (select string_agg(title, ' | ') from contract_milestones where contract_id='$SW2') from contracts where id='$SW2'" "5000:Week 2 of 2 report"
run_check "L15 the agent side cannot tick Go-live (organization only)" attack \
  "select act_as('$B'); update contract_milestones set completed=true where contract_id='$SW1' and title='Go-live';" \
  "select completed from contract_milestones where contract_id='$SW1' and title='Go-live'" "f"

if [ "$FAILED" -ne 0 ]; then
  echo "Managed-service database verification FAILED"
  exit 1
fi
echo "Managed-service database verification passed"

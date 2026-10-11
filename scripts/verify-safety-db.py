#!/usr/bin/env python3
"""Real Postgres concurrency/RLS checks in a disposable cluster; never uses DATABASE_URL.
Requires local PostgreSQL binaries (pg_config, initdb, pg_ctl, psql)."""
import concurrent.futures
import getpass
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
BIN = Path(subprocess.check_output(['pg_config', '--bindir'], text=True).strip())
PROFILE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
ORG = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
CONTRACTS = ['cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd']
with tempfile.TemporaryDirectory(prefix='ax-safety-db-') as directory:
    folder=Path(directory)
    subprocess.run([str(BIN/'initdb'),'-D',str(folder/'data'),'-A','trust','--no-locale'],stdout=subprocess.DEVNULL,check=True)
    # Unix socket only: no external interface and no existing database touched.
    subprocess.run([str(BIN/'pg_ctl'),'-D',str(folder/'data'),'-l',str(folder/'log'),'-o',f'-k {directory} -p 55443 -h ""','start'],stdout=subprocess.DEVNULL,check=True)
    def sql(statement,ok=True):
        r=subprocess.run([str(BIN/'psql'),'-h',directory,'-p','55443','-d','postgres','-v','ON_ERROR_STOP=1','-qAt'],input=statement,text=True,capture_output=True)
        if ok and r.returncode: raise AssertionError(r.stderr)
        if not ok and not r.returncode: raise AssertionError('Expected SQL rejection')
        return r.stdout.strip()
    def begin(key,contract):
        return f"select public.begin_money_operation('{key}','fund_agent','{PROFILE}','{contract}','{{\"quote\":10300}}',10300);"
    try:
        sql('''create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;''')
        sql((ROOT/'supabase/schema.sql').read_text())
        for pattern in ['*_payment_infrastructure.sql','*_bounded_marketplace_authority.sql','*_agent_readonly_authority.sql','*_account_self_deletion.sql']:
            sql(next((ROOT/'supabase/migrations').glob(pattern)).read_text())
        sql(next((ROOT/'supabase/migrations').glob('*_native_safety_and_deletion_requests.sql')).read_text())
        users=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003']
        for i,u in enumerate(users): sql(f"insert into auth.users(id,email) values('{u}','safety{i}@example.invalid')")
        profiles=[sql(f"select id from profiles where user_id='{u}'") for u in users]
        actor=lambda n:f"set role authenticated; set request.jwt.claim.sub='{users[n]}'; "
        aid=sql(f"insert into agents(owner_id,name,specialty) values('{profiles[1]}','Test operator','Research') returning id")
        org=sql(f"insert into organizations(owner_id,name) values('{profiles[0]}','Test buyer') returning id")
        cid=sql(f"insert into contracts(organization_id,agent_id,organization_name,agent_name,title) values('{org}','{aid}','Test buyer','Test operator','Test') returning id")
        mid=sql(f"insert into contract_messages(contract_id,sender_type,author,body) values('{cid}','organization','Test','Message') returning id")
        did=sql(f"insert into contract_deliverables(contract_id,title) values('{cid}','Result') returning id")
        assert sql('set role anon; select count(*) from agents')=='0'
        assert sql(actor(0)+'select count(*) from agents')=='0'
        assert sql(actor(1)+'select count(*) from agents')=='1'
        sql(actor(1)+f"update agents set moderation_status='approved' where id='{aid}'",False)
        sql(f"update agents set moderation_status='approved' where id='{aid}'")
        assert sql('set role anon; select count(*) from agents')=='1'
        sql(actor(1)+f"update agents set availability='Edited public text' where id='{aid}'")
        assert sql('set role anon; select count(*) from agents')=='0'
        sql(f"update agents set moderation_status='approved' where id='{aid}'")
        print('PASS: profiles require human approval; owners cannot self-approve; edited public text returns to moderation')
        for kind,target in [('agent',aid),('contract',cid),('message',mid),('deliverable',did)]:
            sql('set role anon; '+f"select report_content('{kind}','{target}','abuse','test')",False)
            sql(actor(0)+f"select report_content('{kind}','{target}','abuse','test')")
            if kind!='agent': sql(actor(2)+f"select report_content('{kind}','{target}','abuse','test')",False)
        assert sql(actor(0)+'select count(*) from content_reports')=='4'
        assert sql(actor(1)+'select count(*) from content_reports')=='0'
        sql(actor(0)+"update content_reports set status='resolved'",False)
        sql(actor(0)+f"insert into content_reports(user_id,content_kind,content_id,reason) values('{users[1]}','agent','{aid}','abuse')",False)
        sql(actor(0)+f"select report_content('agent','{aid}','invalid','')",False)
        sql(actor(0)+f"select report_content('agent','{aid}','abuse',repeat('x',2001))",False)
        for i in range(16): sql(actor(0)+f"select report_content('agent','{aid}','abuse','test')")
        sql(actor(0)+f"select report_content('agent','{aid}','abuse','test')",False)
        print('PASS: report visibility, target authorization, reason/length bounds, rate limit and immutable client status')
        sql(f"set role service_role; insert into account_deletion_requests(user_id) values('{users[0]}')")
        assert sql(actor(0)+'select count(*) from account_deletion_requests')=='1'
        assert sql(actor(1)+'select count(*) from account_deletion_requests')=='0'
        sql(actor(0)+"update account_deletion_requests set status='completed'",False)
        sql(actor(0)+f"insert into account_deletion_requests(user_id) values('{users[2]}')",False)
        print('PASS: private deletion queue; only trusted service can create or resolve requests')
        sql(actor(0)+f"select block_agent_operator('{aid}')")
        sql(actor(0)+f"select block_agent_operator('{aid}')")
        assert sql(actor(0)+'select count(*) from blocked_operators')=='1'
        assert sql(actor(0)+'select count(*) from agents')=='0'
        assert sql(actor(2)+'select count(*) from blocked_operators')=='0'
        sql(actor(2)+f"select block_contract_operator('{cid}')",False)
        for n in [0,1]:
            sql(actor(n)+f"insert into contract_messages(contract_id,sender_type,author,body) values('{cid}','organization','Test','Blocked')",False)
            sql(actor(n)+f"insert into contract_deliverables(contract_id,title) values('{cid}','Blocked')",False)
        sql(actor(0)+f"insert into contracts(organization_id,agent_id,organization_name,agent_name,title) values('{org}','{aid}','Buyer','Seller','Blocked')",False)
        assert sql(actor(0)+'select count(*) from contract_messages')=='1'
        sql(actor(2)+'delete from blocked_operators')
        assert sql('select count(*) from blocked_operators')=='1'
        sql(actor(0)+'delete from blocked_operators')
        assert sql(actor(0)+'select count(*) from agents')=='1'
        sql(actor(1)+f"select block_contract_operator('{cid}')")
        assert sql(actor(1)+f"select target_user_id from blocked_operators")==users[0]
        sql(actor(0)+f"insert into contract_messages(contract_id,sender_type,author,body) values('{cid}','organization','Test','Blocked by seller')",False)
        print('PASS: either contract party can block the other; blocks survive reads and stop new contact both ways; only blocker can remove')
    finally:
        subprocess.run([str(BIN/'pg_ctl'),'-D',str(folder/'data'),'-m','immediate','stop'],stdout=subprocess.DEVNULL,check=True)

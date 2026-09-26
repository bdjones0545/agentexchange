#!/usr/bin/env python3
"""Real Postgres concurrency/RLS checks in a disposable cluster; never uses DATABASE_URL.
Requires local PostgreSQL binaries (pg_config, initdb, pg_ctl, psql)."""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BIN = Path(subprocess.check_output(['pg_config', '--bindir'], text=True).strip())
PROFILE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
ORG = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
CONTRACTS = ['cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd']
with tempfile.TemporaryDirectory(prefix='ax-money-db-') as directory:
    folder=Path(directory)
    subprocess.run([str(BIN/'initdb'),'-D',str(folder/'data'),'-A','trust','--no-locale'],stdout=subprocess.DEVNULL,check=True)
    # Unix socket only: no external interface and no existing database touched.
    subprocess.run([str(BIN/'pg_ctl'),'-D',str(folder/'data'),'-l',str(folder/'log'),'-o',f'-k {directory} -p 55439 -h ""','start'],stdout=subprocess.DEVNULL,check=True)
    def sql(statement,ok=True):
        r=subprocess.run([str(BIN/'psql'),'-h',directory,'-p','55439','-d','postgres','-v','ON_ERROR_STOP=1','-qAt'],input=statement,text=True,capture_output=True)
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
        # Reapplication is safe and tests the proposed delta against an existing schema.
        migration=next((ROOT/'supabase/migrations').glob('*_payment_infrastructure.sql'))
        sql(migration.read_text())
        sql(f"""insert into profiles(id,email) values('{PROFILE}','buyer@test.invalid');
insert into organizations(id,owner_id,name) values('{ORG}','{PROFILE}','Buyer');
insert into billing_accounts(profile_id,agent_daily_cap_cents,agent_per_contract_cap_cents) values('{PROFILE}',15000,12000);""")
        key='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
        sql(f"insert into agent_api_keys(id,profile_id,name,key_hash,key_prefix) values('{key}','{PROFILE}','Card test','hash','axk_test');")
        sql(f"insert into agent_payment_cards(key_id,profile_id,mode,payment_method_id) values('{key}','{PROFILE}','dedicated','pm_test');")
        assert sql("set role authenticated; select count(*) from agent_payment_cards;") == '0'
        sql(f"set role authenticated; update agent_payment_cards set payment_method_id='pm_other' where key_id='{key}';",ok=False)
        sql("set role anon; select * from agent_payment_cards;",ok=False)
        for c in CONTRACTS:
            sql(f"insert into contracts(id,organization_id,organization_name,agent_name,title,amount_cents,currency) values('{c}','{ORG}','Buyer','Seller','Test',10000,'USD');")
        def competing(i):
            return subprocess.run([str(BIN/'psql'),'-h',directory,'-p','55439','-d','postgres','-v','ON_ERROR_STOP=1','-qAt'],
                input='begin; set role service_role;'+begin('fund:'+CONTRACTS[i],CONTRACTS[i])+"select pg_sleep(0.3);commit;",text=True,capture_output=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(competing,[0,1]))
        assert sum(r.returncode==0 for r in results)==1,results
        assert 'spend cap' in next(r.stderr for r in results if r.returncode)
        assert sql('select sum(amount_cents) from money_operations')=='10300'
        print('PASS concurrent contracts cannot exceed shared daily cap')
        winner=sql('select key from money_operations')
        c=winner.removeprefix('fund:')
        assert json.loads(sql('set role service_role;'+begin(winner,c)))['state']=='busy'
        token=sql(f"select lease_token from money_operations where key='{winner}'")
        sql(f"set role service_role;select finish_money_operation('{winner}','00000000-0000-4000-8000-000000000000','{{}}');",False)
        sql(f"set role service_role;select fail_money_operation('{winner}','{token}','timeout');")
        assert json.loads(sql('set role service_role;'+begin(winner,c)))['state']=='acquired'
        sql(f"update money_operations set lease_until=null,created_at=now()-interval '25 hours' where key='{winner}'")
        assert json.loads(sql('set role service_role;'+begin(winner,c)))['state']=='review'
        print('PASS leases prevent duplicate execution; stale attempts require reconciliation')
        for role in ['anon','authenticated']:
            sql(f'set role {role};'+begin('attack',c),False)
            sql(f"set role {role};insert into seller_accounts values('{PROFILE}','acct_attacker',now());",False)
            sql(f'set role {role};select * from money_operations',False)
        print('PASS public roles cannot reserve money, redirect payouts, or read operation payloads')
        # Pending ambiguity still reserves budget after 24h.
        other=next(x for x in CONTRACTS if x!=c)
        sql('set role service_role;'+begin('fund:'+other,other),False)
        sql(f"update money_operations set completed_at=now(),result='{{\"id\":\"pi_1\"}}',lease_until=null where key='{winner}'")
        assert json.loads(sql('set role service_role;'+begin(winner,c)))['state']=='done'
        sql(f"update billing_accounts set agent_per_contract_cap_cents=10000 where profile_id='{PROFILE}'")
        sql('set role service_role;'+begin('fund:'+other,other),False)
        print('PASS unresolved funds remain reserved; per-contract limit enforced')
        sql(f"update contracts set payment_status='captured' where id='{c}';set role service_role;select set_contract_payment_status('{c}','authorized');")
        assert sql(f"select payment_status from contracts where id='{c}'")=='captured'
        print('PASS old authorization cannot downgrade captured payment')
        print('Payment database verification passed')
    finally:
        subprocess.run([str(BIN/'pg_ctl'),'-D',str(folder/'data'),'-m','fast','stop'],stdout=subprocess.DEVNULL,check=True)

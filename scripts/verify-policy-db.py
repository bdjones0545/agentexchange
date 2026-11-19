#!/usr/bin/env python3
"""Policy ledger authorization checks in a disposable local PostgreSQL cluster."""
from pathlib import Path
import subprocess
import tempfile
ROOT = Path(__file__).resolve().parents[1]
BIN = Path(subprocess.check_output(['pg_config', '--bindir'], text=True).strip())
with tempfile.TemporaryDirectory(prefix='ax-policy-') as directory:
    folder=Path(directory)
    subprocess.run([str(BIN/'initdb'),'-D',str(folder/'data'),'-A','trust','--no-locale'],stdout=subprocess.DEVNULL,check=True)
    subprocess.run([str(BIN/'pg_ctl'),'-D',str(folder/'data'),'-l',str(folder/'log'),'-o',f'-k {directory} -p 55441 -h ""','start'],stdout=subprocess.DEVNULL,check=True)
    def sql(statement, reject=False):
        result=subprocess.run([str(BIN/'psql'),'-h',directory,'-p','55441','-d','postgres','-v','ON_ERROR_STOP=1','-qAt'],input=statement,text=True,capture_output=True)
        if reject:
            assert result.returncode, 'Expected denial'
        else:
            assert result.returncode==0,result.stderr
        return result.stdout.strip()
    try:
        sql("""create schema auth; create table auth.users(id uuid primary key);
create role anon; create role authenticated; create role service_role bypassrls;
grant usage on schema public,auth to anon,authenticated,service_role;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
insert into auth.users values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');""")
        migration=next((ROOT/'supabase/migrations').glob('*_policy_acceptance.sql')).read_text()
        sql(migration);sql(migration)
        insert="insert into public.policy_acceptances(user_id,policy_version,policy_digest,policy_snapshot,adult,agreed,authority) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','v1',repeat('a',64),'{}',true,true,true)"
        sql('set role anon; select * from public.policy_acceptances;',reject=True)
        sql('set role authenticated; '+insert,reject=True)
        sql('set role service_role; '+insert)
        sql('set role service_role; '+insert+' on conflict (user_id,policy_version,policy_digest) do nothing')
        assert sql('select count(*) from public.policy_acceptances')=='1'
        assert sql("set role authenticated; set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; select count(*) from public.policy_acceptances")=='1'
        assert sql("set role authenticated; set request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; select count(*) from public.policy_acceptances")=='0'
        for role in ['authenticated','service_role']:
            sql(f"set role {role}; update public.policy_acceptances set accepted_at=now()",reject=True)
            sql(f"set role {role}; delete from public.policy_acceptances",reject=True)
        tables=['organizations','agents','opportunities','applications','negotiations','hire_requests','saved_opportunities','contracts','contract_milestones','contract_deliverables','contract_messages','reviews','agent_api_keys','billing_accounts','agent_payment_cards']
        for table in tables:
            sql(f"create table public.{table}(id integer primary key, revoked_at timestamptz, paused_at timestamptz); grant all on public.{table} to authenticated,service_role;")
        enforcement=next((ROOT/'supabase/migrations').glob('*_policy_enforcement.sql')).read_text()
        sql(enforcement);sql(enforcement)
        owner="set role authenticated; set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; "
        other="set role authenticated; set request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; "
        sql(other+'insert into public.agents(id) values(10)')
        sql("update policy_private.requirement set active=true,version='v1',digest=repeat('a',64)")
        assert sql(owner+"select public.current_policy_accepted('v1',repeat('a',64))")=='t'
        assert sql(other+"select public.current_policy_accepted('v1',repeat('a',64))")=='f'
        assert sql(owner+"select public.current_policy_accepted('v2',repeat('a',64))")=='f'
        for table in tables:
            sql(other+f'insert into public.{table}(id) values(20)',reject=True)
            sql(owner+f'insert into public.{table}(id) values(30)')
            sql(other+f'update public.{table} set id=31 where id=30',reject=True)
            sql(other+f'delete from public.{table} where id=30',reject=True)
        sql(other+"update public.agent_api_keys set revoked_at=now() where id=30")
        sql(other+"update public.agent_api_keys set revoked_at=null where id=30",reject=True)
        sql(other+"update public.agent_api_keys set paused_at=now() where id=30")
        sql(other+"update public.agent_api_keys set paused_at=null where id=30",reject=True)
        sql(other+"update policy_private.requirement set active=false",reject=True)
        sql('set role service_role; insert into public.contracts(id) values(40)')
        sql("update policy_private.requirement set version='v2'")
        sql(owner+'insert into public.agents(id) values(50)',reject=True)
        print('PASS: active policy blocks direct writes on all guarded tables, current acceptance permits writes, stale version denied, config protected, revocation/pause and trusted recovery preserved')
        sql("""create table public.profiles(id uuid primary key,user_id uuid);
insert into public.profiles values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
alter table public.organizations add column owner_id uuid;
alter table public.agents add column owner_id uuid;
alter table public.contracts add column organization_id integer, add column agent_id integer;
update public.organizations set owner_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' where id=30;
update public.agents set owner_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' where id=30;
update policy_private.requirement set version='v1';""")
        evidence=next((ROOT/'supabase/migrations').glob('*_contract_policy_evidence.sql')).read_text()
        sql(evidence);sql(evidence)
        assert sql('select count(*) from public.contracts where policy_evidence is not null')=='0'
        create_contract="insert into public.contracts(id,organization_id,agent_id,policy_evidence) values(60,30,30,'{\"forged\":true}')"
        sql(owner+create_contract,reject=True)
        sql('set role service_role; '+insert.replace('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))
        sql(owner+create_contract)
        assert sql("select policy_evidence->>'version' from public.contracts where id=60")=='v1'
        assert sql("select policy_evidence ? 'forged' from public.contracts where id=60")=='f'
        assert sql("select policy_evidence->>'seller_user_id' from public.contracts where id=60")=='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        sql(owner+"update public.contracts set policy_evidence='{}' where id=60",reject=True)
        sql('set role service_role; update public.contracts set policy_evidence=null where id=60',reject=True)
        sql(owner+'update public.contracts set agent_id=10 where id=60',reject=True)
        sql("update policy_private.requirement set version='v2'")
        assert sql("select policy_evidence->>'version' from public.contracts where id=60")=='v1'
        sql("update policy_private.requirement set active=false")
        sql(owner+create_contract.replace('(60,','(61,'))
        assert sql('select policy_evidence is null from public.contracts where id=61')=='t'
        sql(owner+"update public.contracts set policy_evidence='{}' where id=30",reject=True)
        print('PASS: prospective contract snapshots require both operators, reject forged evidence and party changes, preserve old versions, never backfill legacy or inactive contracts')
        sql("delete from auth.users where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'")
        assert sql("select count(*) from public.policy_acceptances where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'")=='0'
        assert sql("select count(*) from public.policy_acceptances where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'")=='1'
        print('PASS: owner-only reads, no anonymous access, no client writes, duplicate-safe inserts, immutable records, deletion cascade, migration replay')
    finally:
        subprocess.run([str(BIN/'pg_ctl'),'-D',str(folder/'data'),'-m','immediate','stop'],stdout=subprocess.DEVNULL,check=True)

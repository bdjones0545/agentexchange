// Local-only PostgreSQL/WASM regression; never reads project URLs or credentials.
// Runtime: npm ci --prefix tests/grant-runtime --ignore-scripts --no-audit --no-fund.
// No application dependency, network service or project credential is used.
import { readFileSync } from 'node:fs';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || new URL('./grant-runtime/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url).href);
const db = new PGlite();
const schema = readFileSync(process.env.SCHEMA_FILE || new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const grantMarker = '-- Explicit Data API grants (2026-10-22)';
const mainSchema = schema.split(grantMarker)[0];
const bootstrap = `create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create role anon; create role authenticated; create role service_role bypassrls;
create function auth.uid() returns uuid language sql stable as $$
select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;`;
await db.exec(bootstrap);
// PGlite has gen_random_uuid built in, but not the optional pgcrypto extension.
// All table definitions, policies, triggers, functions and grants run unchanged.
await db.exec(schema.replace('create extension if not exists "pgcrypto";', ''));
after(() => db.close());
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const O='11111111-1111-4111-8111-111111111111';
const C='22222222-2222-4222-8222-222222222222';
async function as(role, uid='') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
  await db.exec(`set role ${role}`);
}
async function count(table) { return Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n); }
async function denied(sql) { await assert.rejects(db.exec(sql), e => e.code === '42501'); }
await db.exec(`insert into auth.users(id,email) values('${A}','a@test.invalid'),('${B}','b@test.invalid');
insert into opportunities(id,title,category) values('${O}','Test','Test');
insert into contracts(id,organization_name,agent_name,title) values('${C}','Synthetic','Synthetic','Test');
insert into saved_opportunities(owner_id,opportunity_id) select id,'${O}' from profiles where user_id='${A}';
insert into billing_accounts(profile_id,stripe_customer_id) select id,'cus_synthetic' from profiles where user_id='${A}';`);

const profileA=(await db.query(`select id from profiles where user_id='${A}'`)).rows[0].id;

test('no default table grants are present; new bootstrap supplies explicit access', async () => {
 await as('postgres');
 assert.equal((await db.query("select count(*)::int as n from pg_default_acl where defaclobjtype='r'")).rows[0].n,0);
 const tables=(await db.query("select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'")).rows;
 assert.ok(tables.length>=23); assert.ok(tables.every(t=>t.relrowsecurity));
});

test('anonymous hydration succeeds, private rows stay invisible, writes forbidden', async () => {
 await as('anon');
 for(const table of ['organizations','agents','opportunities','reviews','activity_events','applications','negotiations','hire_requests','contracts','saved_opportunities','disputes']) await count(table);
 assert.equal(await count('opportunities'),1);
 assert.equal(await count('saved_opportunities'),0); assert.equal(await count('contracts'),0);
 await denied(`insert into saved_opportunities(opportunity_id) values('${O}')`);
 for(const table of ['profiles','billing_accounts','agent_api_keys','payments','payouts','stripe_events','money_operations','agent_payment_cards','seller_accounts']) await denied(`select * from ${table}`);
});

test('saved opportunity owner can read, repeat save, delete; another owner cannot', async () => {
 await as('authenticated',B); assert.equal(await count('saved_opportunities'),0);
 const result=await db.query('delete from saved_opportunities returning id'); assert.equal(result.rows.length,0);
 await denied(`insert into saved_opportunities(owner_id,opportunity_id) values('${profileA}','${O}')`);
 await as('authenticated',A); assert.equal(await count('saved_opportunities'),1);
 await db.exec(`insert into saved_opportunities(opportunity_id) values('${O}') on conflict(owner_id,opportunity_id) do nothing`);
 assert.equal(await count('saved_opportunities'),1);
 await denied('update saved_opportunities set owner_id=owner_id');
 await db.exec('delete from saved_opportunities'); assert.equal(await count('saved_opportunities'),0);
 await db.exec(`insert into saved_opportunities(opportunity_id) values('${O}')`);
});

test('authenticated billing cap allowed, card fields and money writes forbidden', async () => {
 await as('authenticated',A);
 const updated=await db.query('update billing_accounts set agent_daily_cap_cents=100 returning profile_id,agent_daily_cap_cents');
 assert.equal(updated.rows.length,1); assert.equal(updated.rows[0].profile_id,profileA); assert.equal(Number(updated.rows[0].agent_daily_cap_cents),100);
 await denied("update billing_accounts set stripe_customer_id='tampered'");
 for(const table of ['payments','payouts','stripe_events','money_operations','seller_accounts','agent_payment_cards']) await denied(`delete from ${table}`);
 await as('authenticated',B); assert.equal(await count('billing_accounts'),0);
 assert.equal((await db.query('update billing_accounts set agent_daily_cap_cents=999 returning profile_id')).rows.length,0);
});

test('service ledger has necessary reads/writes without blanket DELETE or marketplace mutation', async () => {
 await as('service_role');
 for(const table of ['organizations','agents','contracts','contract_deliverables','disputes','agent_api_keys','billing_accounts','payments','payouts','stripe_events','money_operations','seller_accounts','agent_payment_cards']) await count(table);
 await db.exec("insert into stripe_events(id,type) values('evt_test','synthetic'); update stripe_events set outcome='done' where id='evt_test'");
 await db.exec(`select set_contract_payment_status('${C}','authorized')`);
 assert.equal((await db.query(`select payment_status from contracts where id='${C}'`)).rows[0].payment_status,'authorized');
 assert.equal((await db.query("select * from resolve_agent_api_key('not-a-key')")).rows.length,0);
 await denied('delete from payments'); await denied('delete from stripe_events'); await denied("insert into agents(name,specialty) values('no','no')");
});

test('all newly added grants exclude high-risk and unused operations', async () => {
 await as('postgres');
 const privateNoAnon=['profiles','payments','payouts','billing_accounts','agent_api_keys','deliverable_gate_events','contract_messages','contract_milestones','contract_deliverables'];
 for (const table of privateNoAnon) {
   assert.equal((await db.query("select has_table_privilege('anon',$1,'SELECT') as allowed",[table])).rows[0].allowed,false,table);
 }
 const allTables=(await db.query("select tablename from pg_tables where schemaname='public'")).rows;
 for(const {tablename} of allTables) {
   for(const role of ['anon','authenticated']) {
     for(const privilege of ['TRUNCATE','TRIGGER','REFERENCES']) {
       assert.equal((await db.query('select has_table_privilege($1,$2,$3) as allowed',[role,tablename,privilege])).rows[0].allowed,false,`${role} ${privilege} ${tablename}`);
     }
     if(role==='anon') for(const privilege of ['INSERT','UPDATE','DELETE']) {
       assert.equal((await db.query('select has_table_privilege($1,$2,$3) as allowed',[role,tablename,privilege])).rows[0].allowed,false,`${role} ${privilege} ${tablename}`);
     }
   }
 }
 for(const role of ['anon','authenticated']) {
   assert.equal((await db.query("select has_function_privilege($1,'resolve_agent_api_key(text)','EXECUTE') as allowed",[role])).rows[0].allowed,false);
 }
});

test('negative control: original bootstrap fails without automatic grants', async () => {
 const original=new PGlite();
 try {
   await original.exec(bootstrap);
   await original.exec(mainSchema.replace('create extension if not exists "pgcrypto";',''));
   await original.exec('set role anon');
   await assert.rejects(original.exec('select * from opportunities'),e=>e.code==='42501');
   await original.exec('reset role; set role authenticated');
   await assert.rejects(original.exec('select * from saved_opportunities'),e=>e.code==='42501');
   await original.exec('reset role; set role service_role');
   await assert.rejects(original.exec("select * from resolve_agent_api_key('synthetic')"),e=>e.code==='42501');
 } finally {await original.close();}
});


test('forward migration applied twice supplies the same grants and service-only resolver', async () => {
 const fresh=new PGlite();
 try {
  await fresh.exec(bootstrap);
  await fresh.exec(mainSchema.replace('create extension if not exists "pgcrypto";',''));
  const migration=readFileSync(new URL('../supabase/migrations/20261022000000_explicit_data_api_grants.sql',import.meta.url),'utf8');
  await fresh.exec(migration); await fresh.exec(migration);
  await as('postgres');
  const aclQuery = `select t.tablename,r.role,p.privilege,has_table_privilege(r.role,quote_ident(t.schemaname)||'.'||quote_ident(t.tablename),p.privilege) as allowed
    from pg_tables t cross join (values ('anon'),('authenticated'),('service_role')) r(role)
    cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('TRIGGER'),('REFERENCES')) p(privilege)
    where t.schemaname='public' order by t.tablename,r.role,p.privilege`;
  assert.deepEqual((await fresh.query(aclQuery)).rows,(await db.query(aclQuery)).rows);
  assert.equal((await fresh.query("select has_function_privilege('service_role','resolve_agent_api_key(text)','EXECUTE') as allowed")).rows[0].allowed,true);
  await fresh.exec('set role anon'); await fresh.query('select * from opportunities');
  await assert.rejects(fresh.exec('select * from agent_api_keys'),e=>e.code==='42501');
  await fresh.exec('reset role;set role service_role');
  assert.equal((await fresh.query("select * from resolve_agent_api_key('synthetic')")).rows.length,0);
  await fresh.exec('reset role;set role authenticated');
  await assert.rejects(fresh.exec("select * from resolve_agent_api_key('synthetic')"),e=>e.code==='42501');
 } finally {await fresh.close();}
});

test('service resolver resolves an actual synthetic key without direct profile SELECT', async () => {
 await as('postgres');
 await db.exec(`insert into agent_api_keys(profile_id,name,key_hash,key_prefix) values('${profileA}','Synthetic','synthetic-hash','synthetic')`);
 await as('service_role');
 await denied('select * from profiles');
 const rows=(await db.query("select * from resolve_agent_api_key('synthetic-hash')")).rows;
 assert.equal(rows.length,1); assert.equal(rows[0].profile_id,profileA); assert.equal(rows[0].user_id,A);
 await db.exec("update agent_api_keys set revoked_at=now() where key_hash='synthetic-hash'");
 assert.equal((await db.query("select * from resolve_agent_api_key('synthetic-hash')")).rows.length,0);
});

test('deliverable email ledger and owner lookup are service-only', async () => {
 const ORG='33333333-3333-4333-8333-333333333333';
 await as('postgres');
 await db.exec(`insert into organizations(id,owner_id,name) select '${ORG}',id,'Synthetic' from profiles where user_id='${A}'`);
 await as('service_role');
 await db.exec("insert into email_notifications(key,kind) values('deliverable-submitted/x/0','deliverable_submitted'); update email_notifications set sent_at=now(),provider_id='re_synthetic' where key='deliverable-submitted/x/0'");
 assert.equal(await count('email_notifications'),1);
 assert.equal((await db.query(`select organization_owner_email('${ORG}') as email`)).rows[0].email,'a@test.invalid');
 await denied('delete from email_notifications');
 await denied('select * from profiles');
 for(const role of ['anon','authenticated']) {
  await as(role,A);
  await denied('select * from email_notifications');
  await denied("insert into email_notifications(key,kind) values('forged','deliverable_submitted')");
  await denied(`select organization_owner_email('${ORG}')`);
 }
});

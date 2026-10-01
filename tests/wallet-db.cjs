// PostgreSQL réel embarqué. Aucun compte ni secret externe utilisé.
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const db = new PGlite();
  const q = async (sql, args=[]) => (await db.query(sql,args)).rows;
  const val = async (sql,args=[]) => Object.values((await q(sql,args))[0])[0];
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const file of ['schema.sql','upgrade-digital-cards-wallet.sql','upgrade-frictionless-client.sql']) {
    await db.exec(fs.readFileSync(path.join(root,'supabase',file),'utf8').replace(/create extension if not exists pgcrypto;/gi,''));
  }
  // Supabase supplies table privileges independently of row-level policies.
  await db.exec('grant all on all tables in schema public to service_role; grant select,insert,update,delete on all tables in schema public to authenticated;');
  const install = fs.readFileSync(path.join(root,'supabase/wallet-personnalisation.sql'),'utf8');
  await db.exec(install); await db.exec(install); // idempotent installation
  const owner = await val("insert into auth.users values(gen_random_uuid(),'owner@example.test') returning id");
  const stranger = await val("insert into auth.users values(gen_random_uuid(),'other@example.test') returning id");
  const biz = await val("insert into public.businesses(name,slug,owner_id) values('Maison Auguste','maison-auguste',$1) returning id",[owner]);
  const prog = await val("insert into public.programs(business_id,reward_name,required_visits) values($1,'Café offert',5) returning id",[biz]);
  const customer = await val("insert into public.customers(display_name,first_name) values('Camille','Camille') returning id");
  const member = await val('insert into public.memberships(customer_id,program_id) values($1,$2) returning id',[customer,prog]);
  await q("insert into public.rewards(program_id,name,points_cost) values($1,'Café offert',50)",[prog]);
  for (const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    for (const sql of ['select * from public.wallet_passes','select public.wallet_snapshot($1)','select public.wallet_request_pass($1)','select public.wallet_claim_job($1)']) {
      await assert.rejects(q(sql,sql.includes('$1')?[member]:[]),/permission denied/);
    }
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  await q('select public.wallet_request_pass($1)',[member]);
  const first = await val('select public.wallet_claim_job($1)',[member]);
  assert.ok(first.lock_token);
  assert.equal(await val('select public.wallet_claim_job($1)',[member]),null);
  await q('select public.wallet_request_pass($1)',[member]);
  assert.equal(Number(await val('select desired_version from public.wallet_passes')),1);
  await db.exec('reset role');
  await q("select set_config('request.jwt.claim.sub',$1,false)",[stranger]);
  await assert.rejects(q('select public.record_visit($1)',[member]),/Accès refusé/);
  await q("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  const visit = await val('select public.record_visit($1)',[member]);
  await assert.rejects(q('select public.record_visit($1)',[member]),/moins de 10 minutes/);
  const links = JSON.stringify({identifier:'provider-test',templateId:'template-test',downloadPage:'https://example.test/pass',appleUrl:'',googleUrl:''});
  assert.equal(await val('select public.wallet_finish_job($1,$2,$3,$4::jsonb)',[member,first.lock_token,first.desired_version,links]),true);
  let state=(await q('select * from public.wallet_passes'))[0];
  assert.ok(Number(state.desired_version)>Number(state.synced_version),'change during external request must remain queued');
  assert.equal((await val('select public.wallet_snapshot($1)',[member])).points,10);
  await q('insert into public.private_feedback(membership_id,visit_id,rating) values($1,$2,5)',[member,visit]);
  await q('insert into public.redemptions(membership_id,points_spent) values($1,5)',[member]);
  assert.equal((await val('select public.wallet_snapshot($1)',[member])).points,10);
  await q("insert into public.visits(membership_id,created_at) select $1,now()-interval '1 day' from generate_series(1,1001)",[member]);
  assert.equal((await val('select public.wallet_snapshot($1)',[member])).points,10020,'no 1000-row client query truncation');
  await q("update public.customers set first_name='Léa',display_name='Léa' where id=$1",[customer]);
  assert.equal((await val('select public.wallet_snapshot($1)',[member])).firstName,'Léa');
  const second=await val('select public.wallet_claim_job($1)',[member]);
  assert.equal(await val('select public.wallet_finish_job($1,$2,$3)',[member,first.lock_token,first.desired_version]),false,'stale lock cannot acknowledge another worker');
  await q("select public.wallet_finish_job($1,$2,$3,null,'network')",[member,second.lock_token,second.desired_version]);
  assert.equal(await val('select public.wallet_claim_job($1)',[member]),null,'failed work uses retry backoff');
  assert.equal(await val('select last_error from public.wallet_passes'),'network');
  await q('update public.programs set active=false where id=$1',[prog]);
  assert.equal((await val('select public.wallet_snapshot($1)',[member])).active,false);
  await q('delete from public.customers where id=$1',[customer]);
  state=(await q('select * from public.wallet_passes'))[0];
  assert.equal(state.operation,'delete'); assert.equal(state.provider_id,'provider-test');
  assert.equal(await val('select public.wallet_snapshot($1)',[member]),null);
  const deletion=await val('select public.wallet_claim_job($1)',[member]);
  await q('select public.wallet_finish_job($1,$2,$3,null,null,true)',[member,deletion.lock_token,deletion.desired_version]);
  assert.equal(Number(await val('select count(*) from public.wallet_passes')),0);
  await db.close();
  console.log('PASS: SQL installation twice, roles, ownership, visit cooldown, exact points, durable queue, locks, concurrent change, backoff, profile update, deletion tombstone');
})().catch(e=>{console.error(e);process.exit(1)});

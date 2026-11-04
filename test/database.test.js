import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

// Real PostgreSQL execution; the minimal auth contract is a test harness only.
const alice = '00000000-0000-0000-0000-000000000001';
const bob = '00000000-0000-0000-0000-000000000002';
const admin = '00000000-0000-0000-0000-000000000003';
test('identity schema enforces database permissions across users and roles', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20261104203257_identity_foundation.sql', import.meta.url), 'utf8'));
    for (const [id, name] of [[alice,'Alice'],[bob,'Bob'],[admin,'Admin']]) {
      await db.query('insert into auth.users values ($1)', [id]);
      await db.query('insert into public.profiles (id, display_name) values ($1,$2)', [id,name]);
    }
    await db.query("insert into public.role_assignments values ($1,'admin')", [admin]);
    await db.query("insert into public.game_profiles values ($1,'ffmax','Private name','private-uid')", [alice]);
    await db.query("insert into public.audit_events (actor_id, action) values ($1,'test')", [admin]);
    async function as(id, role = 'authenticated') {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
      await db.exec(`set role ${role}`);
    }
    await t.test('anonymous cannot read profiles or game identities', async () => {
      await as(null,'anon');
      await assert.rejects(db.query('select * from public.profiles'), /permission denied/);
      await assert.rejects(db.query('select * from public.game_profiles'), /permission denied/);
    });
    await t.test('owner can update own profile but cannot modify another player', async () => {
      await as(alice);
      assert.equal((await db.query('select * from public.profiles')).rows.length,1);
      assert.equal((await db.query("update public.profiles set display_name='New name' where id=$1 returning id", [alice])).rows.length,1);
      assert.equal((await db.query("update public.profiles set display_name='Stolen' where id=$1 returning id", [bob])).rows.length,0);
      await assert.rejects(db.query('update public.profiles set player_id=gen_random_uuid()'), /permission denied/);
      await assert.rejects(db.query('update public.profiles set id=$1',[bob]), /permission denied/);
    });
    await t.test('private game IDs are isolated, including from admins', async () => {
      await as(alice);
      assert.equal((await db.query('select game_uid from public.game_profiles')).rows[0].game_uid,'private-uid');
      await as(bob);
      assert.equal((await db.query('select * from public.game_profiles')).rows.length,0);
      await assert.rejects(db.query("insert into public.game_profiles values ($1,'bgmi','Other','123')",[alice]), /row-level security/);
      await as(admin);
      assert.equal((await db.query('select * from public.game_profiles')).rows.length,0);
    });
    await t.test('players cannot promote themselves or approve eligibility', async () => {
      await as(alice);
      await assert.rejects(db.query("insert into public.role_assignments values ($1,'admin')",[alice]), /permission denied/);
      await assert.rejects(db.query('insert into public.player_eligibility (player_id,eligible) values ($1,true)',[alice]), /permission denied/);
      assert.equal((await db.query('select private.is_admin() as allowed')).rows[0].allowed,false);
    });
    await t.test('consent is owner scoped and append only with server timestamp', async () => {
      await as(alice);
      await db.query("insert into public.consent_records (player_id,policy_version) values ($1,'v1')",[alice]);
      await assert.rejects(db.query("insert into public.consent_records (player_id,policy_version) values ($1,'v1')",[bob]), /row-level security/);
      await assert.rejects(db.query('delete from public.consent_records'), /permission denied/);
      await assert.rejects(db.query("update public.consent_records set policy_version='v2'"), /permission denied/);
      await as(bob);
      assert.equal((await db.query('select * from public.consent_records')).rows.length,0);
    });
    await t.test('audit is admin-readable but client-immutable', async () => {
      await as(alice);
      assert.equal((await db.query('select * from public.audit_events')).rows.length,0);
      await as(admin);
      assert.equal((await db.query('select * from public.profiles')).rows.length,3);
      assert.equal((await db.query('select * from public.audit_events')).rows.length,1);
      await assert.rejects(db.query("insert into public.audit_events (action) values ('forged')"), /permission denied/);
      await assert.rejects(db.query('delete from public.audit_events'), /permission denied/);
    });
    await t.test('every application table has RLS and privileged helper is private', async () => {
      await db.exec('reset role');
      const tables = await db.query("select relname, relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'");
      assert.equal(tables.rows.length,6);
      assert.ok(tables.rows.every(row => row.relrowsecurity));
      await as(null,'anon');
      await assert.rejects(db.query('select private.is_admin()'), /permission denied/);
    });
  } finally { await db.close(); }
});

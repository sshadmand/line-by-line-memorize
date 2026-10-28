import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('Postgres enforces private ownership, column permissions, and stale revision protection', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
    `);
    await db.exec(readFileSync(new URL('../supabase/migrations/202610280001_scripts.sql', import.meta.url), 'utf8'));
    await db.exec("set role authenticated; set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';");
    const insert = await db.query(`insert into public.scripts(user_id,title,body) values ('00000000-0000-4000-8000-000000000001','Private','Line one\n\nLine two') returning *`);
    const row = insert.rows[0];
    assert.equal(row.version, 1);
    assert.equal(row.body, 'Line one\n\nLine two');
    await assert.rejects(db.query(`insert into public.scripts(user_id,title) values ('00000000-0000-4000-8000-000000000002','Impersonation')`), /row-level security/);
    await assert.rejects(db.query(`update public.scripts set user_id='00000000-0000-4000-8000-000000000002' where id=$1`, [row.id]), /permission denied/);
    await assert.rejects(db.query('update public.scripts set version=100 where id=$1', [row.id]), /permission denied/);
    const updated = await db.query('update public.scripts set body=$1 where id=$2 and version=1 returning version', ['New body', row.id]);
    assert.equal(updated.rows[0].version, 2);
    const stale = await db.query('update public.scripts set body=$1 where id=$2 and version=1 returning id', ['Stale edit', row.id]);
    assert.equal(stale.rows.length, 0);
    await db.exec("set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';");
    assert.equal((await db.query('select * from public.scripts')).rows.length, 0);
    assert.equal((await db.query('update public.scripts set body=$1 where id=$2 returning id', ['Attack', row.id])).rows.length, 0);
    assert.equal((await db.query('delete from public.scripts where id=$1 returning id', [row.id])).rows.length, 0);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from public.scripts'), /permission denied/);
  } finally { await db.close(); }
});

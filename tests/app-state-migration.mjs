// Optional local PostgreSQL/WASM validation. No Supabase connection is used.
// node tests/app-state-migration.mjs /path/to/@electric-sql/pglite/dist/index.js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

if (!process.argv[2]) throw new Error("Informe o caminho local do modulo PGlite.");
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const migration = readFileSync(new URL("../supabase/migrations/202609300001_app_state_compare_and_swap.sql", import.meta.url), "utf8");

for (const type of ["jsonb", "json"]) {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table public.app_state (id text primary key, data ${type}, updated_at timestamptz);
      alter table public.app_state enable row level security;
    `);
    await db.exec(migration);
    await db.exec(migration); // Reapplying the additive migration is safe.
    const cas = async (expected, updatedAt, next, exists = true) => {
      const result = await db.query(
        "select public.compare_and_swap_app_state($1::jsonb, $2::timestamptz, $3::jsonb, $4::boolean) as committed",
        [expected == null ? null : JSON.stringify(expected), updatedAt, JSON.stringify(next), exists],
      );
      return result.rows[0].committed;
    };
    const snapshot = async () => (await db.query("select data, updated_at::text as stamp from public.app_state where id = 'main'")).rows[0];
    assert.equal(await cas(null, null, { students: [], agendaEvents: [] }), false, "missing row is not recreated on update");
    assert.equal(await cas(null, null, { students: [], agendaEvents: [] }, false), true);
    assert.equal(await cas(null, null, { erased: true }, false), false, "concurrent initialization cannot overwrite main");
    const stale = await snapshot();
    await db.exec(`update public.app_state set data = '{"students":[{"id":"s1"}],"agendaEvents":[]}'`);
    assert.equal(await cas(stale.data, stale.stamp, { lost: true }), false, "JSON comparison detects changes even without timestamp update");
    const current = await snapshot();
    const next = { ...current.data, agendaEvents: [{ id: "a1" }] };
    assert.equal(await cas(current.data, current.stamp, next), true);
    assert.equal(await cas(current.data, current.stamp, { stale: true }), false);
    assert.deepEqual((await snapshot()).data, next);
    await db.exec("update public.app_state set updated_at = null");
    const nullable = await snapshot();
    assert.equal(await cas(nullable.data, null, next), true, "legacy null timestamp is supported");
    await assert.rejects(cas(next, (await snapshot()).stamp, []), /JSON object/);

    // EXECUTE is not an escalation: existing grants and RLS remain authoritative.
    await db.exec("set role anon");
    await assert.rejects(cas(next, null, next), /permission denied/);
    await db.exec("reset role; grant select, insert, update on public.app_state to anon");
    const beforeDenied = await snapshot();
    await db.exec("set role anon");
    assert.equal(await cas(beforeDenied.data, beforeDenied.stamp, { forbidden: true }), false, "RLS hides row");
    await db.exec("reset role; create policy app_state_access on public.app_state for all to anon using (id = 'main') with check (id = 'main')");
    await db.exec("set role anon");
    assert.equal(await cas(beforeDenied.data, beforeDenied.stamp, { permitted: true }), true);
    await db.exec("reset role");
    assert.deepEqual((await snapshot()).data, { permitted: true });
    console.log(`PASS migration, CAS conflicts, initialization, errors, grants and RLS (${type})`);
  } finally {
    await db.close();
  }
}

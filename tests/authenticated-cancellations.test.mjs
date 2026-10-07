import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { buildCancellationCatalog } from "../supabase/functions/_shared/cancellation-catalog.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const student = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'),('${student}'),('${stranger}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon,service_role;
    grant execute on function auth.uid() to authenticated,anon,service_role;
    create table public.app_state(id text primary key,data jsonb,updated_at timestamptz);
    insert into app_state values('main','{"students":[{"id":"s1","name":"Maria"}],"checkins":[],"agendaEvents":[],"makeupCredits":[],"workouts":{"keep":true}}',now());
    grant select,insert,update,delete on app_state to anon,authenticated,service_role;
  `);
  await db.exec(read("../supabase/migrations/202609010001_google_calendar_integration.sql").replace("create extension if not exists pgcrypto;", ""));
  await db.exec(read("../supabase/migrations/202609300001_app_state_compare_and_swap.sql"));
  await db.exec(read("../supabase/migrations/202610010001_authenticated_cancellations.sql"));
  const catalog = { students: [{ id: "s1", name: "Maria", authUserId: student }], packages: [{ id: "p1", studentId: "s1", name: "Treino", total: 3,
    lessons: [1, 2, 3].map((day) => ({ dateKey: `2099-01-0${day}`, startsAt: `2099-01-0${day}T10:00:00-03:00`, duration: 60, eventId: `p1-2099-01-0${day}`, recorded: false, consumed: false })) }] };
  await db.query("select publish_cancellation_catalog($1,$2)", [owner, JSON.stringify(catalog)]);
  const as = async (role = "authenticated", id = student) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec(`set role ${role}`);
  };
  const cancel = async (day = "2099-01-01", request = crypto.randomUUID(), pkg = "p1") =>
    (await db.query("select cancel_my_lesson($1,$2,$3) as result", [pkg, day, request])).rows[0].result;
  const state = async () => (await db.query("select data from app_state where id='main'")).rows[0].data;
  return { db, as, cancel, state, catalog };
}

test("autorizacao real do banco: anon, aluno alheio, perfis falsos e tabelas privadas", async () => {
  const { db, as, cancel } = await setup();
  try {
    await as("anon", "");
    await assert.rejects(cancel(), /permission denied/);
    await as("authenticated", stranger);
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: "admin", student_id: "s1" })]);
    await assert.rejects(cancel(), /not authorized/);
    for (const table of ["cancellation_students", "cancellation_packages", "cancellation_lessons", "lesson_cancellations", "calendar_cancellation_jobs"]) {
      await assert.rejects(db.exec(`select * from ${table}`), /permission denied/);
      await assert.rejects(db.exec(`delete from ${table}`), /permission denied/);
    }
    await assert.rejects(db.query("select publish_cancellation_catalog($1,$2)", [stranger, '{"students":[],"packages":[]}']), /permission denied/);
    await assert.rejects(db.exec("select claim_calendar_cancellations()"), /permission denied/);
    await as();
    assert.equal((await cancel()).ok, true);
  } finally { await db.close(); }
});

test("cancelamento, credito e fila atomicos; repeticoes simultaneas produzem um recibo", async () => {
  const { db, as, cancel, state } = await setup();
  try {
    await as();
    const request = crypto.randomUUID();
    const results = await Promise.all([cancel(undefined, request), cancel(undefined, request), cancel()]);
    assert.equal(new Set(results.map((r) => r.cancellationId)).size, 1);
    assert.equal(results[0].generated, true);
    assert.equal(results[0].credit.validUntil, "11/01/2099");
    assert.equal(results[0].event.time, "10:00");
    const doc = await state();
    assert.equal(doc.checkins.length, 1);
    assert.equal(doc.makeupCredits.length, 1);
    assert.equal(doc.agendaEvents.length, 1);
    assert.deepEqual(doc.workouts, { keep: true });
    await assert.rejects(cancel("2099-01-02", request), /Idempotency key reused/);
    await db.exec("reset role");
    assert.equal((await db.query("select count(*)::int as n from calendar_cancellation_jobs")).rows[0].n, 1);
  } finally { await db.close(); }
});

test("rollback de falha na fila nao deixa cancelamento nem credito parcial", async () => {
  const { db, as, cancel, state } = await setup();
  try {
    await db.exec("alter table calendar_cancellation_jobs add constraint simulated_failure check(false)");
    await as();
    await assert.rejects(cancel(), /simulated_failure/);
    assert.equal((await state()).checkins.length, 0);
    await db.exec("reset role; alter table calendar_cancellation_jobs drop constraint simulated_failure");
    await as();
    assert.equal((await cancel()).generated, true);
  } finally { await db.close(); }
});

test("limite estrito de duas horas, saldo e aula com registro anterior", async () => {
  const { db, as, cancel } = await setup();
  try {
    await db.exec("update cancellation_lessons set starts_at=statement_timestamp()+interval '2 hours' where date_key='2099-01-01'");
    await as();
    const result = await cancel();
    assert.equal(result.generated, false);
    assert.equal(result.credit, null);
    assert.equal(result.checkin.consumed, true);
    await db.exec("reset role; update cancellation_packages set total=1; update cancellation_lessons set starts_at=now()+interval '1 hour' where date_key='2099-01-02'");
    await as();
    await assert.rejects(cancel("2099-01-02"), /sem saldo/);
    await db.exec("reset role; update cancellation_lessons set recorded=true where date_key='2099-01-03'");
    await as();
    await assert.rejects(cancel("2099-01-03"), /ja possui registro/);
  } finally { await db.close(); }
});

test("gravador anonimo antigo nao apaga nem muda recibos; CAS obsoleto falha", async () => {
  const { db, as, cancel, state } = await setup();
  try {
    const before = (await db.query("select data,updated_at::text as stamp from app_state")).rows[0];
    await as();
    const result = await cancel();
    await as("anon", "");
    const stale = await db.query("select compare_and_swap_app_state($1,$2,$3,true) as ok", [JSON.stringify(before.data), before.stamp, '{}']);
    assert.equal(stale.rows[0].ok, false);
    const corrupted = { checkins: [{ ...result.checkin, consumed: true }], agendaEvents: [{ ...result.event, status: "confirmada" }],
      makeupCredits: [{ ...result.credit, validUntil: "01/01/3000", studentId: "intruder", status: "requested" }],
      deletionTombstones: [{ collection: "checkins", itemId: result.checkin.id }], workouts: { changed: true } };
    await db.query("update app_state set data=$1 where id='main'", [JSON.stringify(corrupted)]);
    let doc = await state();
    assert.equal(doc.checkins[0].consumed, false);
    assert.equal(doc.agendaEvents[0].status, "Cancelada no prazo");
    assert.equal(doc.makeupCredits[0].validUntil, "11/01/2099");
    assert.equal(doc.makeupCredits[0].studentId, "s1");
    assert.equal(doc.makeupCredits[0].status, "requested", "legacy redemption workflow preserved");
    assert.equal(doc.deletionTombstones.length, 0);
    await as();
    assert.equal((await cancel()).credit.status, "requested", "retry must not reset a redeemed/requested credit");
    await as("anon", "");
    await db.exec("update app_state set data='{\"workouts\":{\"changed\":true}}' where id='main'");
    doc = await state();
    assert.equal(doc.checkins.length, 1);
    assert.equal(doc.makeupCredits.length, 1);
    assert.equal(doc.makeupCredits[0].status, "requested");
    assert.deepEqual(doc.workouts, { changed: true });
    await assert.rejects(db.exec("update app_state set data=null"), /JSON object/);
    await assert.rejects(db.exec("delete from app_state"), /prevent removal/);
    await assert.rejects(db.exec("truncate app_state"), /permission denied/);
  } finally { await db.close(); }
});

test("leases, recuperacao apos interrupcao, ACK antigo e limite de tentativas", async () => {
  const { db, as, cancel } = await setup();
  try {
    await as(); await cancel(); await db.exec("reset role");
    const claim = async () => (await db.query("select claim_calendar_cancellations() as jobs")).rows[0].jobs;
    const [first] = await claim();
    assert.equal((await claim()).length, 0);
    await db.exec("update calendar_cancellation_jobs set lease_until=now()-interval '1 second'");
    const [next] = await claim();
    assert.notEqual(next.lease_token, first.lease_token);
    const finish = async (j, success) => (await db.query("select finish_calendar_cancellation($1,$2,$3) as ok", [j.id, j.lease_token, success])).rows[0].ok;
    assert.equal(await finish(first, true), false);
    assert.equal(await finish(next, false), true);
    assert.equal((await claim()).length, 0, "backoff prevents immediate retry");
    await db.exec("update calendar_cancellation_jobs set attempts=7,available_at=now()-interval '1 second'");
    const [last] = await claim();
    assert.equal(last.attempts, 8);
    await finish(last, false);
    assert.equal((await db.query("select status from calendar_cancellation_jobs")).rows[0].status, "failed");
  } finally { await db.close(); }
});

test("evento Google criado atrasado reabre tarefa concluida sem novo cancelamento", async () => {
  const { db, as, cancel } = await setup();
  try {
    await as(); const result = await cancel(); await db.exec("reset role");
    await db.exec("update calendar_cancellation_jobs set status='done'");
    await db.query("insert into google_calendar_event_links(user_id,app_event_id,google_event_id) values($1,$2,'g1')", [owner, result.event.id]);
    assert.equal((await db.query("select status from calendar_cancellation_jobs")).rows[0].status, "pending");
  } finally { await db.close(); }
});

test("catalogo preserva dias, horarios e limite de aulas, rejeitando identidades ambiguas", () => {
  const input = { students: [{ id: "s1", name: "Maria", authUserId: student }], checkins: [], packages: [
    { id: "p1", studentId: "s1", name: "Treino", total: 2, startDate: "01/10/2026", endDate: "31/10/2026", days: "quinta e sexta", time: "10:00", schedule: { 5: { time: "11:30", duration: 45 } } },
  ] };
  const catalog = buildCancellationCatalog(input);
  assert.deepEqual(catalog.packages[0].lessons.map((l) => [l.dateKey, l.startsAt, l.duration]), [["2026-10-01","2026-10-01T10:00:00-03:00",60],["2026-10-02","2026-10-02T11:30:00-03:00",45]]);
  assert.throws(() => buildCancellationCatalog({ ...input, students: [...input.students, ...input.students] }), /duplicado/);
  assert.throws(() => buildCancellationCatalog({ ...input, students: [] }), /sem aluno/);
});

test("dados adulterados no app_state nao mudam identidade, horario ou concessao oficial", async () => {
  const { db, as, cancel } = await setup();
  try {
    await as("anon", "");
    await db.exec(`update app_state set data='{"students":[{"id":"s1","name":"Intruso","auth_user_id":"${stranger}"}],"classPackages":[{"id":"p1","total":0}],"agendaEvents":[{"id":"p1-2099-01-01","time":"23:59","studentName":"Intruso"}]}'`);
    await as();
    await assert.rejects(db.query("select cancel_my_lesson($1,$2,$3,$4)", ["p1", "2099-01-01", crypto.randomUUID(), "23:59"]), /Horario alterado/);
    const receipt = await cancel();
    assert.equal(receipt.event.time, "10:00");
    assert.equal(receipt.checkin.studentName, "Maria");
    assert.equal(receipt.generated, true);
    await as("authenticated", stranger);
    await assert.rejects(cancel("2099-01-02"), /not authorized/);
  } finally { await db.close(); }
});

test("duas aulas concorrendo pelo ultimo saldo nao consomem duas unidades", async () => {
  const { db, as, cancel } = await setup();
  try {
    await db.exec("update cancellation_packages set total=1; update cancellation_lessons set starts_at=now()+interval '1 hour'");
    await as();
    const results = await Promise.allSettled([cancel("2099-01-01"), cancel("2099-01-02")]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.match(results.find((r) => r.status === "rejected").reason.message, /sem saldo/);
  } finally { await db.close(); }
});

test("catalogo nao reatribui aluno existente nem apaga recibo em republicacao", async () => {
  const { db, as, cancel, catalog } = await setup();
  try {
    await db.exec("alter table app_state alter column data type json using data::json");
    await as(); const receipt = await cancel(); await db.exec("reset role");
    const changed = structuredClone(catalog); changed.students[0].authUserId = stranger;
    await assert.rejects(db.query("select publish_cancellation_catalog($1,$2)", [owner, JSON.stringify(changed)]), /cannot be reassigned/);
    await db.query("select publish_cancellation_catalog($1,$2)", [owner, JSON.stringify(catalog)]);
    await as();
    assert.equal((await cancel()).cancellationId, receipt.cancellationId);
  } finally { await db.close(); }
});

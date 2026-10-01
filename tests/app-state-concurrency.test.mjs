import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { updateAppState } from "../supabase/functions/_shared/app-state.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const original = () => ({
  data: { students: [{ id: "s1", name: "Original" }], agendaEvents: [], checkins: [], makeupCredits: [] },
  updated_at: "2026-09-30T10:00:00.000Z",
});

function database({ beforeWrite, readError, writeError, alwaysConflict = false } = {}) {
  const db = { row: original(), writes: [], reads: 0, attempts: 0 };
  db.from = (table) => {
    const query = {
      select() { return query; }, eq() { return query; },
      async single() { db.reads++; return { data: structuredClone(db.row), error: readError }; },
      async maybeSingle() {
        return { data: table === "google_calendar_event_links"
          ? { id: "link-1", app_event_id: "a1", google_event_id: "g1", last_google_start: "2099-01-01T11:00:00Z" }
          : null, error: null };
      },
      async insert(row) { db.writes.push({ table, row }); return { error: null }; },
      async update(row) { db.writes.push({ table, row }); return { error: null }; },
    };
    // Supabase update().eq() is thenable.
    query.update = (row) => ({ eq: async () => { db.writes.push({ table, row }); return { error: null }; } });
    return query;
  };
  db.rpc = async (name, args) => {
    assert.equal(name, "compare_and_swap_app_state");
    db.attempts++;
    await beforeWrite?.(db, args);
    if (writeError) return { data: null, error: writeError };
    if (alwaysConflict || JSON.stringify(args.expected_data) !== JSON.stringify(db.row.data)
      || args.expected_updated_at !== db.row.updated_at) return { data: false, error: null };
    db.row = { data: structuredClone(args.next_data), updated_at: `revision-${db.attempts}` };
    return { data: true, error: null };
  };
  return db;
}

test("CAS refaz a mutacao sobre o JSON atual, preservando edicao concorrente sem mudar timestamp", async () => {
  const db = database({ beforeWrite(db) {
    if (db.attempts === 1) db.row.data.students[0].name = "Editado em outra aba";
  } });
  await updateAppState(db, (state) => state.agendaEvents.push({ id: "a1" }));
  assert.equal(db.attempts, 2);
  assert.equal(db.row.data.students[0].name, "Editado em outra aba");
  assert.equal(db.row.data.agendaEvents.length, 1);
});

test("dois sincronizadores preservam eventos distintos", async () => {
  const db = database();
  await Promise.all(["a1", "a2"].map((id) => updateAppState(db, (state) => state.agendaEvents.push({ id }))));
  assert.deepEqual(db.row.data.agendaEvents.map((item) => item.id).sort(), ["a1", "a2"]);
  assert.equal(db.attempts, 3);
});

test("conflitos persistentes encerram apos tres tentativas sem gravacao cega", async () => {
  const db = database({ alwaysConflict: true });
  await assert.rejects(updateAppState(db, (state) => state.agendaEvents.push({ id: "a1" })), /Conflito/);
  assert.equal(db.attempts, 3);
  assert.deepEqual(db.row, original());
  assert.equal(db.writes.length, 0);
});

for (const mode of ["readError", "writeError"]) {
  test(`propaga ${mode} sem tentar uma gravacao desprotegida`, async () => {
    const error = { message: "permission denied", code: "42501" };
    const db = database({ [mode]: error });
    await assert.rejects(updateAppState(db, () => {}), (caught) => caught === error);
    assert.equal(db.writes.length, 0);
    assert.deepEqual(db.row, original());
  });
}

test("linha main ausente nao e recriada pela integracao", async () => {
  const db = database(); db.row = null;
  await assert.rejects(updateAppState(db, () => {}), /ausente/);
  assert.equal(db.attempts, 0);
});

function calendar(db) {
  const source = stripTypeScriptTypes(read("../supabase/functions/_shared/calendar-sync.ts"))
    .replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  const context = vm.createContext({
    admin: () => db, updateAppState, structuredClone, crypto, Date, Intl, URLSearchParams,
    accessTokenFor: async () => ({ accessToken: "test", connection: { calendar_id: "test" } }),
    googleFetch: async () => ({ items: [googleEvent], nextSyncToken: "next" }),
  });
  vm.runInContext(source, context);
  return context;
}
const googleEvent = {
  id: "g1", etag: "new", status: "cancelled",
  start: { dateTime: "2099-01-01T11:00:00Z" }, end: { dateTime: "2099-01-01T12:00:00Z" },
  extendedProperties: { private: { app_event_id: "a1", package_id: "p1", student_id: "s1" } },
};

for (const options of [{ writeError: { message: "database down" } }, { alwaysConflict: true }]) {
  test(`falha no app_state impede historico, notificacao, etag e sync token: ${JSON.stringify(options)}`, async () => {
    const db = database(options);
    await assert.rejects(calendar(db).incrementalSync("owner"));
    assert.deepEqual(db.writes, []);
  });
}

test("cancelamento refeito apos conflito preserva dados e gera apenas um credito", async () => {
  const db = database({ beforeWrite(db) {
    if (db.attempts === 1) db.row.data.students[0].name = "Atualizado";
  } });
  const result = await calendar(db).applyGoogleEvent("owner", googleEvent);
  assert.equal(result.status, "success");
  assert.equal(db.row.data.students[0].name, "Atualizado");
  assert.equal(db.row.data.checkins.length, 1);
  assert.equal(db.row.data.makeupCredits.length, 1);
  assert.equal(db.row.data.makeupCredits[0].sourceCheckinId, db.row.data.checkins[0].id);
  assert.equal(db.writes.filter((entry) => entry.table === "google_calendar_sync_history").length, 1);
});

function browserSync(db, extra = {}) {
  const script = read("../script.js");
  const source = script.slice(script.indexOf("function rebaseAppStateChanges("), script.indexOf("async function flushAppStateSyncNow("));
  const context = vm.createContext({
    isApplyingRemoteState: false, getSupabaseAppStateClient: () => db, structuredClone,
    fetchSupabaseAppStateData: async () => ({ ok: true, data: structuredClone(db.row.data), updatedAt: db.row.updated_at, exists: true }),
    getAppStateSnapshot: () => ({ agendaEvents: [{ id: "local" }] }),
    mergeAppStateForSupabase: (remote, local) => ({ ...remote, ...local }),
    normalizeStudentsData: (data) => data,
    isNonRetryableSupabaseError: () => false,
    compareAndSwapAppStateWithRest: async () => { throw new Error("unexpected fallback"); },
    writeAppStateToLocalStorage: () => {}, logSupabaseAppStateError: () => {}, showSupabaseSyncWarning: () => {},
    formatSupabaseError: (error) => error.message,
    ...extra,
  });
  vm.runInContext(source, context);
  return context;
}

test("gravacao indireta do navegador refaz leitura e mesclagem apos conflito", async () => {
  const db = database({ beforeWrite(db) { if (db.attempts === 1) db.row.data.students[0].name = "Concorrente"; } });
  const result = await browserSync(db).syncAppStateToSupabase();
  assert.equal(result.ok, true);
  assert.equal(db.attempts, 2);
  assert.equal(db.row.data.students[0].name, "Concorrente");
  assert.equal(db.row.data.agendaEvents[0].id, "local");
});

test("retry nao reaplica aluno antigo do cache sobre edicao concorrente", async () => {
  const local = { ...original().data, agendaEvents: [{ id: "local" }] };
  const db = database({ beforeWrite(db) { if (db.attempts === 1) db.row.data.students[0].name = "Concorrente"; } });
  let cache;
  const result = await browserSync(db, {
    getAppStateSnapshot: () => local, writeAppStateToLocalStorage: (state) => { cache = state; },
  }).syncAppStateToSupabase();
  assert.equal(result.ok, true);
  assert.equal(db.row.data.students[0].name, "Concorrente");
  assert.equal(db.row.data.agendaEvents[0].id, "local");
  assert.equal(cache.students[0].name, "Concorrente");
});

test("edicao local durante RPC permanece no cache para a proxima sincronizacao", async () => {
  const local = { ...original().data, agendaEvents: [{ id: "local" }] };
  let cache;
  const db = database({ beforeWrite() { local.students[0].name = "Editado durante envio"; } });
  const result = await browserSync(db, {
    getAppStateSnapshot: () => local, writeAppStateToLocalStorage: (state) => { cache = state; },
  }).syncAppStateToSupabase();
  assert.equal(result.ok, true);
  assert.equal(db.row.data.students[0].name, "Original");
  assert.equal(cache.students[0].name, "Editado durante envio");
});

test("edicoes divergentes do mesmo campo retornam conflito sem sobrescrever remoto", async () => {
  const local = { ...original().data, students: [{ id: "s1", name: "Edicao local" }] };
  const db = database({ beforeWrite(db) { db.row.data.students[0].name = "Edicao remota"; } });
  const result = await browserSync(db, { getAppStateSnapshot: () => local }).syncAppStateToSupabase();
  assert.equal(result.ok, false);
  assert.match(result.error.message, /Conflito simultaneo/);
  assert.equal(db.attempts, 1);
  assert.equal(db.row.data.students[0].name, "Edicao remota");
});

test("navegador preserva cache e retorna falha quando os conflitos persistem", async () => {
  const db = database({ alwaysConflict: true });
  const result = await browserSync(db, { writeAppStateToLocalStorage: () => assert.fail("cache must remain intact") }).syncAppStateToSupabase();
  assert.equal(result.ok, false);
  assert.equal(db.attempts, 3);
});

test("falha de RPC e fallback impede sucesso no navegador", async () => {
  const db = database({ writeError: { message: "offline" } });
  const result = await browserSync(db, {
    compareAndSwapAppStateWithRest: async () => ({ ok: false, error: { message: "offline" } }),
    writeAppStateToLocalStorage: () => assert.fail("cache must remain intact"),
  }).syncAppStateToSupabase();
  assert.equal(result.ok, false);
  assert.equal(result.error.message, "offline");
});

test("resposta perdida apos commit pode ser repetida sem sobrescrever estado mais recente", async () => {
  const db = database();
  const rpc = db.rpc;
  db.rpc = async (name, args) => {
    const result = await rpc(name, args);
    if (db.attempts === 1) {
      db.row.data.students[0].name = "Mudou apos o commit";
      throw new Error("connection lost after commit");
    }
    return result;
  };
  const result = await browserSync(db, {
    compareAndSwapAppStateWithRest: async (args) => ({ ok: true, data: (await rpc("compare_and_swap_app_state", args)).data }),
  }).syncAppStateToSupabase();
  assert.equal(result.ok, true);
  assert.equal(db.attempts, 3);
  assert.equal(db.row.data.students[0].name, "Mudou apos o commit");
});

test("fallback REST usa somente RPC atomica e transmite snapshot esperado", async () => {
  const script = read("../script.js");
  const source = script.slice(script.indexOf("async function compareAndSwapAppStateWithRest("), script.indexOf("async function syncAppStateToSupabase()"));
  const payload = { expected_data: { students: [] }, expected_updated_at: null, next_data: {}, expected_exists: true };
  const context = vm.createContext({ console: { info() {} }, getSupabaseConfig: () => ({ url: "https://test.invalid", anonKey: "public-test" }),
    fetch: async (url, options) => {
      assert.equal(url, "https://test.invalid/rest/v1/rpc/compare_and_swap_app_state");
      assert.deepEqual(JSON.parse(options.body), payload);
      return { ok: true, text: async () => "false" };
    },
  });
  vm.runInContext(source, context);
  const result = await context.compareAndSwapAppStateWithRest(payload);
  assert.equal(result.data, false);
});

test("UI nao anuncia sucesso nem inicia pull se gravacao dos IDs falhar", async () => {
  let status = "";
  const calls = [];
  const context = vm.createContext({
    window: {}, document: { querySelector: (selector) => selector === "#google-calendar-message"
      ? { set textContent(value) { status = value; }, classList: { toggle() {} } } : null },
    currentUserType: "admin", currentSupabaseUser: { id: "owner" },
    getSupabaseClient: () => ({ functions: { invoke: async (_, { body }) => {
      calls.push(body.action);
      return { data: body.action === "status" ? { connection: { connection_status: "connected" } }
        : { results: [{ app_event_id: "a1", google_event_id: "g1" }] } };
    } } }),
    loadStudents: () => [], loadAgendaEvents: () => [{ id: "a1", dateKey: "2099-01-01", time: "08:00" }],
    getAgendaEventsForRange: () => [], saveAgendaEvents: () => {},
    flushAppStateSyncNow: async () => ({ ok: false, error: { message: "Gravacao recusada" } }),
  });
  vm.runInContext(read("../google-calendar.js").replace("  window.GoogleCalendarIntegration =", "  window.loadCalendarStatus = loadStatus;\n  window.GoogleCalendarIntegration ="), context);
  await context.window.loadCalendarStatus();
  await assert.rejects(context.window.GoogleCalendarIntegration.synchronizeNow(), /Gravacao recusada/);
  assert.match(status, /Gravacao recusada/);
  assert.deepEqual(calls, ["status", "push"]);
});

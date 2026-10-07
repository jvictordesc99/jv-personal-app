import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { processCancellationJob, runCancellationBatch } from "../supabase/functions/_shared/cancellation-worker.ts";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const job = { id: "job1", lease_token: "lease1", attempts: 1, cancellation: {
  id: "c1", owner_id: "owner", received_at: "2026-10-01T10:00:00Z", event: { id: "a1", studentName: "Maria" },
} };
function database({ link = { id: "link1", google_event_id: "g1", deleted_at: null }, writeError = null } = {}) {
  const history = new Map();
  const finishes = [];
  let claims = 0;
  const db = {
    history, finishes,
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; },
        async maybeSingle() { return { data: link, error: null }; },
        update(value) { return { eq: async () => {
          if (writeError) return { error: writeError };
          Object.assign(link, value); return { error: null };
        } }; },
        async upsert(value) { assert.equal(table, "google_calendar_sync_history"); history.set(value.idempotency_key, value); return { error: null }; },
      };
      return query;
    },
    async rpc(name, args) {
      if (name === "claim_calendar_cancellations") { claims++; return { data: claims === 1 ? [job] : [], error: null }; }
      assert.equal(name, "finish_calendar_cancellation"); finishes.push(args); return { data: true, error: null };
    },
  };
  return db;
}
const access = async (id) => { assert.equal(id, "owner"); return { accessToken: "test-token", connection: { calendar_id: "primary" } }; };

test("worker exclui evento, registra historico unico e confirma tarefa", async () => {
  const db = database(); let sends = 0;
  const fetchGoogle = async (url, options) => {
    sends++; assert.match(url, /events\/g1\?sendUpdates=all$/); assert.equal(options.method, "DELETE");
    return new Response(null, { status: 204 });
  };
  await runCancellationBatch(db, access, fetchGoogle);
  await processCancellationJob(db, job, access, fetchGoogle);
  assert.equal(sends, 1);
  assert.equal(db.history.size, 1);
  assert.equal(db.finishes[0].succeeded, true);
});

test("resposta perdida depois de DELETE e 410 na repeticao recuperam sem duplicar historico", async () => {
  const db = database(); let sends = 0;
  const fetchGoogle = async () => { if (++sends === 1) throw new Error("timeout after deletion"); return new Response(null, { status: 410 }); };
  await assert.rejects(processCancellationJob(db, job, access, fetchGoogle), /timeout/);
  assert.equal(db.history.size, 0);
  await processCancellationJob(db, job, access, fetchGoogle);
  assert.equal(db.history.size, 1);
});

test("429 respeita Retry-After; falha Google nao marca sucesso", async () => {
  const db = database();
  await runCancellationBatch(db, access, async () => new Response(null, { status: 429, headers: { "Retry-After": "300" } }));
  assert.equal(db.finishes[0].succeeded, false);
  assert.equal(db.finishes[0].retry_seconds, 300);
  assert.equal(db.finishes[0].permanent, false);
  assert.equal(db.history.size, 0);
});

test("falha ao persistir vinculo apos DELETE nao confirma tarefa", async () => {
  const db = database({ writeError: { message: "database offline" } });
  await runCancellationBatch(db, access, async () => new Response(null, { status: 204 }));
  assert.equal(db.finishes[0].succeeded, false);
  assert.equal(db.history.size, 0);
});

test("sem vinculo termina sem chamar Google; vinculacao tardia sera reaberta pelo trigger", async () => {
  const db = database({ link: null });
  await runCancellationBatch(db, () => assert.fail("no token required"), () => assert.fail("no Google call"));
  assert.equal(db.finishes[0].succeeded, true);
  assert.equal([...db.history.values()][0].status, "ignored");
});

test("erro de credencial fica pendente e nao vaza detalhes nos diagnosticos", async () => {
  const db = database();
  await runCancellationBatch(db, async () => { throw new Error("secret must not be logged"); }, () => assert.fail());
  assert.equal(db.finishes[0].succeeded, false);
  assert.doesNotMatch(db.finishes[0].failure, /secret/);
});

function endpoint(user, rpc = async () => ({ data: { ok: true }, error: null })) {
  let handler;
  const context = vm.createContext({
    Deno: { serve(fn) { handler = fn; } }, Response, JSON,
    getUser: async () => user,
    env: (name) => ({ GOOGLE_CALENDAR_OWNER_USER_ID: "owner", SUPABASE_URL: "https://test.invalid", SUPABASE_ANON_KEY: "public" })[name],
    admin: () => ({ rpc }),
    buildCancellationCatalog: () => ({ students: [], packages: [] }),
    createClient: (_, __, options) => { assert.equal(options.global.headers.Authorization, "Bearer student-session"); return { rpc }; },
    json: (body, status = 200) => Response.json(body, { status }), corsHeaders: {},
  });
  vm.runInContext(stripTypeScriptTypes(read("../supabase/functions/lesson-cancellation/index.ts")).replace(/^import .*;\r?\n/gm, ""), context);
  return (body) => handler(new Request("https://test.invalid", { method: "POST", headers: { Authorization: "Bearer student-session" }, body: JSON.stringify(body) }));
}

test("endpoint exige sessao e nao aceita role admin autodeclarada para publicar vinculos", async () => {
  assert.equal((await endpoint(null)({ action: "cancel" })).status, 401);
  assert.equal((await endpoint({ id: "student", user_metadata: { role: "admin" } }, () => assert.fail())({ action: "publish-catalog" })).status, 403);
  assert.equal((await endpoint({ id: "owner" })({ action: "publish-catalog", catalog: {} })).status, 200);
});

test("endpoint encaminha JWT do aluno e deixa autorizacao final para a RPC", async () => {
  const response = await endpoint({ id: "student" }, async (name, args) => {
    assert.equal(name, "cancel_my_lesson"); assert.equal(args.target_package, "p1");
    return { error: { code: "42501", message: "unauthorized" } };
  })({ action: "cancel", packageId: "p1", dateKey: "2026-10-02", requestId: crypto.randomUUID() });
  assert.equal(response.status, 403);
});

function browser(invoke) {
  const script = read("../script.js");
  const source = script.slice(script.indexOf("async function registerLessonCancellation("), script.indexOf("function registerStudentRescheduleNotice("));
  const values = new Map(); const written = [];
  const context = vm.createContext({
    isGlobalHoliday: () => false,
    getSupabaseClient: () => ({ functions: { invoke } }), currentSupabaseUser: { id: "student" }, crypto,
    localStorage: { getItem: (k) => values.get(k), setItem: (k, v) => values.set(k, v) },
    getAppStateSnapshot: () => ({ checkins: [], agendaEvents: [], makeupCredits: [] }),
    writeAppStateToLocalStorage: (state) => { written.push(state); return true; },
    preserveOfficialCancellationReceipts: (s) => s,
  });
  vm.runInContext(source, context);
  return { cancel: () => context.registerLessonCancellation("Maria", { id: "p1" }, { dateKey: "2026-10-02", time: "10:00" }), written };
}

test("frontend nao cria credito/sucesso em falha e reutiliza chave apos timeout", async () => {
  const keys = [];
  const ui = browser(async (_, { body }) => { keys.push(body.requestId); throw new Error("offline"); });
  assert.equal((await ui.cancel()).ok, false);
  assert.equal((await ui.cancel()).ok, false);
  assert.equal(keys[0], keys[1]);
  assert.equal(ui.written.length, 0);
});

test("frontend aplica somente recibo confirmado e nao depende da fila Google", async () => {
  const ui = browser(async () => ({ data: { ok: true, generated: false, checkin: { id: "c1" }, event: { id: "e1" }, credit: null }, error: null }));
  assert.equal((await ui.cancel()).ok, true);
  assert.equal(ui.written[0].checkins.length, 1);
  assert.equal(ui.written[0].makeupCredits.length, 0);
});

test("mesclagem local nao ressuscita aula nem oculta recibo com tombstone", () => {
  const script = read("../script.js");
  const source = script.slice(script.indexOf("function preserveOfficialCancellationReceipts("), script.indexOf("function mergeAppStateForSupabase("));
  const context = vm.createContext({}); vm.runInContext(source, context);
  const receipt = { id: "c1", packageId: "p1", dateKey: "2026-10-02", status: "cancelada-no-prazo", officialCancellationId: "c1" };
  const result = context.preserveOfficialCancellationReceipts({ checkins: [{ ...receipt, status: "realizado" }], deletionTombstones: [{ itemId: "c1" }] }, { checkins: [receipt] });
  assert.equal(result.checkins[0].status, "cancelada-no-prazo");
  assert.equal(result.deletionTombstones.length, 0);
});

test("push antigo e webhook Google nao recriam aula com cancelamento oficial", async () => {
  const context = vm.createContext({
    admin: () => ({ from(table) {
      const q = { select() { return q; }, eq() { return q; }, async single() { return { data: { data: { agendaEvents: [] } }, error: null }; }, async maybeSingle() {
        return { data: table === "lesson_cancellations" ? { id: "c1" } : { id: "link", app_event_id: "a1" }, error: null };
      } };
      return q;
    } }),
    accessTokenFor: async () => ({ accessToken: "test", connection: {} }),
    googleFetch: () => assert.fail("official cancellation must stay in queue"),
    updateAppState: () => assert.fail("webhook must not change official receipt"),
  });
  vm.runInContext(stripTypeScriptTypes(read("../supabase/functions/_shared/calendar-sync.ts")).replace(/^import .*;\r?\n/gm, "").replace(/export /g, ""), context);
  const pushed = await context.pushEvents("owner", [{ id: "a1", dateKey: "2099-01-01", time: "10:00", status: "confirmada" }]);
  assert.equal(pushed[0].reason, "official-cancellation-queued");
  const pulled = await context.applyGoogleEvent("owner", { id: "g1", status: "confirmed" });
  assert.equal(pulled.reason, "official-cancellation");
});

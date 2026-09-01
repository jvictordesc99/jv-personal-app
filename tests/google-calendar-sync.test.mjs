import test from "node:test";
import assert from "node:assert/strict";
import { canonicalEvent, operationFor, runSyncBatch } from "../lib/google-calendar-sync-core.mjs";

const lesson = { id: "aula-1", dateKey: "2026-09-10", time: "08:00", duration: 60, status: "confirmada", updatedAt: 1 };

test("cria evento quando a aula ainda nao possui vinculo", () => {
  assert.equal(operationFor(lesson, null).type, "create");
});

test("altera evento quando a assinatura mudou", () => {
  const result = operationFor({ ...lesson, time: "09:00", updatedAt: 2 }, { googleEventId: "g-1", signature: JSON.stringify(canonicalEvent(lesson)) });
  assert.equal(result.type, "update");
  assert.equal(result.googleEventId, "g-1");
});

test("cancela o evento correspondente", () => {
  const result = operationFor({ ...lesson, status: "cancelada" }, { googleEventId: "g-1" });
  assert.deepEqual(result, { type: "cancel", googleEventId: "g-1" });
});

test("ignora sincronizacao duplicada", () => {
  const signature = JSON.stringify(canonicalEvent(lesson));
  assert.deepEqual(operationFor(lesson, { googleEventId: "g-1", signature }), { type: "ignore", reason: "duplicate" });
});

test("isola falha de conexao e continua o lote", async () => {
  const results = await runSyncBatch([lesson, { ...lesson, id: "aula-2" }], new Map(), {
    create: async (event) => { if (event.id === "aula-1") throw new Error("offline"); return "g-2"; },
  });
  assert.equal(results[0].status, "error");
  assert.equal(results[0].error, "offline");
  assert.equal(results[1].status, "success");
});

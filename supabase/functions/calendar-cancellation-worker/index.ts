import { admin, env, accessTokenFor } from "../_shared/google.ts";
import { runCancellationBatch } from "../_shared/cancellation-worker.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (req.headers.get("authorization") !== `Bearer ${env("CALENDAR_CANCELLATION_WORKER_SECRET")}`) return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json({ results: await runCancellationBatch(admin(), accessTokenFor, fetch) });
  } catch {
    return Response.json({ error: "Processing interrupted; jobs will be retried after lease expiry." }, { status: 500 });
  }
});

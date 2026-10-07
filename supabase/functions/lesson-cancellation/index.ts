import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { admin, env, getUser } from "../_shared/google.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { buildCancellationCatalog } from "../_shared/cancellation-catalog.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "Entre novamente para continuar." }, 401);
    const raw = await req.text();
    if (raw.length > 2_000_000) return json({ error: "Pedido muito grande." }, 413);
    const body = JSON.parse(raw);
    if (body.action === "publish-catalog") {
      if (user.id !== env("GOOGLE_CALENDAR_OWNER_USER_ID")) return json({ error: "Somente o personal pode confirmar os vinculos." }, 403);
      const catalog = buildCancellationCatalog(body.catalog);
      const { error } = await admin().rpc("publish_cancellation_catalog", { owner_user: user.id, catalog });
      if (error) return json({ error: "Publicacao recusada. Confira vinculos, usuarios e pacotes; identidades existentes nao podem ser trocadas." }, 409);
      return json({ ok: true, students: catalog.students.length, packages: catalog.packages.length });
    }
    if (body.action !== "cancel" || typeof body.packageId !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateKey || "") || !/^[0-9a-f-]{36}$/i.test(body.requestId || "")) return json({ error: "Pedido de cancelamento invalido." }, 400);
    // Forward the real user JWT, never call the student RPC as service_role.
    const client = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: req.headers.get("Authorization")! } }, auth: { persistSession: false },
    });
    const { data, error } = await client.rpc("cancel_my_lesson", { target_package: body.packageId, target_date: body.dateKey, request_key: body.requestId, expected_time: body.time || null });
    if (error) return json({ error: error.code === "42501" ? "Voce nao tem acesso a esta aula. Peça ao personal para confirmar seu vinculo." : error.message }, error.code === "42501" ? 403 : 409);
    return json(data);
  } catch {
    return json({ error: "Nao foi possivel processar o pedido. Tente novamente." }, 500);
  }
});

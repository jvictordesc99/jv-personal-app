import { corsHeaders, json } from "../_shared/cors.ts";
import { accessTokenFor, admin, env, getUser, googleFetch, sha256, webhookUrl } from "../_shared/google.ts";
import { incrementalSync, pushEvents } from "../_shared/calendar-sync.ts";

async function createChannel(userId: string) {
  const db = admin();
  const { data: active } = await db.from("google_calendar_channels").select("channel_id,expires_at").eq("user_id", userId).eq("status", "active").gt("expires_at", new Date(Date.now() + 48 * 3600000).toISOString()).limit(1).maybeSingle();
  if (active) return { id: active.channel_id, expiration: new Date(active.expires_at).getTime(), reused: true };
  const { accessToken, connection } = await accessTokenFor(userId);
  const channelId = crypto.randomUUID();
  const channelToken = crypto.randomUUID() + crypto.randomUUID();
  const expiration = Date.now() + 6 * 86400000;
  const result = await googleFetch(accessToken, `/calendars/${encodeURIComponent(connection.calendar_id)}/events/watch`, {
    method: "POST",
    body: JSON.stringify({ id: channelId, type: "web_hook", address: webhookUrl(), token: channelToken, expiration: String(expiration) }),
  });
  await db.from("google_calendar_channels").insert({
    channel_id: channelId, user_id: userId, resource_id: result.resourceId, resource_uri: result.resourceUri,
    channel_token_hash: await sha256(channelToken), expires_at: new Date(Number(result.expiration || expiration)).toISOString(),
  });
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "Nao autenticado." }, 401);
    if (user.id !== env("GOOGLE_CALENDAR_OWNER_USER_ID")) return json({ error: "Somente o personal pode configurar o Google Calendar." }, 403);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || "status";
    const db = admin();

    if (action === "authorize") {
      const state = crypto.randomUUID() + crypto.randomUUID();
      const redirectUri = `${env("SUPABASE_URL")}/functions/v1/google-calendar-oauth-callback`;
      const appReturnUrl = String(body.app_return_url || "");
      if (!/^https?:\/\//.test(appReturnUrl)) return json({ error: "URL de retorno invalida." }, 400);
      if (new URL(appReturnUrl).origin !== new URL(env("APP_PUBLIC_URL")).origin) return json({ error: "Origem de retorno nao autorizada." }, 400);
      await db.from("google_calendar_oauth_states").insert({ state_hash: await sha256(state), user_id: user.id, redirect_uri: redirectUri, app_return_url: appReturnUrl, expires_at: new Date(Date.now() + 10 * 60000).toISOString() });
      const params = new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), redirect_uri: redirectUri, response_type: "code", scope: "openid email https://www.googleapis.com/auth/calendar", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }
    if (action === "status") {
      const { data } = await db.from("google_calendar_connections").select("google_email,calendar_id,connection_status,last_synced_at,last_error,updated_at").eq("user_id", user.id).maybeSingle();
      return json({ connected: data?.connection_status === "connected", connection: data || null });
    }
    if (action === "disconnect") {
      const { data: channels } = await db.from("google_calendar_channels").select("channel_id,resource_id").eq("user_id", user.id).eq("status", "active");
      try {
        const { accessToken } = await accessTokenFor(user.id);
        for (const channel of channels || []) await googleFetch(accessToken, "/channels/stop", { method: "POST", body: JSON.stringify({ id: channel.channel_id, resourceId: channel.resource_id }) });
      } catch { /* Local removal must still complete when Google is unavailable. */ }
      await db.from("google_calendar_connections").delete().eq("user_id", user.id);
      return json({ disconnected: true });
    }
    if (action === "push") return json({ results: await pushEvents(user.id, Array.isArray(body.events) ? body.events : []) });
    if (action === "pull") return json({ results: await incrementalSync(user.id) });
    if (action === "watch") return json({ channel: await createChannel(user.id) });
    return json({ error: "Acao invalida." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});

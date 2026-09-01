import { accessTokenFor, admin, env, googleFetch, sha256, webhookUrl } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${env("GOOGLE_CALENDAR_CRON_SECRET")}`) return new Response("Unauthorized", { status: 401 });
  const db = admin();
  const threshold = new Date(Date.now() + 36 * 3600000).toISOString();
  const { data: channels } = await db.from("google_calendar_channels").select("*").eq("status", "active").lt("expires_at", threshold);
  const renewed = [];
  for (const old of channels || []) {
    try {
      const { accessToken, connection } = await accessTokenFor(old.user_id);
      const id = crypto.randomUUID();
      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiration = Date.now() + 6 * 86400000;
      const result = await googleFetch(accessToken, `/calendars/${encodeURIComponent(connection.calendar_id)}/events/watch`, { method: "POST", body: JSON.stringify({ id, type: "web_hook", address: webhookUrl(), token, expiration: String(expiration) }) });
      await db.from("google_calendar_channels").insert({ channel_id: id, user_id: old.user_id, resource_id: result.resourceId, resource_uri: result.resourceUri, channel_token_hash: await sha256(token), expires_at: new Date(Number(result.expiration || expiration)).toISOString() });
      await googleFetch(accessToken, "/channels/stop", { method: "POST", body: JSON.stringify({ id: old.channel_id, resourceId: old.resource_id }) }).catch(() => null);
      await db.from("google_calendar_channels").update({ status: "stopped", updated_at: new Date().toISOString() }).eq("channel_id", old.channel_id);
      renewed.push(id);
    } catch (error) { console.error(error); await db.from("google_calendar_channels").update({ status: "error", updated_at: new Date().toISOString() }).eq("channel_id", old.channel_id); }
  }
  return Response.json({ renewed });
});

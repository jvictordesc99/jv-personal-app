import { incrementalSync } from "../_shared/calendar-sync.ts";
import { admin, sha256 } from "../_shared/google.ts";

Deno.serve(async (req) => {
  const channelId = req.headers.get("x-goog-channel-id") || "";
  const resourceId = req.headers.get("x-goog-resource-id") || "";
  const channelToken = req.headers.get("x-goog-channel-token") || "";
  if (!channelId || !resourceId || !channelToken) return new Response("Bad Request", { status: 400 });
  const db = admin();
  const { data: channel } = await db.from("google_calendar_channels").select("*").eq("channel_id", channelId).eq("resource_id", resourceId).eq("status", "active").maybeSingle();
  if (!channel || channel.channel_token_hash !== await sha256(channelToken)) return new Response("Forbidden", { status: 403 });
  try {
    await incrementalSync(channel.user_id);
    return new Response("ok");
  } catch (error) {
    console.error(error);
    await db.from("google_calendar_connections").update({ connection_status: "error", last_error: String(error), updated_at: new Date().toISOString() }).eq("user_id", channel.user_id);
    return new Response("Retry", { status: 500 });
  }
});

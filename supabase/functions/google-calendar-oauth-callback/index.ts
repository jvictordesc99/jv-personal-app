import { admin, encryptSecret, env, exchangeCode, googleFetch, sha256 } from "../_shared/google.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const db = admin();
  let returnUrl = env("APP_PUBLIC_URL");
  try {
    const stateHash = await sha256(state);
    const { data: oauthState, error } = await db.from("google_calendar_oauth_states").select("*").eq("state_hash", stateHash).gt("expires_at", new Date().toISOString()).single();
    if (error || !oauthState || !code) throw new Error("Estado OAuth invalido ou expirado.");
    returnUrl = oauthState.app_return_url;
    await db.from("google_calendar_oauth_states").delete().eq("state_hash", stateHash);
    const tokens = await exchangeCode(code, oauthState.redirect_uri);
    if (!tokens.refresh_token) throw new Error("O Google nao retornou refresh token. Revogue o acesso anterior e conecte novamente.");
    const userInfo = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then((response) => response.json());
    const calendars = await googleFetch(tokens.access_token, "/users/me/calendarList");
    const primary = calendars.items?.find((item: any) => item.primary) || { id: "primary" };
    await db.from("google_calendar_connections").upsert({
      user_id: oauthState.user_id, google_account_id: userInfo.sub, google_email: userInfo.email,
      calendar_id: primary.id, encrypted_refresh_token: await encryptSecret(tokens.refresh_token),
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), scope: tokens.scope,
      sync_token: null, connection_status: "connected", last_error: null, updated_at: new Date().toISOString(),
    });
    return Response.redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}google_calendar=connected`, 302);
  } catch (error) {
    console.error(error);
    const message = encodeURIComponent(error instanceof Error ? error.message : "Falha OAuth");
    return Response.redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}google_calendar=error&message=${message}`, 302);
  }
});

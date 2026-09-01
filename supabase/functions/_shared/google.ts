import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${name}`);
  return value;
};

export const admin = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

export async function sha256(value: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function encryptionKey() {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(env("GOOGLE_TOKEN_ENCRYPTION_KEY")));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(value)));
  return `${base64url(iv)}.${base64url(encrypted)}`;
}

function fromBase64url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
}

export async function decryptSecret(value: string) {
  const [iv, encrypted] = value.split(".").map(fromBase64url);
  return decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await encryptionKey(), encrypted));
}

export async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data.user || null;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Falha OAuth Google: ${body.error_description || body.error}`);
  return body;
}

export async function accessTokenFor(userId: string) {
  const db = admin();
  const { data, error } = await db.from("google_calendar_connections").select("*").eq("user_id", userId).single();
  if (error || !data) throw new Error("Google Calendar nao conectado.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), refresh_token: await decryptSecret(data.encrypted_refresh_token), grant_type: "refresh_token" }),
  });
  const token = await response.json();
  if (!response.ok) throw new Error(`Falha ao renovar token Google: ${token.error_description || token.error}`);
  await db.from("google_calendar_connections").update({ access_token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(), connection_status: "connected", last_error: null, updated_at: new Date().toISOString() }).eq("user_id", userId);
  return { accessToken: token.access_token as string, connection: data };
}

export async function googleFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`Google Calendar HTTP ${response.status}: ${body?.error?.message || "erro"}`);
  return body;
}

export const webhookUrl = () => `${env("SUPABASE_URL")}/functions/v1/google-calendar-webhook`;

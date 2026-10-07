import { base64url } from "jose";
import { ProviderError } from "./errors";
export interface DriveEnv {
  DB?: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  APP_ORIGIN?: string;
  LOCAL_DEV?: string;
}
interface Tokens {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
}
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DRIVE_READ_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";
const cookieName = "orbit_drive_oauth";
export function driveConfigured(env: DriveEnv) {
  return Boolean(
    env.DB &&
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.TOKEN_ENCRYPTION_KEY &&
    env.APP_ORIGIN,
  );
}
async function key(secret: string) {
  const bytes = base64url.decode(secret);
  if (bytes.length !== 32)
    throw new ProviderError("Drive encryption key must contain 32 bytes.", 503);
  return crypto.subtle.importKey(
    "raw",
    bytes as BufferSource,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(value: unknown, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(secret),
    data,
  );
  return `${base64url.encode(iv)}.${base64url.encode(new Uint8Array(encrypted))}`;
}
export async function unseal<T>(value: string, secret: string): Promise<T> {
  const [iv, data] = value.split(".");
  const decoded = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64url.decode(iv) as BufferSource },
    await key(secret),
    base64url.decode(data) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(decoded));
}
function configured(env: DriveEnv) {
  if (!driveConfigured(env))
    throw new ProviderError(
      "Google Drive is not configured yet. Open Integrations to connect it.",
      503,
    );
  return {
    db: env.DB!,
    id: env.GOOGLE_CLIENT_ID!,
    secret: env.GOOGLE_CLIENT_SECRET!,
    key: env.TOKEN_ENCRYPTION_KEY!,
    origin: env.APP_ORIGIN!,
  };
}
export async function driveConnected(env: DriveEnv) {
  if (!driveConfigured(env)) return false;
  const row = await env
    .DB!.prepare("SELECT status FROM integrations WHERE id='drive'")
    .first<{ status: string }>();
  return row?.status === "connected";
}
export async function driveToken(env: DriveEnv): Promise<string> {
  const config = configured(env);
  const row = await config.db
    .prepare(
      "SELECT encrypted_tokens AS tokens FROM provider_tokens WHERE provider='drive'",
    )
    .first<{ tokens: string }>();
  if (!row)
    throw new ProviderError(
      "Connect Google Drive in Integrations to start using your storage.",
      503,
    );
  let tokens: Tokens;
  try {
    tokens = await unseal<Tokens>(row.tokens, config.key);
  } catch {
    throw new ProviderError(
      "Could not unlock the Drive connection. Check the encryption key and reconnect.",
      503,
    );
  }
  if (tokens.accessToken && tokens.expiresAt! > Date.now() + 60000)
    return tokens.accessToken;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.id,
      client_secret: config.secret,
      refresh_token: tokens.refreshToken,
    }),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      await config.db
        .prepare(
          "UPDATE integrations SET status='needs_reauth' WHERE id='drive'",
        )
        .run();
      throw new ProviderError(
        "Google Drive needs to be reconnected. Open Integrations and sign in again.",
        401,
      );
    }
    throw new ProviderError(
      "Google could not refresh the connection. Please try again shortly.",
    );
  }
  const result = (await response.json()) as TokenResponse;
  const updated = {
    refreshToken: result.refresh_token || tokens.refreshToken,
    accessToken: result.access_token,
    expiresAt: Date.now() + result.expires_in * 1000,
  };
  await saveTokens(env, updated);
  return result.access_token;
}
async function saveTokens(env: DriveEnv, tokens: Tokens) {
  const config = configured(env);
  const encrypted = await seal(tokens, config.key);
  await config.db
    .prepare(
      "INSERT INTO provider_tokens (provider, encrypted_tokens, updated_at) VALUES ('drive',?,?) ON CONFLICT(provider) DO UPDATE SET encrypted_tokens=excluded.encrypted_tokens,updated_at=excluded.updated_at",
    )
    .bind(encrypted, new Date().toISOString())
    .run();
  await config.db
    .prepare(
      "INSERT INTO integrations (id,status) VALUES ('drive','connected') ON CONFLICT(id) DO UPDATE SET status='connected'",
    )
    .run();
}
export async function driveOAuth(
  request: Request,
  env: DriveEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (
    ![
      "/api/integrations/drive/connect",
      "/api/integrations/drive/callback",
    ].includes(url.pathname)
  )
    return null;
  if (request.method !== "GET")
    throw new ProviderError("Use the Connect Google Drive action.", 405);
  const config = configured(env);
  const origin = new URL(config.origin);
  if (
    origin.protocol !== "https:" &&
    !(
      env.LOCAL_DEV === "true" &&
      ["localhost", "127.0.0.1"].includes(origin.hostname)
    )
  )
    throw new ProviderError("Configure a secure app origin.", 503);
  const redirectUri = `${origin.origin}/api/integrations/drive/callback`;
  const secure = origin.protocol === "https:" ? "; Secure" : "";
  const clear = `${cookieName}=; Path=/api/integrations/drive; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
  const headers = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  };
  if (url.pathname.endsWith("/connect")) {
    const state = base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
    const verifier = base64url.encode(
      crypto.getRandomValues(new Uint8Array(32)),
    );
    const challenge = base64url.encode(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier),
        ),
      ),
    );
    const cookie = await seal(
      { state, verifier, expiresAt: Date.now() + 600000 },
      config.key,
    );
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.search = new URLSearchParams({
      client_id: config.id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: `${DRIVE_SCOPE} ${DRIVE_READ_SCOPE}`,
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();
    return new Response(null, {
      status: 302,
      headers: {
        ...headers,
        Location: auth.toString(),
        "Set-Cookie": `${cookieName}=${cookie}; Path=/api/integrations/drive; Max-Age=600; HttpOnly; SameSite=Lax${secure}`,
      },
    });
  }
  const cookie = request.headers
    .get("Cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!cookie)
    throw new ProviderError(
      "The connection request expired. Try Connect Google Drive again.",
      400,
    );
  let pending: { state: string; verifier: string; expiresAt: number };
  try {
    pending = await unseal(cookie, config.key);
  } catch {
    throw new ProviderError(
      "The connection request is invalid. Start again.",
      400,
    );
  }
  if (
    pending.expiresAt < Date.now() ||
    !url.searchParams.get("state") ||
    url.searchParams.get("state") !== pending.state
  )
    throw new ProviderError(
      "The connection request expired or did not match. Start again.",
      400,
    );
  const redirect = (status: string) =>
    new Response(null, {
      status: 302,
      headers: {
        ...headers,
        Location: `${origin.origin}/integrations?drive=${status}`,
        "Set-Cookie": clear,
      },
    });
  if (url.searchParams.has("error")) return redirect("cancelled");
  const code = url.searchParams.get("code");
  if (!code)
    throw new ProviderError(
      "Google did not return an authorization code.",
      400,
    );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: config.id,
      client_secret: config.secret,
      redirect_uri: redirectUri,
      code_verifier: pending.verifier,
    }),
  });
  if (!response.ok) return redirect("failed");
  const tokens = (await response.json()) as TokenResponse;
  if (
    !tokens.refresh_token ||
    !tokens.access_token ||
    ![DRIVE_SCOPE, DRIVE_READ_SCOPE].every((scope) =>
      tokens.scope?.split(" ").includes(scope),
    )
  )
    return redirect("failed");
  await saveTokens(env, {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });
  return redirect("connected");
}

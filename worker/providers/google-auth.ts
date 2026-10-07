import { base64url } from "jose";
import { ProviderError } from "./errors";
import { seal, unseal } from "../security";
export { seal, unseal } from "../security";
import { verifyGoogleIdentity, type AuthEnv } from "../auth";
export interface GoogleEnv extends AuthEnv {
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
  id_token?: string;
}
export type GoogleIntegration = "drive" | "calendar";
const scopes = {
  drive: [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
  ],
  calendar: ["https://www.googleapis.com/auth/calendar.events.readonly"],
};
const label = (provider: GoogleIntegration) =>
  provider === "drive" ? "Google Drive" : "Google Calendar";
export function googleConfigured(env: GoogleEnv) {
  return Boolean(
    env.DB &&
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.TOKEN_ENCRYPTION_KEY &&
    env.APP_ORIGIN,
  );
}
function configured(env: GoogleEnv, provider: GoogleIntegration) {
  if (!googleConfigured(env))
    throw new ProviderError(
      `${label(provider)} is not configured yet. Open Integrations to connect it.`,
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
export async function googleConnected(
  env: GoogleEnv,
  provider: GoogleIntegration,
) {
  if (!googleConfigured(env)) return false;
  const row = await env
    .DB!.prepare("SELECT status FROM integrations WHERE id=?")
    .bind(provider)
    .first<{ status: string }>();
  return row?.status === "connected";
}
export async function googleToken(
  env: GoogleEnv,
  provider: GoogleIntegration,
): Promise<string> {
  const config = configured(env, provider);
  const row = await config.db
    .prepare(
      "SELECT encrypted_tokens AS tokens FROM provider_tokens WHERE provider=?",
    )
    .bind(provider)
    .first<{ tokens: string }>();
  if (!row)
    throw new ProviderError(
      `Connect ${label(provider)} in Integrations to start using it.`,
      503,
    );
  let tokens: Tokens;
  try {
    tokens = await unseal<Tokens>(row.tokens, config.key);
  } catch {
    throw new ProviderError(
      `Could not unlock ${label(provider)}. Check the encryption key and reconnect.`,
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
        .prepare("UPDATE integrations SET status='needs_reauth' WHERE id=?")
        .bind(provider)
        .run();
      throw new ProviderError(
        `${label(provider)} needs to be reconnected. Open Integrations and sign in again.`,
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
  await saveTokens(env, provider, updated);
  return result.access_token;
}
async function saveTokens(
  env: GoogleEnv,
  provider: GoogleIntegration,
  tokens: Tokens,
) {
  const config = configured(env, provider);
  const encrypted = await seal(tokens, config.key);
  await config.db
    .prepare(
      "INSERT INTO provider_tokens (provider, encrypted_tokens, updated_at) VALUES (?,?,?) ON CONFLICT(provider) DO UPDATE SET encrypted_tokens=excluded.encrypted_tokens,updated_at=excluded.updated_at",
    )
    .bind(provider, encrypted, new Date().toISOString())
    .run();
  await config.db
    .prepare(
      "INSERT INTO integrations (id,status) VALUES (?,'connected') ON CONFLICT(id) DO UPDATE SET status='connected'",
    )
    .bind(provider)
    .run();
}
export async function googleOAuth(
  request: Request,
  env: GoogleEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/api\/integrations\/(drive|calendar)\/(connect|callback)$/,
  );
  if (!match) return null;
  const provider = match[1] as GoogleIntegration;
  const cookieName = `orbit_${provider}_oauth`;
  const cookiePath = `/api/integrations/${provider}`;
  if (request.method !== "GET")
    throw new ProviderError(`Use the Connect ${label(provider)} action.`, 405);
  const config = configured(env, provider);
  const origin = new URL(config.origin);
  if (
    origin.protocol !== "https:" &&
    !(
      env.LOCAL_DEV === "true" &&
      ["localhost", "127.0.0.1"].includes(origin.hostname)
    )
  )
    throw new ProviderError("Configure a secure app origin.", 503);
  const redirectUri = `${origin.origin}/api/integrations/${provider}/callback`;
  const secure = origin.protocol === "https:" ? "; Secure" : "";
  const clear = `${cookieName}=; Path=${cookiePath}; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
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
    const nonce = base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
    const cookie = await seal(
      { state, verifier, nonce, expiresAt: Date.now() + 600000 },
      config.key,
    );
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.search = new URLSearchParams({
      client_id: config.id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: `openid email ${scopes[provider].join(" ")}`,
      nonce,
      ...(env.OWNER_EMAIL ? { login_hint: env.OWNER_EMAIL } : {}),
      access_type: "offline",
      include_granted_scopes: "true",
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
        "Set-Cookie": `${cookieName}=${cookie}; Path=${cookiePath}; Max-Age=600; HttpOnly; SameSite=Lax${secure}`,
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
      `The connection request expired. Try Connect ${label(provider)} again.`,
      400,
    );
  let pending: {
    state: string;
    verifier: string;
    nonce: string;
    expiresAt: number;
  };
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
        Location: `${origin.origin}/integrations?${provider}=${status}`,
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
    !tokens.id_token ||
    !tokens.refresh_token ||
    !tokens.access_token ||
    !scopes[provider].every((scope) => tokens.scope?.split(" ").includes(scope))
  )
    return redirect("failed");
  try {
    await verifyGoogleIdentity(tokens.id_token!, env, pending.nonce);
  } catch {
    return redirect("failed");
  }
  await saveTokens(env, provider, {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });
  return redirect("connected");
}

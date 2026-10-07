import {
  base64url,
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import { seal, unseal } from "./security";
import { ProviderError } from "./providers/errors";

export interface AuthEnv {
  DB?: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  OWNER_EMAIL?: string;
  APP_ORIGIN?: string;
  LOCAL_DEV?: string;
}
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const duration = 7 * 86400;
export function localRequest(request: Request, env: AuthEnv) {
  return (
    env.LOCAL_DEV === "true" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)
  );
}
export function appOrigin(env: AuthEnv) {
  if (!env.APP_ORIGIN)
    throw new ProviderError("Sign-in is not configured yet.", 503);
  const origin = new URL(env.APP_ORIGIN);
  if (
    origin.protocol !== "https:" &&
    !(
      env.LOCAL_DEV === "true" &&
      ["localhost", "127.0.0.1"].includes(origin.hostname)
    )
  )
    throw new ProviderError("Configure a secure app origin.", 503);
  return origin.origin;
}
function cookieName(env: AuthEnv, pending = false) {
  return `${appOrigin(env).startsWith("https:") ? "__Host-" : ""}orbit_${pending ? "login" : "session"}`;
}
function cookie(env: AuthEnv, value: string, age: number, pending = false) {
  return `${cookieName(env, pending)}=${value}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Lax${appOrigin(env).startsWith("https:") ? "; Secure" : ""}`;
}
function readCookie(request: Request, name: string) {
  return request.headers
    .get("Cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
const random = () =>
  base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
export async function sessionHash(token: string) {
  return base64url.encode(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
  );
}
export async function verifyGoogleIdentity(
  token: string,
  env: AuthEnv,
  nonce: string,
  keys: JWTVerifyGetKey = googleKeys,
) {
  if (!env.GOOGLE_CLIENT_ID || !env.OWNER_EMAIL)
    throw new ProviderError("Sign-in is not configured yet.", 503);
  const { payload } = await jwtVerify(token, keys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.GOOGLE_CLIENT_ID,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "nonce", "email", "email_verified"],
  });
  if (
    payload.nonce !== nonce ||
    payload.email_verified !== true ||
    typeof payload.email !== "string" ||
    payload.email.toLowerCase() !== env.OWNER_EMAIL.trim().toLowerCase() ||
    !payload.sub ||
    (payload.azp && payload.azp !== env.GOOGLE_CLIENT_ID)
  )
    throw new ProviderError("This Google account cannot open this Orbit.", 403);
  return { email: payload.email.toLowerCase(), sub: payload.sub };
}
export async function session(request: Request, env: AuthEnv) {
  if (!env.DB || !env.OWNER_EMAIL || !env.APP_ORIGIN) return null;
  const token = readCookie(request, cookieName(env));
  if (!token || !/^[\w-]{43}$/.test(token)) return null;
  const row = await env.DB.prepare(
    "SELECT email, subject, expires_at FROM auth_sessions WHERE id=? AND expires_at>?",
  )
    .bind(await sessionHash(token), Math.floor(Date.now() / 1000))
    .first<{ email: string; subject: string; expires_at: number }>();
  return row && row.email === env.OWNER_EMAIL.trim().toLowerCase() ? row : null;
}
export async function authorized(request: Request, env: AuthEnv) {
  if (localRequest(request, env)) return true;
  try {
    return Boolean(await session(request, env));
  } catch {
    return false;
  }
}
export function validMutationOrigin(request: Request, env: AuthEnv) {
  if (
    ["GET", "HEAD", "OPTIONS"].includes(request.method) ||
    localRequest(request, env)
  )
    return true;
  try {
    return request.headers.get("Origin") === appOrigin(env);
  } catch {
    return false;
  }
}
function redirect(env: AuthEnv, path: string, cookies: string[] = []) {
  const headers = new Headers({
    Location: `${appOrigin(env)}${path}`,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}
export async function authRoute(
  request: Request,
  env: AuthEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (
    !["/api/auth/login", "/api/auth/callback", "/api/auth/logout"].includes(
      url.pathname,
    )
  )
    return null;
  if (
    !env.DB ||
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.TOKEN_ENCRYPTION_KEY ||
    !env.OWNER_EMAIL
  )
    throw new ProviderError("Sign-in is not configured yet.", 503);
  const origin = appOrigin(env);
  if (new URL(request.url).origin !== origin)
    throw new ProviderError("Open Orbit at its configured hostname.", 400);
  if (url.pathname.endsWith("/logout")) {
    if (request.method !== "POST")
      throw new ProviderError("Use the Sign out button.", 405);
    if (!validMutationOrigin(request, env))
      throw new ProviderError("This request did not come from Orbit.", 403);
    const token = readCookie(request, cookieName(env));
    if (token)
      await env.DB.prepare("DELETE FROM auth_sessions WHERE id=?")
        .bind(await sessionHash(token))
        .run();
    return redirect(env, "/login", [cookie(env, "", 0)]);
  }
  if (request.method !== "GET")
    throw new ProviderError("Use the Google sign-in button.", 405);
  const redirectUri = `${origin}/api/auth/callback`;
  if (url.pathname.endsWith("/login")) {
    const state = random(),
      verifier = random(),
      nonce = random();
    const challenge = await sessionHash(verifier);
    const pending = await seal(
      { state, verifier, nonce, expiresAt: Date.now() + 600000 },
      env.TOKEN_ENCRYPTION_KEY,
    );
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
      login_hint: env.OWNER_EMAIL,
    }).toString();
    const response = redirect(env, "/");
    response.headers.set("Location", auth.toString());
    response.headers.append("Set-Cookie", cookie(env, pending, 600, true));
    return response;
  }
  const clear = cookie(env, "", 0, true);
  const fail = (reason: string) =>
    redirect(env, `/login?error=${reason}`, [clear]);
  let pending: {
    state: string;
    verifier: string;
    nonce: string;
    expiresAt: number;
  };
  try {
    const sealed = readCookie(request, cookieName(env, true));
    if (!sealed) return fail("expired");
    pending = await unseal(sealed, env.TOKEN_ENCRYPTION_KEY);
    if (
      pending.expiresAt <= Date.now() ||
      !url.searchParams.get("state") ||
      pending.state !== url.searchParams.get("state")
    )
      return fail("expired");
  } catch {
    return fail("expired");
  }
  if (url.searchParams.has("error")) return fail("cancelled");
  const code = url.searchParams.get("code");
  if (!code) return fail("failed");
  let identity: { email: string; sub: string };
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code_verifier: pending.verifier,
      }),
    });
    if (!response.ok) return fail("failed");
    const tokens = (await response.json()) as { id_token?: string };
    if (!tokens.id_token) return fail("failed");
    identity = await verifyGoogleIdentity(tokens.id_token, env, pending.nonce);
  } catch (error) {
    return fail(
      error instanceof ProviderError && error.status === 403
        ? "account"
        : "failed",
    );
  }
  const token = random(),
    expires = Math.floor(Date.now() / 1000) + duration;
  const previous = readCookie(request, cookieName(env));
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM auth_sessions WHERE expires_at<=? OR id=?",
    ).bind(
      Math.floor(Date.now() / 1000),
      previous ? await sessionHash(previous) : "",
    ),
    env.DB.prepare(
      "INSERT INTO auth_sessions (id,email,subject,expires_at) VALUES (?,?,?,?)",
    ).bind(await sessionHash(token), identity.email, identity.sub, expires),
  ]);
  return redirect(env, "/", [clear, cookie(env, token, duration)]);
}

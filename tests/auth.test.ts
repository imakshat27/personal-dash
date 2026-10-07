import { afterEach, describe, expect, it, vi } from "vitest";
import { base64url } from "jose";
import {
  authRoute,
  authorized,
  sessionHash,
  validMutationOrigin,
  verifyGoogleIdentity,
  type AuthEnv,
} from "../worker/auth";
import { seal, unseal } from "../worker/security";
import worker from "../worker";
import { googleToken, jwks, localKeys } from "./google-fixture";
const origin = "https://orbit.example";
const encryptionKey = base64url.encode(new Uint8Array(32).fill(7));
function fixture() {
  const rows = new Map<
    string,
    { email: string; subject: string; expires_at: number }
  >();
  const writes: unknown[][] = [];
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          values = args;
          return statement;
        },
        first: async () => {
          const row = rows.get(String(values[0]));
          return row && row.expires_at > Number(values[1]) ? row : null;
        },
        run: async () => {
          writes.push(values);
          if (sql.startsWith("INSERT"))
            rows.set(String(values[0]), {
              email: String(values[1]),
              subject: String(values[2]),
              expires_at: Number(values[3]),
            });
          if (sql.startsWith("DELETE")) {
            if (sql.includes("expires_at")) {
              for (const [id, row] of rows)
                if (row.expires_at <= Number(values[0]) || id === values[1])
                  rows.delete(id);
            } else rows.delete(String(values[0]));
          }
          return { success: true };
        },
      };
      return statement;
    },
    batch: async (statements: { run(): Promise<unknown> }[]) =>
      Promise.all(statements.map((s) => s.run())),
  } as unknown as D1Database;
  const env: AuthEnv = {
    DB: db,
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    OWNER_EMAIL: "owner@gmail.com",
    TOKEN_ENCRYPTION_KEY: encryptionKey,
    APP_ORIGIN: origin,
  };
  return { env, rows, writes };
}
afterEach(() => vi.unstubAllGlobals());
describe("Google identity verification", () => {
  it("accepts a signed, verified owner identity with the expected nonce", async () => {
    expect(
      await verifyGoogleIdentity(
        await googleToken("nonce"),
        fixture().env,
        "nonce",
        localKeys,
      ),
    ).toMatchObject({ email: "owner@gmail.com", sub: "google-owner" });
  });
  it.each([
    { email: "other@gmail.com" },
    { email_verified: false },
    { nonce: "wrong" },
    { aud: "another-client" },
    { iss: "https://attacker.example" },
    { exp: 1 },
    { azp: "another-client" },
  ])("rejects mismatched or expired identity %j", async (claims) => {
    await expect(
      verifyGoogleIdentity(
        await googleToken("nonce", claims),
        fixture().env,
        "nonce",
        localKeys,
      ),
    ).rejects.toThrow();
  });
  it("rejects a token whose signature was altered", async () => {
    const token = await googleToken("nonce");
    const parts = token.split(".");
    parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
    await expect(
      verifyGoogleIdentity(parts.join("."), fixture().env, "nonce", localKeys),
    ).rejects.toThrow();
  });
});
describe("private app sessions", () => {
  it("does not create a session for a different Google account", async () => {
    const store = fixture();
    const start = await authRoute(
      new Request(`${origin}/api/auth/login`),
      store.env,
    );
    const auth = new URL(start!.headers.get("Location")!);
    const cookie = start!.headers.get("Set-Cookie")!.split(";")[0];
    const pending = await unseal<{ nonce: string }>(
      cookie.split("=")[1],
      encryptionKey,
    );
    const idToken = await googleToken(pending.nonce, {
      email: "other@gmail.com",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/certs")
          ? Response.json(jwks)
          : Response.json({ id_token: idToken }),
      ),
    );
    const callback = await authRoute(
      new Request(
        `${origin}/api/auth/callback?state=${auth.searchParams.get("state")}&code=code`,
        { headers: { Cookie: cookie } },
      ),
      store.env,
    );
    expect(callback!.headers.get("Location")).toContain("error=account");
    expect(store.rows.size).toBe(0);
    expect(
      callback!.headers
        .getSetCookie()
        .some((v) => v.startsWith("__Host-orbit_session=")),
    ).toBe(false);
  });
  it("blocks cross-site API writes even with a valid owner session", async () => {
    const store = fixture();
    const token = base64url.encode(new Uint8Array(32).fill(3));
    store.rows.set(await sessionHash(token), {
      email: "owner@gmail.com",
      subject: "owner",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    const request = new Request(`${origin}/api/notes`, {
      method: "POST",
      headers: {
        Cookie: `__Host-orbit_session=${token}`,
        Origin: "https://attacker.example",
      },
      body: "{}",
    });
    const response = await worker.fetch(request, {
      ...store.env,
      ASSETS: {
        fetch: async () => new Response("shell"),
      } as unknown as Fetcher,
      APP_MODE: "live",
    });
    expect(response.status).toBe(403);
    expect(store.writes).toHaveLength(0);
  });
  it("completes PKCE sign-in and stores only a hash of the session cookie; logout revokes it", async () => {
    const store = fixture();
    const start = await authRoute(
      new Request(`${origin}/api/auth/login`),
      store.env,
    );
    const auth = new URL(start!.headers.get("Location")!);
    expect(auth.searchParams.get("scope")).toBe("openid email");
    expect(auth.searchParams.get("code_challenge_method")).toBe("S256");
    const pendingCookie = start!.headers.get("Set-Cookie")!.split(";")[0];
    const pending = await unseal<{ nonce: string; verifier: string }>(
      pendingCookie.split("=")[1],
      encryptionKey,
    );
    const idToken = await googleToken(pending.nonce);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/certs")) return Response.json(jwks);
        expect((init.body as URLSearchParams).get("code_verifier")).toBe(
          pending.verifier,
        );
        return Response.json({ id_token: idToken });
      }),
    );
    const callback = await authRoute(
      new Request(
        `${origin}/api/auth/callback?state=${auth.searchParams.get("state")}&code=code`,
        { headers: { Cookie: pendingCookie } },
      ),
      store.env,
    );
    expect(callback!.headers.get("Location")).toBe(`${origin}/`);
    const sessionCookie = callback!.headers
      .getSetCookie()
      .find((v) => v.startsWith("__Host-orbit_session="))!;
    expect(sessionCookie).toContain("HttpOnly; SameSite=Lax; Secure");
    const value = sessionCookie.split(";")[0].split("=")[1];
    expect(store.rows.has(value)).toBe(false);
    expect(store.rows.has(await sessionHash(value))).toBe(true);
    const request = new Request(`${origin}/api/notes`, {
      headers: { Cookie: sessionCookie.split(";")[0] },
    });
    expect(await authorized(request, store.env)).toBe(true);
    const logout = await authRoute(
      new Request(`${origin}/api/auth/logout`, {
        method: "POST",
        headers: { Cookie: sessionCookie.split(";")[0], Origin: origin },
      }),
      store.env,
    );
    expect(logout!.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(await authorized(request, store.env)).toBe(false);
  });
  it("rejects a missing, mismatched, or expired browser state before exchanging a code", async () => {
    const { env } = fixture();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const start = await authRoute(new Request(`${origin}/api/auth/login`), env);
    const response = await authRoute(
      new Request(`${origin}/api/auth/callback?state=wrong&code=code`, {
        headers: { Cookie: start!.headers.get("Set-Cookie")!.split(";")[0] },
      }),
      env,
    );
    expect(response!.headers.get("Location")).toContain("error=expired");
    const missing = await authRoute(
      new Request(`${origin}/api/auth/callback?state=anything&code=code`),
      env,
    );
    expect(missing!.headers.get("Location")).toContain("error=expired");
    const stale = await seal(
      { state: "state", verifier: "verifier", nonce: "nonce", expiresAt: 1 },
      encryptionKey,
    );
    const expired = await authRoute(
      new Request(`${origin}/api/auth/callback?state=state&code=code`, {
        headers: { Cookie: `__Host-orbit_login=${stale}` },
      }),
      env,
    );
    expect(expired!.headers.get("Location")).toContain("error=expired");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects cross-site and missing-origin mutations including logout", async () => {
    const { env } = fixture();
    for (const attacker of ["https://attacker.example", "null", ""]) {
      const request = new Request(`${origin}/api/auth/logout`, {
        method: "POST",
        headers: { Origin: attacker },
      });
      expect(validMutationOrigin(request, env)).toBe(false);
      await expect(authRoute(request, env)).rejects.toMatchObject({
        status: 403,
      });
    }
    expect(
      validMutationOrigin(
        new Request(`${origin}/api/notes`, {
          method: "POST",
          headers: { Origin: origin },
        }),
        env,
      ),
    ).toBe(true);
  });
  it("rejects expired, invented, or no-longer-allowed session cookies", async () => {
    const { env, rows } = fixture();
    const token = base64url.encode(new Uint8Array(32).fill(4));
    const request = new Request(`${origin}/api/notes`, {
      headers: { Cookie: `__Host-orbit_session=${token}` },
    });
    expect(await authorized(request, env)).toBe(false);
    rows.set(await sessionHash(token), {
      email: "owner@gmail.com",
      subject: "owner",
      expires_at: 1,
    });
    expect(await authorized(request, env)).toBe(false);
    rows.set(await sessionHash(token), {
      email: "other@gmail.com",
      subject: "other",
      expires_at: Date.now(),
    });
    expect(await authorized(request, env)).toBe(false);
  });
  it("redirects private HTML to login while exposing only the login shell and static assets", async () => {
    const assets = {
      fetch: async () => new Response("shell"),
    } as unknown as Fetcher;
    const env = { ...fixture().env, ASSETS: assets, APP_MODE: "live" };
    const privatePage = await worker.fetch(
      new Request(`${origin}/storage`),
      env,
    );
    expect(privatePage.status).toBe(302);
    expect(privatePage.headers.get("Location")).toBe("/login");
    expect(
      (await worker.fetch(new Request(`${origin}/login`), env)).status,
    ).toBe(200);
    const api = await worker.fetch(new Request(`${origin}/api/notes`), env);
    expect(api.status).toBe(401);
    expect(api.headers.get("X-Orbit-Auth")).toBe("required");
  });
});

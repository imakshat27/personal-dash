import { afterEach, describe, expect, it, vi } from "vitest";
import { base64url } from "jose";
import { GoogleDriveProvider } from "../worker/providers/drive";
import { googleToken, jwks } from "./google-fixture";
import {
  driveOAuth,
  driveToken,
  seal,
  unseal,
  DRIVE_SCOPE,
  DRIVE_READ_SCOPE,
  type DriveEnv,
} from "../worker/providers/drive-auth";

const secret = base64url.encode(new Uint8Array(32).fill(7));
function database(tokens?: string) {
  const writes: { sql: string; values: unknown[] }[] = [];
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          values = args;
          return statement;
        },
        first: async () =>
          sql.includes("provider_tokens")
            ? tokens
              ? { tokens }
              : null
            : { status: "connected" },
        run: async () => {
          writes.push({ sql, values });
          return { success: true };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { db, writes };
}
function env(db: D1Database): DriveEnv {
  return {
    DB: db,
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    TOKEN_ENCRYPTION_KEY: secret,
    APP_ORIGIN: "https://orbit.imakshat.com",
    OWNER_EMAIL: "owner@gmail.com",
  };
}
async function connected() {
  const store = database(
    await seal(
      {
        refreshToken: "private-refresh",
        accessToken: "private-access",
        expiresAt: Date.now() + 3600000,
      },
      secret,
    ),
  );
  return { ...store, provider: new GoogleDriveProvider(env(store.db)) };
}
afterEach(() => vi.unstubAllGlobals());
describe("Drive authorization", () => {
  it("encrypts persisted tokens and rejects tampering or a changed key", async () => {
    const sealed = await seal({ refreshToken: "private-refresh" }, secret);
    expect(sealed).not.toContain("private-refresh");
    expect(await unseal(sealed, secret)).toEqual({
      refreshToken: "private-refresh",
    });
    await expect(
      unseal(sealed, base64url.encode(new Uint8Array(32).fill(8))),
    ).rejects.toThrow();
    const [iv, ciphertext] = sealed.split(".");
    await expect(
      unseal(
        `${iv}.${ciphertext[0] === "A" ? "B" : "A"}${ciphertext.slice(1)}`,
        secret,
      ),
    ).rejects.toThrow();
  });
  it("binds OAuth to an encrypted browser state and PKCE; only stores encrypted tokens", async () => {
    const store = database();
    const config = env(store.db);
    const start = await driveOAuth(
      new Request(`${config.APP_ORIGIN}/api/integrations/drive/connect`),
      config,
    );
    const auth = new URL(start!.headers.get("Location")!);
    expect(auth.searchParams.get("scope")?.split(" ")).toEqual([
      "openid",
      "email",
      DRIVE_SCOPE,
      DRIVE_READ_SCOPE,
    ]);
    expect(auth.searchParams.get("code_challenge_method")).toBe("S256");
    expect(start!.headers.get("Set-Cookie")).toContain(
      "HttpOnly; SameSite=Lax; Secure",
    );
    const cookie = start!.headers.get("Set-Cookie")!.split(";")[0];
    const pending = await unseal<{ verifier: string; nonce: string }>(
      cookie.split("=")[1],
      secret,
    );
    const idToken = await googleToken(pending.nonce);
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/certs")) return Response.json(jwks);
      expect((init.body as URLSearchParams).get("code_verifier")).toBe(
        pending.verifier,
      );
      return Response.json({
        access_token: "private-access",
        id_token: idToken,
        refresh_token: "private-refresh",
        expires_in: 3600,
        scope: `${DRIVE_READ_SCOPE} ${DRIVE_SCOPE}`,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const callback = new Request(
      `${config.APP_ORIGIN}/api/integrations/drive/callback?state=${auth.searchParams.get("state")}&code=code`,
      { headers: { Cookie: cookie } },
    );
    const result = await driveOAuth(callback, config);
    expect(result!.headers.get("Location")).toBe(
      `${config.APP_ORIGIN}/integrations?drive=connected`,
    );
    expect(result!.headers.get("Set-Cookie")).toContain("Max-Age=0");
    const saved = store.writes.find((write) =>
      write.sql.includes("provider_tokens"),
    )!.values[1] as string;
    expect(saved).not.toContain("private-");
    expect(await unseal(saved, secret)).toMatchObject({
      refreshToken: "private-refresh",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each(["mismatch", "expired", "missing"])(
    "rejects %s OAuth state before exchanging a code",
    async (scenario) => {
      const config = env(database().db);
      const cookie = await seal(
        {
          state: "valid",
          verifier: "verifier",
          expiresAt: Date.now() + (scenario === "expired" ? -1000 : 60000),
        },
        secret,
      );
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        driveOAuth(
          new Request(
            `${config.APP_ORIGIN}/api/integrations/drive/callback?state=${scenario === "mismatch" ? "wrong" : "valid"}&code=code`,
            {
              headers:
                scenario === "missing"
                  ? {}
                  : { Cookie: `orbit_drive_oauth=${cookie}` },
            },
          ),
          config,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("marks a revoked refresh token for reconnection without exposing Google's response", async () => {
    const store = database(
      await seal({ refreshToken: "private-refresh" }, secret),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: "invalid_grant", secret: "never-echo" },
          { status: 400 },
        ),
      ),
    );
    await expect(driveToken(env(store.db))).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("reconnected"),
    });
    expect(store.writes[0].sql).toContain("needs_reauth");
  });
});
describe("Drive file boundaries", () => {
  it("paginates existing files as read-only and recognizes its own uploads", async () => {
    const { provider } = await connected();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        expect(new URL(url).searchParams.get("pageToken")).toBe("next-page");
        expect(new Headers(init.headers).get("Authorization")).toBe(
          "Bearer private-access",
        );
        return Response.json({
          nextPageToken: "more",
          files: [
            {
              id: "existing",
              name: "Existing.txt",
              mimeType: "text/plain",
              size: "123",
            },
            {
              id: "upload",
              name: "Orbit.txt",
              mimeType: "text/plain",
              appProperties: { orbitManaged: "true", orbitPath: "/Ideas" },
            },
          ],
        });
      }),
    );
    const page = await provider.listPage("next-page");
    expect(page.nextCursor).toBe("more");
    expect(page.files[0]).toMatchObject({
      id: "drive:existing",
      writable: false,
      virtualPath: "/Drive",
      size: 123,
    });
    expect(page.files[1]).toMatchObject({
      writable: true,
      virtualPath: "/Ideas",
    });
  });
  it.each(["delete", "rename", "move"] as const)(
    "blocks %s of existing files server-side",
    async (action) => {
      const { provider } = await connected();
      const fetchMock = vi.fn(async () =>
        Response.json({
          id: "existing",
          name: "Existing.txt",
          mimeType: "text/plain",
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        provider[action](
          "drive:existing",
          action === "move" ? "/Ideas" : "name.txt",
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0]).toHaveLength(2);
    },
  );
  it("trashes Orbit uploads instead of permanently deleting them", async () => {
    const { provider } = await connected();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          id: "upload",
          appProperties: { orbitManaged: "true" },
        }),
      )
      .mockResolvedValueOnce(Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    await provider.delete("drive:upload");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ trashed: true }),
    });
  });
  it("uploads bytes into the Orbit folder with app-private mutation markers", async () => {
    const { provider } = await connected();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ files: [{ id: "root" }] }))
      .mockImplementationOnce(async (url: string, init: RequestInit) => {
        expect(url).toContain("/upload/drive/v3/files");
        const body = await (init.body as Blob).text();
        expect(body).toContain('"parents":["root"]');
        expect(body).toContain('"orbitManaged":"true"');
        expect(body).toContain("exact file bytes");
        return Response.json({
          id: "new",
          name: "test.txt",
          mimeType: "text/plain",
          appProperties: { orbitManaged: "true", orbitPath: "/Ideas" },
        });
      });
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await provider.upload(
        new File(["exact file bytes"], "test.txt", { type: "text/plain" }),
        "/Ideas",
      ),
    ).toMatchObject({ id: "drive:new", writable: true, virtualPath: "/Ideas" });
  });
  it("exports native Google documents as PDF", async () => {
    const { provider } = await connected();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          id: "doc",
          name: "Notes",
          mimeType: "application/vnd.google-apps.document",
        }),
      )
      .mockResolvedValueOnce(new Response("pdf bytes"));
    vi.stubGlobal("fetch", fetchMock);
    const file = await provider.get("drive:doc");
    expect(file).toMatchObject({
      name: "Notes.pdf",
      mimeType: "application/pdf",
    });
    expect(await new Response(file!.body).text()).toBe("pdf bytes");
    expect(fetchMock.mock.calls[1][0]).toContain(
      "/export?mimeType=application%2Fpdf",
    );
  });
  it("uses Google's actual account quota", async () => {
    const { provider } = await connected();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          storageQuota: { usage: "2345678", limit: "5000000000000" },
        }),
      ),
    );
    expect(await provider.getUsage()).toMatchObject({
      used: 2345678,
      capacity: 5000000000000,
    });
  });
});

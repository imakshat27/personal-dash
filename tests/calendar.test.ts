import { afterEach, describe, expect, it, vi } from "vitest";
import { base64url } from "jose";
import { dayWindow, indiaDate } from "../shared/calendar";
import { GoogleCalendarProvider } from "../worker/providers/calendar";
import { googleOAuth, type GoogleEnv } from "../worker/providers/google-auth";
import { seal, unseal } from "../worker/security";
import { googleToken, jwks } from "./google-fixture";
const secret = base64url.encode(new Uint8Array(32).fill(7));
async function fixture() {
  const tokens = await seal(
    {
      refreshToken: "refresh",
      accessToken: "calendar-token",
      expiresAt: Date.now() + 3600000,
    },
    secret,
  );
  const writes: { sql: string; values: unknown[] }[] = [];
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          values = args;
          return statement;
        },
        first: async () => ({ tokens }),
        run: async () => {
          writes.push({ sql, values });
          return { success: true };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  const env: GoogleEnv = {
    DB: db,
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    TOKEN_ENCRYPTION_KEY: secret,
    OWNER_EMAIL: "owner@gmail.com",
    APP_ORIGIN: "https://orbit.example",
  };
  return { env, writes, provider: new GoogleCalendarProvider(env) };
}
afterEach(() => vi.unstubAllGlobals());
describe("Google Calendar", () => {
  it("uses India midnight and rejects invalid dates", () => {
    expect(indiaDate(new Date("2026-10-07T20:00:00Z"))).toBe("2026-10-08");
    expect(dayWindow("2026-10-08")).toEqual({
      start: "2026-10-07T18:30:00.000Z",
      end: "2026-10-08T18:30:00.000Z",
    });
    expect(() => dayWindow("2026-02-30")).toThrow();
  });
  it("expands recurring events, preserves all-day dates, omits cancellations and follows pages", async () => {
    const { provider } = await fixture();
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const query = new URL(url).searchParams;
      expect(new Headers(init.headers).get("Authorization")).toBe(
        "Bearer calendar-token",
      );
      expect(query.get("singleEvents")).toBe("true");
      if (query.has("pageToken"))
        return Response.json({
          items: [
            {
              id: "timed",
              summary: "Meeting",
              start: { dateTime: "2026-10-08T09:00:00+05:30" },
              end: { dateTime: "2026-10-08T10:00:00+05:30" },
            },
          ],
        });
      return Response.json({
        nextPageToken: "page2",
        items: [
          {
            id: "day",
            summary: "Day off",
            start: { date: "2026-10-08" },
            end: { date: "2026-10-09" },
          },
          { id: "cancelled", status: "cancelled" },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const events = await provider.events("2026-10-08");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      allDay: true,
      start: "2026-10-08",
      end: "2026-10-09",
    });
    expect(events[1]).toMatchObject({ allDay: false, title: "Meeting" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("marks a rejected connection for reauthorization", async () => {
    const { provider, writes } = await fixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await expect(provider.events("2026-10-08")).rejects.toMatchObject({
      status: 401,
    });
    expect(writes[0].sql).toContain("needs_reauth");
  });
  it("stores Calendar consent separately from Drive using only read scope", async () => {
    const { env, writes } = await fixture();
    const start = await googleOAuth(
      new Request(`${env.APP_ORIGIN}/api/integrations/calendar/connect`),
      env,
    );
    const auth = new URL(start!.headers.get("Location")!);
    expect(auth.searchParams.get("scope")).toBe(
      "openid email https://www.googleapis.com/auth/calendar.events.readonly",
    );
    const cookie = start!.headers.get("Set-Cookie")!.split(";")[0];
    const pending = await unseal<{ nonce: string }>(
      cookie.split("=")[1],
      secret,
    );
    const idToken = await googleToken(pending.nonce);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/certs")
          ? Response.json(jwks)
          : Response.json({
              access_token: "access",
              refresh_token: "refresh",
              expires_in: 3600,
              id_token: idToken,
              scope: "https://www.googleapis.com/auth/calendar.events.readonly",
            }),
      ),
    );
    const callback = await googleOAuth(
      new Request(
        `${env.APP_ORIGIN}/api/integrations/calendar/callback?state=${auth.searchParams.get("state")}&code=code`,
        { headers: { Cookie: cookie } },
      ),
      env,
    );
    expect(callback!.headers.get("Location")).toContain("calendar=connected");
    expect(
      writes.find((w) => w.sql.includes("provider_tokens"))!.values[0],
    ).toBe("calendar");
    expect(writes.every((w) => w.values[0] === "calendar")).toBe(true);
  });
});

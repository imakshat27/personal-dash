import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudflareProvider } from "../worker/providers/cloudflare";
import worker from "../worker";
const env = {
  CLOUDFLARE_API_TOKEN: "private-test-token",
  CLOUDFLARE_ACCOUNT_ID: "account",
};
const zone = { id: "zone", name: "example.com", status: "active" };
const now = new Date("2026-10-07T15:33:00Z");
function fixture(current: unknown[] = [], previous: unknown[] = []) {
  return { data: { viewer: { zones: [{ current, previous }] } } };
}
afterEach(() => vi.unstubAllGlobals());
describe("read-only Cloudflare analytics", () => {
  it("scopes reads to the account, fills missing hours and compares completed periods", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        expect(new Headers(init.headers).get("Authorization")).toBe(
          "Bearer private-test-token",
        );
        if (url.includes("zones?")) {
          expect(new URL(url).searchParams.get("account.id")).toBe("account");
          expect(init.method).toBeUndefined();
          return Response.json({ success: true, result: [zone] });
        }
        expect(init.method).toBe("POST");
        const { variables, query } = JSON.parse(String(init.body));
        expect(query).not.toContain("mutation");
        expect(variables.current).toEqual({
          datetime_geq: "2026-10-06T15:00:00.000Z",
          datetime_lt: "2026-10-07T15:00:00.000Z",
          requestSource: "eyeball",
        });
        expect(variables.previous.datetime_lt).toBe(
          variables.current.datetime_geq,
        );
        return Response.json(
          fixture(
            [
              {
                count: 30,
                dimensions: { datetimeHour: "2026-10-07T14:00:00Z" },
                sum: { edgeResponseBytes: 300 },
              },
              {
                count: 10,
                dimensions: { datetimeHour: "2026-10-06T15:00:00Z" },
                sum: { edgeResponseBytes: 100 },
              },
            ],
            [{ count: 20 }],
          ),
        );
      }),
    );
    const [site] = await new CloudflareProvider(env).sites(now);
    expect(site).toMatchObject({
      requests: 40,
      bandwidth: 400,
      change: 100,
      status: "healthy",
    });
    expect(site.series).toHaveLength(24);
    expect(site.series[0]).toBe(10);
    expect(site.series[1]).toBe(0);
    expect(site.series[23]).toBe(30);
  });
  it("shows zero traffic without inventing a percentage change", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        Response.json(
          url.includes("zones?")
            ? { success: true, result: [zone] }
            : fixture(),
        ),
      ),
    );
    expect((await new CloudflareProvider(env).sites(now))[0]).toMatchObject({
      requests: 0,
      change: null,
      series: Array(24).fill(0),
    });
  });
  it("isolates one zone's GraphQL error and never exposes provider details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.includes("zones?"))
          return Response.json({
            success: true,
            result: [zone, { ...zone, id: "other" }],
          });
        return Response.json(
          JSON.parse(String(init.body)).variables.tag === "zone"
            ? { errors: [{ message: "private-test-token" }] }
            : fixture(),
        );
      }),
    );
    const sites = await new CloudflareProvider(env).sites(now);
    expect(sites[0].requests).toBeNull();
    expect(sites[0].analyticsError).not.toContain("private-test-token");
    expect(sites[1].requests).toBe(0);
  });
  it.each([401, 403, 429, 500])(
    "sanitizes HTTP %s failures",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("private-test-token", { status })),
      );
      await expect(new CloudflareProvider(env).sites(now)).rejects.not.toThrow(
        "private-test-token",
      );
    },
  );
  it("refuses empty or truncated zone lists during verification", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: true, result: [] })),
    );
    await expect(new CloudflareProvider(env).verify()).rejects.toThrow(
      "No zones",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          result: [zone],
          result_info: { total_count: 21 },
        }),
      ),
    );
    await expect(new CloudflareProvider(env).verify()).rejects.toThrow(
      "up to 20 zones",
    );
  });
  it("protects verification and rejects server demo connections", async () => {
    const ASSETS = {
      fetch: async () => new Response("shell"),
    } as unknown as Fetcher;
    expect(
      (
        await worker.fetch(
          new Request(
            "https://private.example/api/integrations/cloudflare/connect",
            { method: "POST" },
          ),
          { ASSETS, APP_MODE: "live" },
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await worker.fetch(
          new Request("http://localhost/api/integrations/cloudflare/connect", {
            method: "POST",
          }),
          { ASSETS, LOCAL_DEV: "true", APP_MODE: "demo" },
        )
      ).status,
    ).toBe(409);
  });
});

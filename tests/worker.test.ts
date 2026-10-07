import { describe, it, expect } from "vitest";
import worker, { authorized } from "../worker";
const assets = {
  fetch: async () => new Response("shell"),
} as unknown as Fetcher;
describe("private Worker API", () => {
  it("fails closed when Access is not configured", async () => {
    const response = await worker.fetch(
      new Request("https://private.example/api/notes"),
      { ASSETS: assets },
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("does not allow the development bypass on public hostnames", async () => {
    expect(
      await authorized(new Request("https://public.example/api/notes"), {
        ASSETS: assets,
        LOCAL_DEV: "true",
      }),
    ).toBe(false);
  });
  it("serves local demo reads and rejects server demo writes", async () => {
    const env = { ASSETS: assets, LOCAL_DEV: "true", APP_MODE: "demo" };
    const read = await worker.fetch(
      new Request("http://localhost/api/storage/files"),
      env,
    );
    expect(read.status).toBe(200);
    expect(((await read.json()) as { mode: string }).mode).toBe("demo");
    const write = await worker.fetch(
      new Request("http://localhost/api/notes", { method: "POST", body: "{}" }),
      env,
    );
    expect(write.status).toBe(409);
  });
  it("rejects malformed note payloads before touching the database", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "",
          body: "",
          color: "sage",
          pinned: false,
        }),
      }),
      { ASSETS: assets, LOCAL_DEV: "true", APP_MODE: "live" },
    );
    expect(response.status).toBe(400);
  });
});

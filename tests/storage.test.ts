import { describe, it, expect, vi } from "vitest";
import { safeName, safePath } from "../worker/providers/storage";
import { R2StorageProvider } from "../worker/providers/r2";
describe("virtual filesystem validation", () => {
  it("rejects traversal and invalid filenames", () => {
    for (const path of ["/Documents/../private", "relative", "/bad\\path"])
      expect(() => safePath(path)).toThrow();
    for (const name of ["", "../token", "file/name", "bad\x00name"])
      expect(() => safeName(name)).toThrow();
  });
  it("normalizes folders without changing their meaning", () => {
    expect(safePath("/Documents///")).toBe("/Documents");
    expect(safePath("/")).toBe("/");
    expect(safeName(" notes.md ")).toBe("notes.md");
  });
});
describe("R2 upload consistency", () => {
  it("rolls back an uploaded object when the metadata insert fails", async () => {
    const bucket = {
      put: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(null),
    };
    const db = {
      prepare: vi
        .fn()
        .mockReturnValue({
          bind: vi
            .fn()
            .mockReturnValue({
              run: vi.fn().mockRejectedValue(new Error("D1 unavailable")),
            }),
        }),
    };
    const provider = new R2StorageProvider(
      bucket as unknown as R2Bucket,
      db as unknown as D1Database,
    );
    await expect(
      provider.upload(
        new File(["hello"], "hello.txt", { type: "text/plain" }),
        "/Documents",
      ),
    ).rejects.toThrow("D1 unavailable");
    expect(bucket.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^files\//),
    );
  });
});

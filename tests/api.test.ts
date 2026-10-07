import { beforeEach, describe, it, expect, vi } from "vitest";
import { api, bytes } from "../src/lib/api";
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  });
});
describe("local demo notes", () => {
  it("persists create, update and deletion without mutating sample notes", async () => {
    const initial = (await api.notes()).length;
    const note = await api.saveNote({
      title: "A real thought",
      body: "Keep me",
      color: "sage",
      pinned: false,
    });
    expect((await api.notes()).length).toBe(initial + 1);
    await api.saveNote({ ...note, title: "Updated", pinned: true }, note.id);
    expect((await api.notes()).find((n) => n.id === note.id)?.title).toBe(
      "Updated",
    );
    await api.deleteNote(note.id);
    expect((await api.notes()).length).toBe(initial);
  });
  it("formats logical storage sizes", () => {
    expect(bytes(15000000000)).toBe("15.0 GB");
    expect(bytes(2400000)).toBe("2.4 MB");
  });
});

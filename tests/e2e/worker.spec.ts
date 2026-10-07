import { test, expect } from "@playwright/test";
const endpoint = "http://localhost:8787/api";
test("live local D1 and R2 retain notes, metadata and exact file bytes", async ({
  request,
}) => {
  const note = await request.post(`${endpoint}/notes`, {
    data: {
      title: "Worker round-trip",
      body: "A persisted thought",
      color: "sage",
      pinned: false,
    },
  });
  expect(note.status()).toBe(201);
  const noteId = (await note.json()).data.id;
  try {
    expect(
      (await (await request.get(`${endpoint}/notes`)).json()).data.some(
        (n: { id: string }) => n.id === noteId,
      ),
    ).toBe(true);
    expect(
      (
        await request.put(`${endpoint}/notes/${noteId}`, {
          data: {
            title: "Updated thought",
            body: "Saved twice",
            color: "lavender",
            pinned: true,
          },
        })
      ).status(),
    ).toBe(200);
  } finally {
    await request.delete(`${endpoint}/notes/${noteId}`);
  }
  const upload = await request.post(`${endpoint}/storage/files`, {
    multipart: {
      file: {
        name: "worker-check.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("exact R2 bytes"),
      },
      path: "/Documents",
    },
  });
  expect(upload.status()).toBe(201);
  const file = (await upload.json()).data;
  try {
    const download = await request.get(
      `${endpoint}/storage/files/${file.id}/download`,
    );
    expect(await download.text()).toBe("exact R2 bytes");
    expect(download.headers()["cache-control"]).toBe("no-store");
    expect(
      (
        await request.patch(`${endpoint}/storage/files/${file.id}`, {
          data: { name: "renamed.txt", virtualPath: "/Archives" },
        })
      ).status(),
    ).toBe(200);
    const files = (
      await (await request.get(`${endpoint}/storage/files`)).json()
    ).data;
    expect(files.find((f: { id: string }) => f.id === file.id)).toMatchObject({
      name: "renamed.txt",
      virtualPath: "/Archives",
    });
    const invalid = await request.patch(
      `${endpoint}/storage/files/${file.id}`,
      { data: { virtualPath: "/../private" } },
    );
    expect(invalid.status()).toBe(400);
  } finally {
    expect(
      (await request.delete(`${endpoint}/storage/files/${file.id}`)).status(),
    ).toBe(200);
  }
  expect(
    (
      await request.get(`${endpoint}/storage/files/${file.id}/download`)
    ).status(),
  ).toBe(404);
});

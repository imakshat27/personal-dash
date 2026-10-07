import type { StorageFile, StorageUsage } from "../../shared/models";
import { safeName, safePath, type StorageProvider } from "./storage";
export class R2StorageProvider implements StorageProvider {
  readonly id = "r2";
  constructor(
    private bucket: R2Bucket,
    private db: D1Database,
  ) {}
  async list(): Promise<StorageFile[]> {
    const { results } = await this.db
      .prepare(
        "SELECT id, provider, provider_id AS providerId, name, virtual_path AS virtualPath, mime_type AS mimeType, size, modified_at AS modifiedAt FROM files WHERE provider = ? ORDER BY modified_at DESC",
      )
      .bind(this.id)
      .all<StorageFile>();
    return results;
  }
  async search(query: string) {
    return (await this.list()).filter((file) =>
      file.name.toLowerCase().includes(query.toLowerCase()),
    );
  }
  async get(id: string) {
    const file = (await this.list()).find((f) => f.id === id);
    if (!file) return null;
    const object = await this.bucket.get(file.providerId);
    return object
      ? { body: object.body, mimeType: file.mimeType, name: file.name }
      : null;
  }
  async upload(file: File, path: string): Promise<StorageFile> {
    const name = safeName(file.name);
    const virtualPath = safePath(path);
    const id = crypto.randomUUID();
    const providerId = `files/${id}`;
    const modifiedAt = new Date().toISOString();
    await this.bucket.put(providerId, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    try {
      await this.db
        .prepare(
          "INSERT INTO files (id,provider,provider_id,name,virtual_path,mime_type,size,modified_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          this.id,
          providerId,
          name,
          virtualPath,
          file.type || "application/octet-stream",
          file.size,
          modifiedAt,
        )
        .run();
    } catch (error) {
      await this.bucket.delete(providerId);
      throw error;
    }
    return {
      id,
      provider: "r2",
      providerId,
      name,
      virtualPath,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      modifiedAt,
    };
  }
  async delete(id: string) {
    const file = (await this.list()).find((f) => f.id === id);
    if (!file) throw new Error("File not found.");
    await this.bucket.delete(file.providerId);
    await this.db
      .prepare("DELETE FROM files WHERE id = ? AND provider = ?")
      .bind(id, this.id)
      .run();
  }
  async move(id: string, path: string) {
    await this.db
      .prepare(
        "UPDATE files SET virtual_path = ?, modified_at = ? WHERE id = ? AND provider = ?",
      )
      .bind(safePath(path), new Date().toISOString(), id, this.id)
      .run();
  }
  async rename(id: string, name: string) {
    await this.db
      .prepare(
        "UPDATE files SET name = ?, modified_at = ? WHERE id = ? AND provider = ?",
      )
      .bind(safeName(name), new Date().toISOString(), id, this.id)
      .run();
  }
  async getUsage(): Promise<StorageUsage> {
    const row = await this.db
      .prepare(
        "SELECT COALESCE(SUM(size),0) AS used FROM files WHERE provider = ?",
      )
      .bind(this.id)
      .first<{ used: number }>();
    return {
      provider: "r2",
      label: "Cloudflare R2",
      used: row?.used || 0,
      capacity: null,
    };
  }
}

import type { StorageFile, StorageUsage } from "../../shared/models";
import { safeName, safePath, type StorageProvider } from "./storage";
import { driveToken, type DriveEnv } from "./drive-auth";
import { ProviderError } from "./errors";
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  appProperties?: Record<string, string>;
}
const fields = "id,name,mimeType,size,modifiedTime,appProperties";
export class GoogleDriveProvider implements StorageProvider {
  readonly id = "drive";
  private token?: Promise<string>;
  constructor(private env: DriveEnv) {}
  private async call(path: string, options: RequestInit = {}, upload = false) {
    this.token ??= driveToken(this.env);
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${await this.token}`);
    const response = await fetch(
      `https://www.googleapis.com/${upload ? "upload/" : ""}drive/v3/${path}`,
      { ...options, headers },
    );
    if (!response.ok) {
      if (response.status === 404)
        throw new ProviderError("File not found in Google Drive.", 404);
      if (response.status === 401)
        throw new ProviderError(
          "Google Drive needs to be reconnected in Integrations.",
          401,
        );
      if (response.status === 403)
        throw new ProviderError(
          "Google Drive declined this action. Check storage space and reconnect if permissions changed.",
          403,
        );
      if (response.status === 429)
        throw new ProviderError(
          "Google Drive is busy. Please try again shortly.",
          429,
        );
      throw new ProviderError(
        "Google Drive could not complete the request. Please try again.",
      );
    }
    return response;
  }
  private normalized(file: DriveFile): StorageFile {
    return {
      id: `drive:${file.id}`,
      provider: "drive",
      providerId: file.id,
      name: file.name,
      virtualPath:
        file.appProperties?.orbitManaged === "true"
          ? file.appProperties.orbitPath || "/Documents"
          : "/Drive",
      mimeType: file.mimeType,
      size: Number(file.size || 0),
      modifiedAt: file.modifiedTime || new Date(0).toISOString(),
      writable: file.appProperties?.orbitManaged === "true",
    };
  }
  private providerId(id: string) {
    if (!id.startsWith("drive:") || !/^[-\w]+$/.test(id.slice(6)))
      throw new ProviderError("File not found.", 404);
    return id.slice(6);
  }
  async listPage(
    cursor?: string,
  ): Promise<{ files: StorageFile[]; nextCursor?: string }> {
    const query = new URLSearchParams({
      q: "trashed=false and mimeType!='application/vnd.google-apps.folder'",
      pageSize: "100",
      orderBy: "modifiedTime desc",
      fields: `nextPageToken,files(${fields})`,
    });
    if (cursor) query.set("pageToken", cursor);
    const response = await this.call(`files?${query}`);
    const result = (await response.json()) as {
      files: DriveFile[];
      nextPageToken?: string;
    };
    return {
      files: result.files.map((file) => this.normalized(file)),
      nextCursor: result.nextPageToken,
    };
  }
  async list(): Promise<StorageFile[]> {
    return (await this.listPage()).files;
  }
  async search(query: string) {
    return (await this.list()).filter((f) =>
      f.name.toLowerCase().includes(query.toLowerCase()),
    );
  }
  private async managed(id: string) {
    const response = await this.call(
      `files/${this.providerId(id)}?fields=${encodeURIComponent(fields)}`,
    );
    const file = (await response.json()) as DriveFile;
    if (file.appProperties?.orbitManaged !== "true")
      throw new ProviderError("This file was not added through Orbit.", 403);
    return file;
  }
  async get(id: string) {
    let file: DriveFile;
    try {
      file = (await (
        await this.call(
          `files/${this.providerId(id)}?fields=${encodeURIComponent(fields)}`,
        )
      ).json()) as DriveFile;
    } catch (error) {
      if (error instanceof ProviderError && error.status === 404) return null;
      throw error;
    }
    const native = file.mimeType.startsWith("application/vnd.google-apps.");
    const exportable = [
      "application/vnd.google-apps.document",
      "application/vnd.google-apps.spreadsheet",
      "application/vnd.google-apps.presentation",
      "application/vnd.google-apps.drawing",
    ];
    if (native && !exportable.includes(file.mimeType))
      throw new ProviderError(
        "Open this Google file in Drive to download it.",
        400,
      );
    const response = await this.call(
      native
        ? `files/${file.id}/export?mimeType=application%2Fpdf`
        : `files/${file.id}?alt=media`,
    );
    if (!response.body) return null;
    return {
      body: response.body,
      mimeType: native ? "application/pdf" : file.mimeType,
      name: native ? `${file.name}.pdf` : file.name,
    };
  }
  private async folder(): Promise<string> {
    const query = new URLSearchParams({
      q: "trashed=false and mimeType='application/vnd.google-apps.folder' and appProperties has { key='orbitRoot' and value='true' }",
      fields: "files(id)",
      pageSize: "10",
    });
    const result = (await (await this.call(`files?${query}`)).json()) as {
      files: { id: string }[];
    };
    if (result.files[0]) return result.files[0].id;
    const response = await this.call("files?fields=id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Orbit",
        mimeType: "application/vnd.google-apps.folder",
        appProperties: { orbitRoot: "true" },
      }),
    });
    return ((await response.json()) as { id: string }).id;
  }
  async upload(file: File, path: string): Promise<StorageFile> {
    const name = safeName(file.name);
    const virtualPath = safePath(path);
    const metadata = {
      name,
      mimeType: file.type || "application/octet-stream",
      parents: [await this.folder()],
      appProperties: { orbitManaged: "true", orbitPath: virtualPath },
    };
    const boundary = `orbit_${crypto.randomUUID()}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`,
      file,
      `\r\n--${boundary}--\r\n`,
    ]);
    const response = await this.call(
      `files?uploadType=multipart&fields=${encodeURIComponent(fields)}`,
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
      true,
    );
    return this.normalized((await response.json()) as DriveFile);
  }
  async delete(id: string) {
    await this.managed(id);
    await this.call(`files/${this.providerId(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
  }
  async move(id: string, path: string) {
    await this.managed(id);
    await this.call(`files/${this.providerId(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appProperties: { orbitPath: safePath(path) } }),
    });
  }
  async rename(id: string, name: string) {
    await this.managed(id);
    await this.call(`files/${this.providerId(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: safeName(name) }),
    });
  }
  async getUsage(): Promise<StorageUsage> {
    const result = (await (
      await this.call("about?fields=storageQuota")
    ).json()) as { storageQuota: { usage?: string; limit?: string } };
    return {
      provider: "drive",
      label: "Google Drive",
      used: Number(result.storageQuota.usage || 0),
      capacity: result.storageQuota.limit
        ? Number(result.storageQuota.limit)
        : null,
    };
  }
}

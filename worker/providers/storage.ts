import type { StorageFile, StorageUsage } from "../../shared/models";
export interface StorageProvider {
  readonly id: string;
  list(): Promise<StorageFile[]>;
  search(query: string): Promise<StorageFile[]>;
  get(
    id: string,
  ): Promise<{ body: ReadableStream; mimeType: string; name: string } | null>;
  upload(file: File, path: string): Promise<StorageFile>;
  delete(id: string): Promise<void>;
  move(id: string, path: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  getUsage(): Promise<StorageUsage>;
}
export function safeName(name: string): string {
  const value = name.trim();
  if (
    !value ||
    value.length > 255 ||
    /[/\\]/.test(value) ||
    [...value].some((c) => c.charCodeAt(0) < 32)
  )
    throw new Error("Use a filename without slashes or control characters.");
  return value;
}
export function safePath(path: string): string {
  if (
    !path.startsWith("/") ||
    path.length > 512 ||
    path.includes("\\") ||
    [...path].some((c) => c.charCodeAt(0) < 32) ||
    path.split("/").includes("..")
  )
    throw new Error("Choose a valid virtual folder.");
  return path.replace(/\/+$/, "") || "/";
}

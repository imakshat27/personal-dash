import type {
  ApiResult,
  DashboardData,
  Integration,
  Note,
  StorageFile,
  StorageUsage,
} from "../../shared/models";
import {
  demoDashboard,
  demoFiles,
  demoIntegrations,
  demoNotes,
  demoUsage,
} from "../../shared/demo";
export const isDemo = import.meta.env.VITE_API_MODE !== "live";
const key = (name: string) => `orbit.demo.${name}`;
function local<T>(name: string, initial: T): T {
  try {
    return JSON.parse(localStorage.getItem(key(name)) || "null") ?? initial;
  } catch {
    return initial;
  }
}
function save(name: string, data: unknown) {
  localStorage.setItem(key(name), JSON.stringify(data));
}
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, options);
  const result = (await response.json()) as ApiResult<T> & {
    data: { message?: string };
  };
  if (!response.ok)
    throw new Error(
      result.data?.message || "Something went wrong. Please try again.",
    );
  return result.data;
}
function body(data: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}
export const api = {
  dashboard: () =>
    isDemo
      ? Promise.resolve(demoDashboard)
      : request<DashboardData>("/dashboard"),
  integrations: () =>
    isDemo
      ? Promise.resolve(demoIntegrations)
      : request<Integration[]>("/integrations"),
  files: () =>
    isDemo
      ? Promise.resolve(local<StorageFile[]>("files", demoFiles))
      : request<StorageFile[]>("/storage/files"),
  usage: () =>
    isDemo
      ? Promise.resolve(demoUsage)
      : request<StorageUsage[]>("/storage/usage"),
  notes: () =>
    isDemo
      ? Promise.resolve(local<Note[]>("notes", demoNotes))
      : request<Note[]>("/notes"),
  async saveNote(note: Omit<Note, "id" | "updatedAt">, id?: string) {
    if (!isDemo)
      return request<Note>(
        id ? `/notes/${id}` : "/notes",
        body(note, id ? "PUT" : "POST"),
      );
    const notes = await api.notes();
    const value = {
      ...note,
      id: id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    save("notes", [value, ...notes.filter((n) => n.id !== value.id)]);
    return value;
  },
  async deleteNote(id: string) {
    if (!isDemo) return request(`/notes/${id}`, { method: "DELETE" });
    save(
      "notes",
      (await api.notes()).filter((n) => n.id !== id),
    );
  },
  async upload(file: File, path: string) {
    if (!isDemo) {
      const form = new FormData();
      form.append("file", file);
      form.append("path", path);
      return request<StorageFile>("/storage/files", {
        method: "POST",
        body: form,
      });
    }
    if (file.size > 25 * 1024 * 1024)
      throw new Error("Please choose a file under 25 MB.");
    const id = crypto.randomUUID();
    await storeBlob(id, file);
    const item: StorageFile = {
      id,
      provider: "r2",
      providerId: id,
      name: file.name,
      virtualPath: path,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      modifiedAt: new Date().toISOString(),
    };
    save("files", [item, ...(await api.files())]);
    return item;
  },
  async deleteFile(id: string) {
    if (!isDemo) return request(`/storage/files/${id}`, { method: "DELETE" });
    save(
      "files",
      (await api.files()).filter((f) => f.id !== id),
    );
    await blobAction("readwrite", (store) => store.delete(id));
  },
  async updateFile(id: string, patch: { name?: string; virtualPath?: string }) {
    if (!isDemo) return request(`/storage/files/${id}`, body(patch, "PATCH"));
    save(
      "files",
      (await api.files()).map((f) =>
        f.id === id
          ? { ...f, ...patch, modifiedAt: new Date().toISOString() }
          : f,
      ),
    );
  },
  async download(file: StorageFile) {
    if (!isDemo) {
      const response = await fetch(`/api/storage/files/${file.id}/download`);
      if (!response.ok)
        throw new Error("Could not download this file. Please try again.");
      return response.blob();
    }
    const stored = await blobAction<Blob | undefined>("readonly", (store) =>
      store.get(file.id),
    );
    if (!stored)
      throw new Error(
        "This is a sample file. Upload your own file to try downloading.",
      );
    return stored;
  },
};
function blobAction<T = unknown>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("orbit-demo-files", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("files");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("files", mode);
      const operation = action(tx.objectStore("files"));
      let result: T;
      operation.onsuccess = () => {
        result = operation.result;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
function storeBlob(id: string, file: File) {
  return blobAction("readwrite", (store) => store.put(file, id));
}
export function bytes(value: number) {
  if (value < 1000) return `${value} B`;
  if (value < 1e6) return `${(value / 1000).toFixed(1)} KB`;
  if (value < 1e9) return `${(value / 1e6).toFixed(1)} MB`;
  return `${(value / 1e9).toFixed(1)} GB`;
}
export function time(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

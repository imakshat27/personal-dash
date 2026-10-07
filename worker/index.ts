import { authorized, authRoute, validMutationOrigin } from "./auth";
export { authorized } from "./auth";
import { z } from "zod";
import {
  demoDashboard,
  demoFiles,
  demoIntegrations,
  demoNotes,
  demoUsage,
} from "../shared/demo";
import type { Note } from "../shared/models";
import { R2StorageProvider } from "./providers/r2";
import { GoogleDriveProvider } from "./providers/drive";
import {
  driveOAuth,
  driveConfigured,
  driveConnected,
  type DriveEnv,
} from "./providers/drive-auth";
import { ProviderError } from "./providers/errors";
import { safeName, safePath } from "./providers/storage";
interface Env extends DriveEnv {
  ASSETS: Fetcher;
  DB?: D1Database;
  FILES?: R2Bucket;
  APP_MODE?: string;
  STORAGE_PROVIDER?: string;
  LOCAL_DEV?: string;
  OWNER_EMAIL?: string;
}
const noteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(50000),
  color: z.enum(["sage", "lavender", "sand"]),
  pinned: z.boolean(),
});
const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    virtualPath: z.string().max(512).optional(),
  })
  .refine((v) => v.name || v.virtualPath, "Provide a name or folder.");
function json(data: unknown, mode: string, status = 200, nextCursor?: string) {
  return Response.json(
    { data, mode, ...(nextCursor ? { nextCursor } : {}) },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const mode = env.APP_MODE === "live" ? "live" : "demo";
    const path = url.pathname;
    const method = request.method;
    try {
      const auth = await authRoute(request, env);
      if (auth) return auth;
      const publicAsset =
        path.startsWith("/assets/") ||
        /^\/(?:favicon\.svg|icon-(?:192|512)\.png|manifest\.webmanifest|registerSW\.js|sw\.js|workbox-[\w-]+\.js)$/.test(
          path,
        );
      if (path === "/login" || publicAsset) return env.ASSETS.fetch(request);
      if (!(await authorized(request, env))) {
        if (path.startsWith("/api/")) {
          const response = json(
            { message: "Sign in with Google to open your private space." },
            "live",
            401,
          );
          response.headers.set("X-Orbit-Auth", "required");
          return response;
        }
        return new Response(null, {
          status: 302,
          headers: { Location: "/login", "Cache-Control": "no-store" },
        });
      }
      if (!validMutationOrigin(request, env))
        return json(
          { message: "This request did not come from Orbit." },
          mode,
          403,
        );
      if (!path.startsWith("/api/")) {
        const response = await env.ASSETS.fetch(request);
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "no-store");
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      if (mode === "live") {
        const oauth = await driveOAuth(request, env);
        if (oauth) return oauth;
      }
      if (path === "/api/dashboard" && method === "GET")
        return json(
          mode === "demo"
            ? demoDashboard
            : { sites: [], events: [], activity: [] },
          mode,
        );
      if (path === "/api/calendar" && method === "GET")
        return json(mode === "demo" ? demoDashboard.events : [], mode);
      if (path === "/api/sites" && method === "GET")
        return json(mode === "demo" ? demoDashboard.sites : [], mode);
      if (path === "/api/integrations" && method === "GET") {
        const driveStatus =
          mode === "demo"
            ? "demo"
            : driveConfigured(env)
              ? (
                  await database(env)
                    .prepare("SELECT status FROM integrations WHERE id='drive'")
                    .first<{ status: string }>()
                )?.status || "not_configured"
              : "not_configured";
        return json(
          demoIntegrations
            .filter((i) => i.id !== "r2")
            .map((i) => ({
              ...i,
              configured: i.id === "drive" && driveConfigured(env),
              status:
                mode === "demo"
                  ? i.status
                  : i.id === "drive"
                    ? driveStatus
                    : "not_configured",
            })),
          mode,
        );
      }
      if (path === "/api/storage/files" && method === "GET") {
        if (mode === "demo") return json(demoFiles, mode);
        if (env.STORAGE_PROVIDER === "r2")
          return json(await storage(env).list(), mode);
        if (!(await driveConnected(env))) return json([], mode);
        const page = await new GoogleDriveProvider(env).listPage(
          url.searchParams.get("cursor") || undefined,
        );
        return json(page.files, mode, 200, page.nextCursor);
      }
      if (path === "/api/storage/usage" && method === "GET") {
        if (mode === "demo") return json(demoUsage, mode);
        if (env.STORAGE_PROVIDER !== "r2" && !(await driveConnected(env)))
          return json([], mode);
        return json([await storage(env).getUsage()], mode);
      }
      if (path === "/api/notes" && method === "GET") {
        if (mode === "demo") return json(demoNotes, mode);
        const { results } = await database(env)
          .prepare(
            "SELECT id,title,body,color,pinned,updated_at AS updatedAt FROM notes ORDER BY updated_at DESC",
          )
          .all<Note>();
        return json(
          results.map((n) => ({ ...n, pinned: Boolean(n.pinned) })),
          mode,
        );
      }
      if (mode === "demo" && method !== "GET")
        return json(
          {
            message:
              "Demo changes are stored in this browser. Connect D1 and Google Drive for server storage.",
          },
          mode,
          409,
        );
      if (path === "/api/notes" && method === "POST") {
        const data = noteSchema.parse(await request.json());
        const note = {
          ...data,
          id: crypto.randomUUID(),
          updatedAt: new Date().toISOString(),
        };
        await database(env)
          .prepare(
            "INSERT INTO notes (id,title,body,color,pinned,updated_at) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            note.id,
            note.title,
            note.body,
            note.color,
            Number(note.pinned),
            note.updatedAt,
          )
          .run();
        return json(note, mode, 201);
      }
      const noteMatch = path.match(/^\/api\/notes\/([^/]+)$/);
      if (noteMatch && method === "PUT") {
        const data = noteSchema.parse(await request.json());
        const updatedAt = new Date().toISOString();
        const result = await database(env)
          .prepare(
            "UPDATE notes SET title=?,body=?,color=?,pinned=?,updated_at=? WHERE id=?",
          )
          .bind(
            data.title,
            data.body,
            data.color,
            Number(data.pinned),
            updatedAt,
            noteMatch[1],
          )
          .run();
        if (!result.meta.changes)
          return json({ message: "Note not found." }, mode, 404);
        return json({ ...data, id: noteMatch[1], updatedAt }, mode);
      }
      if (noteMatch && method === "DELETE") {
        await database(env)
          .prepare("DELETE FROM notes WHERE id=?")
          .bind(noteMatch[1])
          .run();
        return json(null, mode);
      }
      if (path === "/api/storage/files" && method === "POST") {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File))
          return json({ message: "Select a file to upload." }, mode, 400);
        if (file.size > 25 * 1024 * 1024)
          return json(
            { message: "This first version supports uploads up to 25 MB." },
            mode,
            413,
          );
        return json(
          await storage(env).upload(
            file,
            String(form.get("path") || "/Documents"),
          ),
          mode,
          201,
        );
      }
      const fileMatch = path.match(
        /^\/api\/storage\/files\/([^/]+)(\/download)?$/,
      );
      if (fileMatch) {
        const provider = storage(env);
        const id = fileMatch[1];
        if (method === "GET" && fileMatch[2]) {
          const file = await provider.get(id);
          if (!file) return json({ message: "File not found." }, mode, 404);
          return new Response(file.body, {
            headers: {
              "Content-Type": file.mimeType,
              "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
        if (method === "DELETE") {
          await provider.delete(id);
          return json(null, mode);
        }
        if (method === "PATCH") {
          const data = patchSchema.parse(await request.json());
          if (data.name) safeName(data.name);
          if (data.virtualPath) safePath(data.virtualPath);
          if (data.name) await provider.rename(id, data.name);
          if (data.virtualPath) await provider.move(id, data.virtualPath);
          return json(null, mode);
        }
      }
      return json({ message: "This endpoint is not available." }, mode, 404);
    } catch (error) {
      if (error instanceof ProviderError)
        return json({ message: error.message }, mode, error.status);
      if (error instanceof SyntaxError)
        return json({ message: "Send valid JSON and try again." }, mode, 400);
      if (error instanceof z.ZodError)
        return json({ message: error.issues[0].message }, mode, 400);
      if (
        error instanceof Error &&
        /filename|virtual folder/.test(error.message)
      )
        return json({ message: error.message }, mode, 400);
      console.error("API request failed", error);
      return json(
        { message: "Could not complete the request. Please try again." },
        mode,
        500,
      );
    }
  },
};
function database(env: Env) {
  if (!env.DB) throw new Error("D1 binding is missing.");
  return env.DB;
}
function storage(env: Env) {
  if (env.STORAGE_PROVIDER !== "r2") return new GoogleDriveProvider(env);
  if (!env.FILES) throw new Error("R2 binding is missing.");
  return new R2StorageProvider(env.FILES, database(env));
}

import { createRemoteJWKSet, jwtVerify } from "jose";
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
import { safeName, safePath } from "./providers/storage";
interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  FILES?: R2Bucket;
  APP_MODE?: string;
  LOCAL_DEV?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
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
export async function authorized(request: Request, env: Env): Promise<boolean> {
  if (
    env.LOCAL_DEV === "true" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)
  )
    return true;
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return false;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return false;
  try {
    const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
    await jwtVerify(
      token,
      createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)),
      { issuer, audience: env.ACCESS_AUD },
    );
    return true;
  } catch {
    return false;
  }
}
function json(data: unknown, mode: string, status = 200) {
  return Response.json(
    { data, mode },
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
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!(await authorized(request, env)))
      return json(
        {
          message:
            "Sign in through Cloudflare Access to open your private space.",
        },
        "live",
        401,
      );
    const mode = env.APP_MODE === "live" ? "live" : "demo";
    const path = url.pathname;
    const method = request.method;
    try {
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
      if (path === "/api/integrations" && method === "GET")
        return json(
          demoIntegrations.map((i) => ({
            ...i,
            status:
              mode === "demo"
                ? i.status
                : i.id === "r2" && env.FILES && env.DB
                  ? "connected"
                  : "not_configured",
          })),
          mode,
        );
      if (path === "/api/storage/files" && method === "GET")
        return json(
          mode === "demo" ? demoFiles : await storage(env).list(),
          mode,
        );
      if (path === "/api/storage/usage" && method === "GET")
        return json(
          mode === "demo" ? demoUsage : [await storage(env).getUsage()],
          mode,
        );
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
              "Demo changes are stored in this browser. Connect D1 and R2 for server storage.",
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
  if (!env.FILES) throw new Error("R2 binding is missing.");
  return new R2StorageProvider(env.FILES, database(env));
}

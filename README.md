# Orbit

A private personal command center. A little space for your digital world.

This first milestone includes a responsive light/dark dashboard, unified file browser, persistent notes, quick capture, global search (⌘/Ctrl K), calendar preview, integrations setup, and an installable PWA shell. Sample analytics, files, and events are explicitly labeled. Local demo uploads retain their contents in IndexedDB; metadata and notes use localStorage. Browser demo data is device-local, unencrypted, and not a backup. Live mode stores notes and file metadata in D1 and file contents in R2.

## Run locally

Requires Node 22.12+ (or a supported newer release).

```sh
npm ci
npm run dev
```

Open the URL Vite prints. No credentials are needed. Demo mode is the default, independent of backend availability. Set `VITE_API_MODE=live` in `.env.local` to use the Worker; rebuild after changing this value.

For the Worker, build assets first, then run it in another terminal:

```sh
npm run build
npm run dev:worker
```

Vite proxies `/api` to localhost:8787. The `local` Wrangler environment serves demo API data and bypasses Access only on loopback hostnames. Its demo writes are rejected because browser demo mutations happen locally. For local live mode, add local D1/R2 bindings to `env.local`, set its `APP_MODE` to `live`, and run `npm run db:local`. Wrangler bindings are not inherited between environments.

## Architecture

```text
src/                   React application and normalized API client
  components/          Shared panels, accessible dialogs, search, capture
  pages/               Dashboard, storage, notes, calendar, sites, settings
  lib/api.ts           Demo/live data boundary and browser persistence
shared/                Provider-independent contracts and sample data
worker/                Same-origin Cloudflare Worker API + Access verification
  providers/           Storage contract and live R2 adapter
migrations/            Reproducible D1 migrations
public/                App icons and PWA assets
```

External services → server-side adapters → normalized APIs → UI. React never receives provider credentials. `StorageProvider` defines list, search, get, upload, delete, move, rename, and usage. R2 keys use opaque IDs; virtual paths live in D1 so moves do not copy objects. R2 has no artificial capacity limit; the UI displays no invented pooled free space. R2 usage currently reflects indexed files, not unrelated pre-existing bucket objects. There is no Drive live adapter yet.

Dashboard sections are isolated reusable panels. Add a new adapter without introducing provider-specific API calls into frontend components. Site analytics, Google OAuth, GitHub synchronization, Cron jobs, persistent search indexes, widget rearranging, and calendar writes remain future milestones. Search currently matches pages, indexed files, notes, sample events, and sample sites, and navigates to the relevant module. It does not search file contents.

## Cloudflare setup

1. Sign in with `npx wrangler login`.
2. Create D1: `npx wrangler d1 create orbit-db`.
3. Create private R2: `npx wrangler r2 bucket create orbit-files`.
4. Add production bindings to `wrangler.jsonc` using your returned database ID:

```json
"d1_databases": [{ "binding": "DB", "database_name": "orbit-db", "database_id": "YOUR_ID", "migrations_dir": "migrations" }],
"r2_buckets": [{ "binding": "FILES", "bucket_name": "orbit-files" }]
```

5. Apply schema: `npx wrangler d1 migrations apply orbit-db --remote`.
6. Create a Cloudflare Zero Trust Access application for the deployment hostname. Allow only your email. Protect the **whole hostname**, including assets. Disable unprotected alternate hostnames and preview URLs, or protect each with Access. The Worker independently verifies Access JWT signature, issuer, and audience for all `/api/*` calls and fails closed without configuration.
7. Configure server secrets:

```sh
npx wrangler secret put ACCESS_TEAM_DOMAIN
npx wrangler secret put ACCESS_AUD
```

`ACCESS_TEAM_DOMAIN` is your team hostname, e.g. `my-team.cloudflareaccess.com` (no scheme). `ACCESS_AUD` is the Access application audience tag. Keep `LOCAL_DEV` unset in production. Never put secrets in `VITE_*` variables; those are public.

8. Set `.env.local` to `VITE_API_MODE=live`. Production `APP_MODE` is already `live` in Wrangler.
9. Run checks, then `npm run deploy` once you are ready to publish.

Deployment has not been performed by this initial implementation. No real Cloudflare resources or provider accounts are provisioned automatically. Tokens for future providers should use least-privilege scopes, remain in Worker secrets or encrypted server-side token storage, and never be placed in integration settings JSON.

## API conventions

Responses: `{ data, mode: "demo" | "live" }`; errors use `{ data: { message }, mode }`. Private responses include `Cache-Control: no-store`. Inputs are validated server-side. Files are returned as attachments with `nosniff`.

| Endpoint                                           | Methods       | Purpose                   |
| -------------------------------------------------- | ------------- | ------------------------- |
| `/api/dashboard`                                   | GET           | Normalized widgets        |
| `/api/sites`, `/api/calendar`, `/api/integrations` | GET           | Module data/status        |
| `/api/storage/files`                               | GET, POST     | List and multipart upload |
| `/api/storage/files/:id`                           | PATCH, DELETE | Rename, move, delete      |
| `/api/storage/files/:id/download`                  | GET           | Private download          |
| `/api/storage/usage`                               | GET           | Provider-indexed usage    |
| `/api/notes`                                       | GET, POST     | List/create               |
| `/api/notes/:id`                                   | PUT, DELETE   | Edit/delete               |

Uploads are limited to 25 MB in this iteration. An R2 upload rolls back its object if indexing fails. Cross-service operations cannot be atomic: if a delete loses its D1 update after R2 succeeds, retrying delete clears the stale metadata. Future synchronization should reconcile missing objects and stale indexes.

## PWA and privacy

Manifest includes standalone mode, regular/maskable icons, and a responsive shell. Generated service worker caches only static application assets; it excludes `/api` navigation and never caches API responses. Live private data is unavailable offline. Demo data remains locally accessible. Google Fonts is the only third-party frontend resource in this version; the system sans-serif fallback works offline. In-browser storage may be cleared by the browser. Signing out of Access does not remove browser demo data; do not put sensitive production material in the demo.

## Checks and Git

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Tests cover file path validation, private API authorization, malformed requests, local persistence, and R2 upload rollback. Browser checks cover desktop/mobile layout and create/edit/upload/search/theme flows. Commits use the existing user Git identity without assistant attribution. See `docs/architecture.md` for extension decisions.

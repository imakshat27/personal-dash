# Orbit

A private personal command center. A little space for your digital world.

This first milestone includes a responsive light/dark dashboard, unified file browser, persistent notes, quick capture, global search (⌘/Ctrl K), calendar preview, integrations setup, and an installable PWA shell. Sample analytics, files, and events are explicitly labeled. Local demo uploads retain their contents in IndexedDB; metadata and notes use localStorage. Browser demo data is device-local, unencrypted, and not a backup. Live mode stores notes and encrypted connection tokens in D1; files remain in your Google Drive.

For a step-by-step guide covering the preview, local backend, environment variables, and cloud deployment, see [Get Orbit running](docs/setup.md).

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
npm run db:local
npm run dev:worker
```

Vite proxies `/api` to localhost:8787. The `local` Wrangler environment uses local D1/R2 emulation and bypasses Access only on loopback hostnames. Run `npm run db:local` before live API testing. The zero-valued local database ID is a development placeholder, not a production resource. Wrangler bindings are not inherited between environments. The frontend remains a browser demo until `VITE_API_MODE=live` is set.

## Architecture

```text
src/                   React application and normalized API client
  components/          Shared panels, accessible dialogs, search, capture
  pages/               Dashboard, storage, notes, calendar, sites, settings
  lib/api.ts           Demo/live data boundary and browser persistence
shared/                Provider-independent contracts and sample data
worker/                Same-origin Cloudflare Worker API + Access verification
  providers/           Storage contract, Google Drive OAuth/adapter, local R2 adapter
migrations/            Reproducible D1 migrations
public/                App icons and PWA assets
```

External services → server-side adapters → normalized APIs → UI. React never receives provider credentials. Google Drive provides browsing, downloads, uploads, rename, virtual moves, trash, and actual account quota. Existing files are read-only; mutations require an app-private Orbit upload marker checked by the backend. D1 stores notes and AES-GCM encrypted OAuth tokens. Local R2 emulation remains available for credential-free backend tests.

Dashboard sections are isolated reusable panels. Site analytics, GitHub synchronization, calendar writes, full-drive search indexing, and widget rearranging remain future milestones. File browser search covers loaded pages; global search uses the newest file page. Neither searches file contents.

## Cloud deployment

The production account and D1 binding are configured for `orbit.imakshat.com`. Production has no R2 binding and requires no R2 subscription. Keep Workers and D1 on Free plans.

Follow [Cloudflare Access and domain setup](docs/cloudflare-values.md), then [Google Drive OAuth setup](docs/google-drive.md). Google credentials and the encryption key belong in Worker secrets, never `VITE_*` variables. The Worker verifies Access JWT signature, issuer, and audience for every API request, including OAuth; protect the entire hostname through Access as well.

Set `VITE_API_MODE=live` in `.env.local`, apply remote D1 migrations, and deploy only after Access and Google configuration are ready. No deployment or live Google connection has been performed yet.

## API conventions

Responses: `{ data, mode: "demo" | "live" }`; errors use `{ data: { message }, mode }`. Private responses include `Cache-Control: no-store`. Inputs are validated server-side. Files are returned as attachments with `nosniff`.

| Endpoint                                           | Methods       | Purpose                   |
| -------------------------------------------------- | ------------- | ------------------------- |
| `/api/dashboard`                                   | GET           | Normalized widgets        |
| `/api/sites`, `/api/calendar`, `/api/integrations` | GET           | Module data/status        |
| `/api/storage/files`                               | GET, POST     | Paginated list and upload |
| `/api/storage/files/:id`                           | PATCH, DELETE | Rename, move, trash       |
| `/api/storage/files/:id/download`                  | GET           | Private download          |
| `/api/storage/usage`                               | GET           | Actual account quota      |
| `/api/notes`                                       | GET, POST     | List/create               |
| `/api/notes/:id`                                   | PUT, DELETE   | Edit/delete               |

Uploads are limited to 25 MB in this iteration. They go into an actual `Orbit` folder in Drive; folders shown inside Orbit are virtual labels. Existing Google Docs, Sheets, Slides, and Drawings download as PDF. Files listed from existing Drive folders are grouped under `/Drive`. The listing loads 100 files per page. OAuth connect and callback use `/api/integrations/drive/connect` and `/api/integrations/drive/callback`.

## PWA and privacy

Manifest includes standalone mode, regular/maskable icons, and a responsive shell. Generated service worker caches only static application assets; it excludes `/api` navigation and never caches API responses. Live private data is unavailable offline. Demo data remains locally accessible. Google Fonts is the only third-party frontend resource in this version; the system sans-serif fallback works offline. In-browser storage may be cleared by the browser. Signing out of Access does not remove browser demo data; do not put sensitive production material in the demo.

## Checks and Git

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Tests cover file path validation, private API authorization, malformed requests, local persistence, OAuth state/PKCE, token encryption, Drive mutation restrictions, uploads/downloads, pagination, real quota, and local R2 upload rollback. Repeatable Playwright checks cover desktop/mobile layout and create/edit/pin/delete/upload/download/search/theme flows. They use an installed Chrome browser; run `npm run test:e2e`. Commits use the existing user Git identity without assistant attribution. See `docs/architecture.md` for extension decisions.

# Get Orbit running

## 1. Preview now — no accounts or .env needed

In this project directory:

```sh
npm ci
npm run dev
```

Open http://localhost:5173 (or the URL Vite prints). Notes and uploaded files are saved in this browser. Analytics and events are sample data. This is the mode the current preview uses.

## 2. Use real backend storage locally — still no Cloudflare account needed

Create `.env.local` in the project root:

```dotenv
VITE_API_MODE=live
```

Run in terminal 1:

```sh
npm run build
npm run db:local
npm run dev:worker
```

Run in terminal 2:

```sh
npm run dev
```

Restart Vite after changing `.env.local`. The frontend now talks to the local Worker, SQLite-backed D1 emulation, and local R2 emulation. Notes and file contents are saved under `.wrangler/state/`. The local live dashboard starts empty: it does not import browser-demo data or simulate connected Google/Cloudflare analytics accounts.

To restore the sample preview, change `VITE_API_MODE=demo` and restart Vite. Keep your local data folders if you want to retain local backend files.

For the selected hostname `orbit.imakshat.com`, use the exact [Cloudflare values checklist](cloudflare-values.md). The Worker configuration already contains the Custom Domain and disables alternate public Worker URLs.

## 3. Publish with your existing Google Drive

Production uses Google Drive for files and Cloudflare D1 for notes and encrypted OAuth tokens. No R2 subscription is needed. Your Cloudflare account and `orbit-db` database identifiers are already in `wrangler.jsonc`.

1. Follow [the Cloudflare checklist](cloudflare-values.md) to add the Google login callback and confirm the domain is in the same Cloudflare account. No Zero Trust subscription is needed.
2. Follow [the Google Drive guide](google-drive.md) to enable the Drive API, create a web OAuth client, and set the Worker secrets.
3. Apply all D1 migrations remotely, build, and deploy using the commands in that guide.
4. Sign into Orbit, open Integrations, and connect the Google account with your 5 TB plan.

## Environment variables

| Variable                                   | Location                     | Purpose                                              |
| ------------------------------------------ | ---------------------------- | ---------------------------------------------------- |
| `VITE_API_MODE=demo` or `live`             | `.env.local`                 | Browser demo or Worker API                           |
| `OWNER_EMAIL`                              | `wrangler.jsonc`             | Exact Google email allowed to sign in                |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Worker secrets               | Google OAuth client                                  |
| `TOKEN_ENCRYPTION_KEY`                     | Worker secret                | Encrypt server-side connection tokens                |
| `APP_ORIGIN`                               | `wrangler.jsonc`             | Fixed OAuth callback origin                          |
| `STORAGE_PROVIDER`                         | `wrangler.jsonc`             | `drive` in production; local test emulator uses `r2` |
| `LOCAL_DEV=true`                           | Named local environment only | Loopback development authentication bypass           |

For optional real Drive testing locally, copy `.dev.vars.example` to `.dev.vars.local` and follow the local section of the Drive guide. Secret files and `.env.local` are ignored by Git. `VITE_*` variables are public browser build inputs; never use them for credentials.

## What remains to configure

Your allowed email is configured and you have entered the Google secrets through Wrangler. Add the new login callback to the Google client and confirm the domain zone before deployment. Set secrets using local terminal prompts; keep passwords, API tokens, client secrets, encryption keys, and login codes out of chat.

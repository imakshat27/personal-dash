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

## 3. Use your Cloudflare account and publish

Use the account that should own the app. Start with:

```sh
npx wrangler login
npx wrangler d1 create orbit-db
npx wrangler r2 bucket create orbit-files
```

These create actual cloud resources. R2 must be enabled on your Cloudflare account. Keep the bucket private; public bucket access is not needed. Login handles deployment authentication, so an API token or R2 S3 access key is not required for this app's storage adapter.

Add these **top-level production bindings**, beside `vars` in `wrangler.jsonc`, replacing the database ID with the one D1 returns:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "orbit-db",
    "database_id": "THE_ID_FROM_D1_CREATE",
    "migrations_dir": "migrations"
  }
],
"r2_buckets": [
  { "binding": "FILES", "bucket_name": "orbit-files" }
]
```

Leave the `env.local` bindings as they are. Apply the cloud migration:

```sh
npx wrangler d1 migrations apply orbit-db --remote --env=""
```

Choose the hostname for the app. Set up a Cloudflare Access application covering the entire hostname, with an Allow policy for **only your email**. If you use a custom domain, also protect or disable the Worker’s `workers.dev` and preview URLs. Production APIs will reject requests without a valid Access login.

Get these two values from Cloudflare Zero Trust:

- **Team domain:** e.g. `your-team.cloudflareaccess.com`, without `https://`. Find it in the Zero Trust team settings.
- **Application Audience (AUD):** open your Access application and copy its audience tag.

Store them in the Worker:

```sh
npx wrangler secret put ACCESS_TEAM_DOMAIN --env=""
npx wrangler secret put ACCESS_AUD --env=""
```

Set `.env.local` to `VITE_API_MODE=live`, then:

```sh
npm run lint
npm run build
npm run deploy
```

Cloudflare prints the deployed URL. Keep Access protection in place before using the app for your personal data. Once live, notes and files are shared across your devices via D1/R2. Google Drive, Google Calendar, GitHub activity, and Cloudflare analytics live adapters are future milestones.

## Where each value belongs

| Value                          | Location                                | Needed when                              |
| ------------------------------ | --------------------------------------- | ---------------------------------------- |
| `VITE_API_MODE=demo` or `live` | `.env.local`                            | Optional for preview; `live` for backend |
| D1 database ID and name        | Production bindings in `wrangler.jsonc` | Cloud deployment                         |
| R2 bucket name                 | Production bindings in `wrangler.jsonc` | Cloud deployment                         |
| `ACCESS_TEAM_DOMAIN`           | Worker secret through Wrangler          | Cloud deployment                         |
| `ACCESS_AUD`                   | Worker secret through Wrangler          | Cloud deployment                         |
| `LOCAL_DEV=true`               | Already in `env.local` only             | Local runtime; do not set in production  |

`.dev.vars` is only for local Worker variables; `.dev.vars.example` shows the Access variables but they are not needed for loopback development. `.env.local` and `.dev.vars` are ignored by Git. Variables prefixed `VITE_` are included in the browser bundle, so provider credentials never belong there.

## What to provide for the next step

You can share the D1 database ID, R2 bucket name, desired app hostname, Access team domain, and application audience tag. Authenticate on your own machine using `wrangler login`; you do not need to paste a Cloudflare API token into chat. No Google credentials are needed for the current milestone.

## Official references

- [Wrangler authentication and R2 setup](https://developers.cloudflare.com/r2/get-started/cli/)
- [Cloudflare D1 setup](https://developers.cloudflare.com/d1/get-started/)
- [Protect a Worker with Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Configure a self-hosted Access application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)

# Cloud deployment checklist for orbit.imakshat.com

The Worker is configured for `orbit.imakshat.com` as a Cloudflare Custom Domain. The public `workers.dev` URL and preview URLs are disabled. Nothing has been deployed or changed in DNS yet.

## Domain prerequisite

`imakshat.com` must be an active Cloudflare zone in the same account as the Worker. For this deployment, use the Worker Custom Domain feature: Cloudflare provisions DNS and the certificate. If an `orbit` CNAME already exists, save its target and remove that specific record when ready to attach the Custom Domain; existing CNAMEs conflict with Worker Custom Domains. Keep other domain records untouched. If DNS is hosted elsewhere, resolve the domain setup before deployment.

## Account and database already configured

- Account ID: `ee86951ee9b792b8e8e816ef34b34591`
- D1 database: `orbit-db`
- D1 ID: `1f4562f9-d3b4-4190-bae5-b5a59b72232a`

Do not recreate the database. Production file storage uses your existing Google Drive; skip R2 entirely. Stay on Workers and D1 Free plans. Wrangler authenticates locally with `npx wrangler login`.

## Private sign-in without Zero Trust

Orbit now uses Google sign-in, restricted to `agarwalakshat2710@gmail.com`. Do not enroll in Zero Trust or enter a card for Access. No Access team domain or AUD is needed. Your existing Google client and encryption key are reused.

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **Google Auth Platform → Clients → Orbit Web**.
2. Under **Authorized redirect URIs**, keep the existing Drive callback and add:

```text
https://orbit.imakshat.com/api/auth/callback
```

3. Save the client. In **Audience**, ensure `agarwalakshat2710@gmail.com` is a test user if the app is still in Testing.
4. Confirm `imakshat.com` is active in Cloudflare under the account above. The Worker Custom Domain provisions its DNS record; see the domain prerequisite above for CNAME conflicts.

The Google client ID, client secret, and encryption key have been entered using Wrangler secret prompts by the user. The implementation has not independently verified those remote secrets. Do not paste their values into chat.

## Build and deploy

From the project directory:

```sh
npx wrangler d1 migrations apply orbit-db --remote --env=""
npm run deploy
```

Production builds use `.env.production` with `VITE_API_MODE=live`. The migrations create notes, encrypted provider tokens, and login sessions. The Worker gates all private pages and APIs; only the login page and generic static assets are public. Sessions use secure HttpOnly cookies, expire after seven days, and can be revoked with Sign out. Mutations require the configured origin.

After deployment, open `https://orbit.imakshat.com`, sign in with your allowed Google account, and connect Drive from Integrations. See [Drive setup](google-drive.md) for its separate consent flow.

## Official instructions

- [Worker Custom Domains and CNAME conflicts](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Create D1](https://developers.cloudflare.com/d1/get-started/)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)

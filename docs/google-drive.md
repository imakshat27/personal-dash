# Connect your existing Google Drive

Orbit's production file provider is Google Drive. Your existing storage plan remains with Google; no R2 subscription or new billing account is required. The app reads your actual quota from Drive, including your existing 5 TB plan. Cloudflare Workers and D1 should remain on their Free plans.

## What Orbit can do

- Browse your existing Drive files, newest first, 100 files per page. Load more from the file browser.
- Download existing files; Google Docs, Sheets, Slides, and Drawings export as PDF.
- Upload files up to 25 MB into an `Orbit` folder in your Drive.
- Rename, move between virtual folders, and trash only files uploaded through Orbit. Restore trashed files using Drive's own trash.
- Read the account-wide storage usage and capacity from Google.

Drive consent also requests `openid email` to verify the connected account belongs to you. Storage scopes are `drive.readonly` for browsing/downloads and `drive.file` for Orbit's own uploads. The backend also checks an app-private marker before mutations. Existing files stay read-only, even if the UI is bypassed. Files from existing Drive folders are currently collected under the virtual `Drive` view; hierarchical existing-folder browsing and a full-drive search index are future work. Search filters the pages loaded into the file browser; global search uses the newest page. The Google API is the file source of truth; D1 stores notes and encrypted connection state, not copies of Drive content.

## Create a Google OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/). Select a project or create one called **Orbit**. No paid upgrade is needed for standard Drive API usage.
2. Under **APIs & Services → Library**, find **Google Drive API** and enable it.
3. Open **Google Auth Platform**. Complete **Branding** with app name **Orbit**, your support email, and developer contact email.
4. In **Audience**, choose **External** for a personal Google account and add your email as a test user. If your account is in a Workspace organization and an Internal app is available, that option may be appropriate instead.
5. In **Data Access**, add `openid`, the Google email/userinfo scope, `https://www.googleapis.com/auth/drive.readonly`, and `https://www.googleapis.com/auth/drive.file`.
6. Under **Clients → Create client**, choose **Web application** and name it **Orbit Web**.
7. Add this exact authorized redirect URI:

```text
https://orbit.imakshat.com/api/integrations/drive/callback
https://orbit.imakshat.com/api/auth/callback
```

For optional local testing, also add:

```text
http://localhost:5173/api/integrations/drive/callback
http://localhost:5173/api/auth/callback
```

8. Save the client ID and client secret when Google displays them. They identify the app; your own Google account will authorize access through the Connect button. Do not use a service account: it would not automatically use your personal Drive quota.

An External app in Testing can have refresh tokens expire after seven days, so you may need to reconnect during initial testing. For longer-lived use, review Google's Audience publishing and personal-use verification guidance. Restricted scopes can cause an unverified-app warning or verification requirements depending on account and publishing status. Do not share the app publicly without satisfying Google's requirements.

## Store secrets in the Worker

In this project's terminal, set production secrets. Each command prompts for its value:

```sh
npx wrangler secret put GOOGLE_CLIENT_ID --env=""
npx wrangler secret put GOOGLE_CLIENT_SECRET --env=""
npx wrangler secret put TOKEN_ENCRYPTION_KEY --env=""
```

For the encryption key, generate a 32-byte base64url value locally:

```sh
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))"
```

Store that value securely and enter it into the third secret prompt. Do not put it in Git or a `VITE_` variable. Changing the key makes existing encrypted connection tokens unreadable; reconnect Drive after changing it. Google tokens are obtained by the app and encrypted using AES-GCM before being stored in D1. No refresh token needs to be pasted into chat or entered manually.

Orbit uses Google sign-in, restricted to `agarwalakshat2710@gmail.com`. No Cloudflare Access or Zero Trust subscription is needed. Both login and Drive consent check Google's signed ID token, verified email, issuer, audience, and nonce. `APP_ORIGIN` is set to `https://orbit.imakshat.com` in Wrangler. OAuth uses encrypted ten-minute state cookies and PKCE. Private responses are never cached.

## Deploy and connect

```sh
npx wrangler d1 migrations apply orbit-db --remote --env=""
```

Production mode is supplied by `.env.production`. Then:

```sh
npm run build
npm run deploy
```

Sign in with your allowed Google account at the custom domain. Go to **Integrations → Google Drive → Set up integration → Connect Google Drive**, choose the account with your 5 TB plan, and approve the requested scopes. Return to **My storage**. Real quota and your accessible files appear there.

The adapter is implemented and tested using mocked Google responses. Live account verification requires your OAuth client, login callback registration, and deployment; no live Google account is connected yet.

## Local mode

The default browser preview is still a credential-free demo with sample Drive data. The `local` Worker environment uses only locally emulated D1/R2 for repeatable backend tests; its R2 bucket is not a cloud resource and requires no subscription.

To test your real Drive locally, copy `.dev.vars.example` to `.dev.vars.local`, fill in the Google credentials and encryption key, and change **only** `env.local.vars.STORAGE_PROVIDER` to `drive`. Local `APP_ORIGIN` is already `http://localhost:5173`. Apply local migrations, build, start the Worker and Vite, and use `VITE_API_MODE=live` in `.env.local`. Register the local redirect URI above. This intentionally connects to your actual Drive; named local D1 remains on your computer.

## References

- [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Refresh token expiration](https://developers.google.com/identity/protocols/oauth2#expiration)
- [Drive upload protocol](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Drive API usage limits](https://developers.google.com/workspace/drive/api/guides/limits)

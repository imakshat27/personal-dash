# Foundation validation

Checked on 7 October 2026.

- TypeScript strict typecheck and ESLint: pass.
- Vitest: 9 passing tests across API authorization, local notes, storage validation, and upload rollback.
- Playwright: 4 passing flows, including note create/edit/pin/delete, browser file upload/download/rename/move/delete, mobile navigation/theme persistence/reduced motion, and real local Worker D1/R2 round trips.
- Visual inspection: dashboard at 1440 px, phone at 375 px, storage in dark mode. No horizontal overflow at 375 px or 812 px landscape; no browser application exceptions.
- Production Vite/PWA build: pass. Static shell precached; APIs excluded.
- Wrangler deployment dry run: pass. No deployment was performed.
- D1 migration: applied successfully in local emulation. No remote resources were created.
- Dependency audit: zero reported vulnerabilities after toolchain updates.

## GitHub status

The earlier GitHub server error cleared on a later retry. The private repository is now [imakshat27/personal-dash](https://github.com/imakshat27/personal-dash). Commits use the existing user Git identity.

## Typography iteration

Small labels and supporting text now use 12–14 px sizing, stronger secondary text contrast, and more line spacing. Desktop and 375 px screenshots were visually checked, and all four end-to-end checks, lint, typecheck, and production build pass. A step-by-step environment/setup guide is in `docs/setup.md`.

## Google Drive storage milestone

- Production uses Drive and D1, with no R2 binding or subscription required. Local R2 emulation remains solely for backend checks.
- ESLint and strict TypeScript checks pass. All 26 unit tests and 5 Playwright flows pass, including browser read-only controls for existing files.
- Google responses were mocked to verify OAuth state, PKCE, encrypted token persistence, revoked-token handling, pagination, existing-file mutation rejection, managed upload/trash, PDF export, and actual account quota.
- Drive OAuth endpoints reject unauthenticated requests before redirects or token exchanges.
- Desktop storage and the 375 px Drive setup dialog were visually inspected; the dialog stays within the viewport with reduced motion enabled.
- Local token-table migration, production build, and Wrangler dry run pass. The dry run lists D1, assets, and Drive configuration without an R2 binding.
- No Google account is connected and nothing has been deployed. Actual account and custom-domain validation await OAuth and domain configuration.

## Google sign-in replaces Cloudflare Access

Zero Trust onboarding requires payment details even on its Free plan, so Orbit no longer depends on it. Only `agarwalakshat2710@gmail.com` can sign in. The Google client, secret, and encryption key are reused; an additional authorized login callback is required.

- Strict TypeScript, ESLint, 42 unit tests, and 6 Playwright flows pass.
- Signed Google ID token tests reject wrong issuer, audience, nonce, email, unverified email, altered signatures, and expired tokens. A different account never receives a session cookie.
- Sign-in uses PKCE and encrypted browser state; D1 stores only hashes of random session cookies. Logout revokes the current session; expired and unrecognized sessions are rejected.
- Private HTML redirects to login and unauthenticated APIs return 401. Production mutations and logout reject missing or cross-site origins, including requests with a valid owner session.
- Local D1 session migration, production live-mode build, and deployment dry run pass. Login visuals were checked at 1440 px and 375 px in both themes; mobile keyboard access and overflow are covered by Playwright.
- Actual Google login and custom-domain deployment are still pending; tests use locally signed mock Google identities. No deployment or DNS changes were performed.

## Production deployment — 7 October 2026

- All three configured Google secret names were confirmed through Wrangler without reading their values.
- Applied all three migrations to the existing remote D1 database, then built and deployed the Worker and static assets.
- Version: `9e4a89e1-5963-4293-b8c0-47f95197827c`; Custom Domain: `orbit.imakshat.com`. Public Workers and preview URLs remain disabled. No R2 or Zero Trust subscription was enabled.
- Cloudflare public DNS resolves the new hostname. The local resolver initially retained an NXDOMAIN result; live checks used Cloudflare's resolved IP with hostname and TLS certificate validation preserved.
- Live login returns 200; private pages redirect to login; notes and Drive consent endpoints return 401 without a session. Invalid OAuth state is rejected. Login redirects to Google with the configured callback, PKCE S256, valid client-ID format, and a Secure HttpOnly cookie.
- The deployed login page renders in Chrome without application errors. Actual Google sign-in and Drive consent require owner interaction and are not yet verified.

## Google Calendar milestone

- Added primary-calendar read access with recurring instances, all-day dates, daily IST boundaries, and event pagination.
- Google OAuth/token handling is shared; Drive and Calendar keep independent encrypted token records and state cookies. Existing Drive rows remain compatible.
- Strict TypeScript, ESLint, 46 unit tests, 7 browser flows, and production build pass. Checks cover calendar dates, pagination, all-day data, token isolation, reauthentication, and day navigation.
- Calendar failures are shown within the dashboard's agenda; other dashboard panels continue to work.
- Owner consent is still required after enabling Calendar API, registering its callback, and adding its read scope. Actual Calendar account access has not been verified.

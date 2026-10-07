# Foundation decisions

- One frontend, one same-origin Worker. Production uses D1 and Google Drive; local backend tests use D1/R2 emulation. No multi-tenant abstraction.
- Frontend modules depend on shared normalized models. `api.ts` is the only network and local-demo boundary. TanStack Query handles loading, errors, freshness, and invalidation.
- Storage providers implement a server-only contract. Files remain with providers. Drive listing is paginated directly from Google; virtual folders and upload ownership markers use app-private file properties. D1 stores notes and encrypted connection tokens. OAuth uses browser-bound state, PKCE, and a fixed configured callback origin. Broader read access is allowed; mutations are restricted to Orbit uploads on the server.
- Notes are simple plain text and render without HTML. D1 is their production source of truth. Local demo behavior mirrors supported operations.
- Protect the entire deployment with Cloudflare Access, plus cryptographically verified JWTs at the API boundary. No runtime client secrets or cached private API responses.
- The PWA shell is static; offline access to private server data is deliberately absent. Demo storage uses the device browser, never an external account.
- Sample analytics and sample calendar events do not claim to be live connections. Live mode returns empty datasets for unimplemented adapters.
- Prefer adding provider capabilities and normalized dashboard endpoints before introducing indexing jobs, KV caches, or widget configuration tables.

## Visual direction

UI UX Pro Max informed spacing, hierarchy, accessibility, responsiveness, and minimal style. The generated master’s marketing layout is not suitable for this dashboard; the implementation uses an application sidebar and modular information grid. Warm gray surfaces, a muted forest accent, sage/lavender/sand support colors, DM Sans UI text, and Manrope headings keep the product personal. A CSS orbital illustration adds character without an image dependency. Both themes use semantic CSS variables; reduced motion removes animation.

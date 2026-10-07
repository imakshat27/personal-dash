# Foundation decisions

- One frontend, one same-origin Worker. D1 and R2 are optional in demo mode; required for live writes. No multi-tenant abstraction.
- Frontend modules depend on shared normalized models. `api.ts` is the only network and local-demo boundary. TanStack Query handles loading, errors, freshness, and invalidation.
- Storage providers implement a server-only contract. Files remain with providers. Virtual folders and provider object IDs live in D1. Future Drive OAuth belongs behind the same API and should persist an index rather than list all providers for every frontend request.
- Notes are simple plain text and render without HTML. D1 is their production source of truth. Local demo behavior mirrors supported operations.
- Protect the entire deployment with Cloudflare Access, plus cryptographically verified JWTs at the API boundary. No runtime client secrets or cached private API responses.
- The PWA shell is static; offline access to private server data is deliberately absent. Demo storage uses the device browser, never an external account.
- Sample analytics and sample calendar events do not claim to be live connections. Live mode returns empty datasets for unimplemented adapters.
- Prefer adding provider capabilities and normalized dashboard endpoints before introducing indexing jobs, KV caches, or widget configuration tables.

## Visual direction

UI UX Pro Max informed spacing, hierarchy, accessibility, responsiveness, and minimal style. The generated master’s marketing layout is not suitable for this dashboard; the implementation uses an application sidebar and modular information grid. Warm gray surfaces, a muted forest accent, sage/lavender/sand support colors, DM Sans UI text, and Manrope headings keep the product personal. A CSS orbital illustration adds character without an image dependency. Both themes use semantic CSS variables; reduced motion removes animation.

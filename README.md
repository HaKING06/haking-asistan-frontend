# HaKING Frontend

Static frontend for the HaKING software assistant. This repository root is the
Cloudflare Workers asset root and contains `index.html`, `assets/`, and
`wrangler.jsonc` directly.

## Cloudflare Workers

- Root directory: `/`
- Build command: `npm run build` (optional dry-run validation)
- Deploy command: `npx wrangler deploy`

The frontend calls `https://haking-asistan-backend.onrender.com` for login,
registration, health checks, and streamed chat responses. Keep
`GEMINI_API_KEY`, `DATABASE_URL`, and `DATABASE_URL_UNPOOLED` only in the
private Render backend service. Do not add backend secrets to this public
repository.

The signed-in interface checks backend health when it opens and when the user
returns to the tab. Render still controls its free service's idle sleep policy.

For local preview, run `npm run dev`. The build command uses Wrangler's dry-run
mode and does not publish the site.

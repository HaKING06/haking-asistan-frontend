# HaKING Frontend

Static frontend for the HaKING software assistant. This repository root is the
Cloudflare Workers asset root and contains `index.html`, `assets/`, and
`wrangler.jsonc` directly.

## Cloudflare Workers

- Root directory: `/`
- Build command: `npm run build` (optional dry-run validation)
- Deploy command: `npx wrangler deploy`
- Search files: `robots.txt` and `sitemap.xml` are served from the site root.

The frontend calls `https://haking-asistan-backend.onrender.com` for login,
registration, health checks, and streamed chat responses. Keep
`GEMINI_API_KEY`, `DATABASE_URL`, and `DATABASE_URL_UNPOOLED` only in the
private Render backend service. Do not add backend secrets to this public
repository.

The signed-in interface checks backend health when it opens and when the user
returns to the tab. Render still controls its free service's idle sleep policy.

For local preview, run `npm run dev`. The build command uses Wrangler's dry-run
mode and does not publish the site.

## Privacy and browser storage

- `privacy.html` describes the current data flows, providers, AI processing,
  browser storage, and operational logs. The login screen links to it.
- The preference banner explains that the app uses required `localStorage` for
  the session and preference record. The app currently has no analytics,
  advertising, or cross-site tracking cookies. After saving a choice, the UI
  shows the exact saved categories. This is not consent to send AI prompts to a
  model provider; that processing is described separately.
- The session token is kept in `localStorage`; the account email is no longer
  persisted there and is loaded from the authenticated API session. Chat text
  stays in tab memory and is sent to the backend/Google Gemini API to generate
  answers; the backend does not store chat transcripts in Neon.
- No analytics or advertising SDK is installed. Google Fonts is currently a
  third-party font request and is disclosed in the privacy page; it may receive
  connection data such as an IP address.

The privacy notice identifies the individual student project operator and
contact email supplied for HaKING. Verify lawful bases, international transfer
arrangements, provider plans, and any 5651 duties against the actual service
setup. A privacy page alone does not certify legal compliance.

## Search appearance

The landing page uses Turkish title/description metadata, a canonical URL,
Open Graph and social preview fields, and `WebSite`/`WebApplication` JSON-LD.
Keep the visible page copy consistent with those claims. Google does not use
the `meta keywords` tag for ranking, so this project does not add one or stuff
search phrases into hidden text. Google chooses the displayed title/snippet
and may take time to recrawl a deployment; metadata cannot guarantee a ranking.

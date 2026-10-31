# HaKING Frontend

Static frontend for the HaKING software assistant. The repository connected to
Cloudflare must have `index.html`, `assets/`, `wrangler.jsonc`, and
`.assetsignore` at its root. In this workspace those files live in `frontend/`.

## Cloudflare Workers deployment

The project is served as static assets by Cloudflare Workers:

- Root directory: `/` when the connected GitHub repository contains the
  contents of this `frontend/` directory at its root.
- Build command: leave empty.
- Deploy command: `npx wrangler deploy`.

The frontend calls `https://haking-asistan-backend.onrender.com` for `/login`,
`/register`, and `/chat`. Chat replies stream as Server-Sent Events and recent
messages stay in context until the user starts a new chat.

The signed-in interface checks `/health` when it opens and when the user
returns to the tab. This starts a sleeping Render free instance before the
user sends a message. Render still controls its own idle sleep policy.

Keep `GEMINI_API_KEY` and `DATABASE_URL` in the Render backend service. Secrets
added to this Cloudflare frontend do not configure the Render process. Accounts
are stored in the external Postgres database, so Render restarts no longer
delete them.

For local preview, serve this directory with any static HTTP server and open
its root URL. Do not open the HTML file directly with `file://`.

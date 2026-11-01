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
`GROQ_API_KEY`, `GEMINI_API_KEY`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `RESEND_API_KEY`,
and `EMAIL_VERIFICATION_SECRET` only in the private Render backend service.
Do not add backend secrets to this public repository. Registration/login are
Gmail-only; a new account is created only after the user enters a 6-digit code
sent through Resend. The sender domain must be verified in Resend and the
provider's DNS records added before production email delivery works.
HaKING is for adults aged 18 or older. The login, registration, and verification
screens ask users to attest that they meet this requirement; no birth date or
identity document is collected. This is self-attestation, not age verification.

The signed-in interface checks backend health when it opens and when the user
returns to the tab. While a signed-in tab is visible, it also sends a tiny API
root request about every 10 minutes to reduce Render's idle spin-down. The
heartbeat stops when the tab is hidden or the user logs out; it does not call
Gemini or query Neon. It cannot prevent Render platform restarts or monthly
free-instance-hour limits, and the free plan can still have cold starts.

The signed-in sidebar includes Settings with the account profile, live
AI-provider/model status, privacy/About links, and account security actions.
Users can request a password reset by email or start account deletion. Reset
links are single-use and expire after 30 minutes. Account deletion also
requires the current password after opening its email confirmation link.
`reset-password.html` and `delete-account.html` are static recovery pages; they
remove one-time tokens from the address bar before making API requests.


## Crazy Mode, credits, and order handling

- `crazy.html` explains the two-stage response flow and the credit rules. One request costs 10 credits; the monthly free balance resets to 100 at the start of each Europe/Istanbul month, and unused monthly credits do not roll over.
- A fixed ItemSatış package is presented as 1,000 HaKING credits for 59.90 TRY. Each purchased lot is separate and expires 30 days after it is applied. The UI explains that ItemSatış checkout is external and credit application is manual after the operator verifies the paid order.
- Settings displays the live balance and purchased-lot expiry dates. At 30 or fewer active credits, the chat shows a link to the package page.
- `founder-credits.html` is `noindex` and is only an operator interface. Its UI check is not an access-control boundary; the backend independently requires a valid session belonging to `gunshalit@gmail.com`, a registered buyer Gmail address, a unique order reference, and an explicit payment-verification flag. Never grant from a browser claim without checking ItemSatış.
- Do not send ItemSatış credentials, customer passwords, or login/verification codes through the seller workflow. The buyer only needs to provide their registered Gmail and order reference through the marketplace's order messages.
For local preview, run `npm run dev`. The build command uses Wrangler's dry-run
mode and does not publish the site.

## Privacy and browser storage

- `privacy.html` describes the current data flows, providers, AI processing,
  browser storage, and operational logs. The login screen links to it.
- The preference banner explains that the app uses required `localStorage` for
  the session and preference record. The app currently has no analytics,
  advertising, or cross-site tracking cookies. After saving a choice, the UI
  shows the exact saved categories. This is not consent to send AI prompts to a
  model providers; that processing is described separately.
- The session token is kept in `localStorage`; the account email is no longer
  persisted there and is loaded from the authenticated API session. Chat text
  stays in tab memory and is sent to the backend and automatically selected
  Groq or Google Gemini API to generate answers; during provider failover, the
  same request may reach both providers. The backend does not store chat
  transcripts in Neon.
- The chat can read one UTF-8 source/text file at a time (64 KiB maximum) in the
  browser. It accepts a short allowlist of code/text extensions, rejects binary
  text and some recognizable secret formats, and sends the contents only when
  the user submits the message. The app never saves or executes uploaded files;
  the contents are sent to the selected AI provider for analysis (and may reach
  the fallback provider), so users should
  remove credentials and private data before attaching a file. Secret detection
  is best-effort and cannot guarantee that every credential is found.
- No analytics or advertising SDK is installed. Google Fonts is currently a
  third-party font request and is disclosed in the privacy page; it may receive
  connection data such as an IP address.

The privacy notice identifies the individual student project operator and
contact email supplied for HaKING. It describes the current technical data
flows; it is not a legal opinion or a guarantee that every deployment has the
same legal obligations. Applicable requirements depend on the service setup
and the operator's role.

## Search appearance

The landing page uses Turkish title/description metadata, a canonical URL,
Open Graph and social preview fields, and `WebSite`/`WebApplication` JSON-LD.
Keep the visible page copy consistent with those claims. Google does not use
the `meta keywords` tag for ranking, so this project does not add one or stuff
search phrases into hidden text. Google chooses the displayed title/snippet
and may take time to recrawl a deployment; metadata cannot guarantee a ranking.

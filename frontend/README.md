# HaKING Frontend

Static frontend for the HaKING software assistant.

## Cloudflare Pages deployment

Connect the repository to Cloudflare Pages and configure:

- Root directory: `frontend`
- Build command: leave empty
- Build output directory: `.`

The root `index.html` and `assets/` directory are the complete static site.
The frontend calls `https://haking-asistan-backend.onrender.com` for `/login`,
`/register`, and `/chat`. Chat replies are streamed as Server-Sent Events and
rendered incrementally in the conversation.

For local preview, serve this directory with any static HTTP server and open
its root URL. Do not open the HTML file directly with `file://`.

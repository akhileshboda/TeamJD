# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

Express-powered marketing/coaching-funnel site for Team JD (Jake Dedert —
bodybuilding/physique coaching, Adelaide + remote), with a Dropbox →
Cloudflare R2 pipeline for server-managed media. Two-project layout:

- **`server/`** — Express backend, CommonJS (`require`), Node's built-in test runner.
- **`client/`** — Vite + React 18 SPA, ESM (`type: module`), Vitest.

Full asset-pipeline diagram, env var reference, Dropbox/R2 setup, and the
Oracle deploy runbook are already documented in `README.md` and
`docs/deployment-oracle.md` — read those before re-deriving this from code.
Host-specific deploy commands live in the untracked local `deploy.md`.

## Commands

Run from repo root unless noted.

- `npm run dev` — Express (3000) + Vite dev server (5173) concurrently.
- `npm test` — backend only: `node --test` over `server/**/*.test.js`
  (sequential, `--test-concurrency=1` — tests share state like the SQLite
  session store, so don't parallelize).
- `cd client && npm test` — frontend: `vitest run` (jsdom environment).
- `npm run build` — builds the client into `../dist`, which Express serves
  in production.
- `npm run sync-assets` / `sync-assets:dry-run` — run the Dropbox→R2 sync.
- `npm run rebuild-assets:dry-run` — **destructive**; purges and replaces
  all R2 objects. Never run the non-dry-run version without explicit user
  confirmation (it requires `-- --confirm PURGE_SITE_ASSETS` itself).
- `npm run deploy:production` / `deploy:staging` — rsync-based deploy to
  the Oracle VM. See `docs/deployment-oracle.md`. Never run without the
  user explicitly asking — this touches production.

There is no lint/format tooling and no CI configured. Don't invent an
`npm run lint` command or assume a pipeline gate exists.

## Code organization

- Backend routes: `server/routes/*.js` (each with a co-located `*.test.js`).
- Backend cross-cutting logic: `server/middleware/*.js` (rate limits, the
  maintenance-mode gate, client-IP resolution, visit logging).
- Backend business logic: `server/services/*.js` — the asset pipeline
  (`assetSync.js`, `assetOptimizer.js`, `assetClassifier.js`,
  `assetOrganizer.js`, `assetManifest.js`, `r2.js`, `dropbox.js`), plus
  mail (`services/mail/`), Turnstile verification, enquiry validation.
- Frontend pages: `client/src/pages/`; shared components:
  `client/src/components/`; app-wide state: `client/src/context/`
  (there's no Redux/Zustand — just React context + hooks).
- Tests live next to the file they cover (`Foo.jsx` + `Foo.test.jsx`), for
  both server and client.

## Non-obvious behavior worth knowing before touching it

- **`MAINTENANCE_MODE`** (`server/middleware/maintenanceMode.js`): explicit
  `MAINTENANCE_MODE=true/false` always wins; unset, it defaults to **on**
  whenever `NODE_ENV=production` and `APP_ENV !== 'staging'`, and off
  otherwise. `/healthz` and `/assets*` are always exempt. This is separate
  from the static `503.html` reverse-proxy fallback — see README's
  "in-app gate vs. process-down page" explanation before changing either.
- **`NODE_ENV=production` is set on both the production *and* staging PM2
  apps** (staging needs it for secure cookies) — `APP_ENV=staging` is the
  actual environment discriminator. Don't branch on `NODE_ENV` alone.
- **SPA fallback in `server/app.js`** is a whitelist (`/`, `/about`,
  `/services`, `/services/:slug`, `/results`, `/contact`, `/privacy`), not
  a blanket `app.get('*', ...)` — adding a new client route means adding
  it here too, or it'll 404 instead of serving `dist/index.html`.
- **`/assets` vs `/api/assets`**: `/assets` (proxied by Vite in dev) serves
  the generated image-optimizer cache (`public/assets/generated/`);
  `/api/assets/:key` is the manifest-backed redirect to the real R2 URL.
  Don't conflate them when debugging broken images.
- **Client IP trust**: `server/middleware/clientIp.js` only trusts the
  `CF-Connecting-IP` header when the direct TCP peer is loopback (the local
  Cloudflare tunnel); otherwise it uses the raw socket IP. This backs rate
  limiting and visit logging — never widen it to trust `X-Forwarded-For` or
  CF headers unconditionally, that would let clients spoof their identity.
- **Enquiry rate limiting is three-layered**: per-IP, per-email (HMAC'd with
  `SESSION_SECRET`, not stored raw), and a global daily cap — see
  `server/middleware/rateLimits.js`. Changes to the enquiry flow can trip any
  of the three independently.
- **Find Your Fit / Competition Prep gating is client-side only** —
  `context/FindYourFitSession.jsx` stores a quiz outcome in `sessionStorage`
  and components like `ServiceReadinessGate.jsx` gate on it. It's a
  lead-qualification UX funnel, not an auth/security boundary; there's no
  server-side enforcement.
- Asset resolution on the client goes through `useAssets.js`
  (`resolveAsset(path, fallback)`), not raw `<img src>` paths. Manifest keys
  ending `-2` are often line-art icons, not photos — view before using one.
  Signed URLs in `data/asset-manifest.json` expire; fetch current ones via
  the running dev server's `/api/assets/{key}`, not the file directly.
- **`whileInView` stagger animations** (`SectionReveal.jsx`) can render
  invisible if placed above the fold and mounted before async data
  resolves — mount the stagger container only once data is loaded.

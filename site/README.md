# Team JD — Jake Dedert Fitness

Marketing site for Jake Dedert Fitness (`team-jd.com.au`), served by an Express app with a React/Vite frontend and server-managed assets.

## Asset Pipeline

Dropbox is the human-friendly source/admin library. Cloudflare R2 is the public runtime asset provider.

```text
Dropbox /latest
  -> Express dry-run plan
  -> Express validates, classifies, and normalizes files
  -> Express uploads supported assets to Cloudflare R2
  -> Express writes data/asset-manifest.json
  -> Express moves successful Dropbox files to /assets/<category>/
  -> Frontend loads public R2 URLs from /api/assets
```

The browser should load large media from `R2_PUBLIC_BASE_URL`, not Dropbox and not the Pi.

## Running Locally

```bash
cd site
npm install
npm run dev
```

The Vite frontend runs on `http://localhost:5173`; Express runs on `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env` and fill in private values:

```env
NODE_ENV=development
PORT=3000
HOST=localhost
PUBLIC_BASE_URL=http://localhost:3000
SESSION_SECRET=replace-with-a-long-random-string

DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
DROPBOX_REDIRECT_URI=http://localhost:3000/auth/dropbox/callback
DROPBOX_REFRESH_TOKEN=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=jake-site-assets
R2_PUBLIC_BASE_URL=https://jake-site-assets.akhileshboda.com
R2_ASSET_PREFIX=site-assets

ASSET_SYNC_ENABLED=true
ASSET_AUTO_SYNC_ENABLED=true
ASSET_SYNC_ON_BOOT=true
ASSET_SYNC_CRON=*/15 * * * *
ASSET_SYNC_ADMIN_TOKEN=
ASSET_OPTIMIZE_IMAGES=true
ASSET_OPTIMIZER_FORMAT=webp
ASSET_OPTIMIZER_QUALITY=82
ASSET_OPTIMIZER_MAX_WIDTH=2400

DROPBOX_LATEST_PATH=/latest
DROPBOX_ASSETS_ROOT=/assets
DROPBOX_REORGANIZE_ENABLED=true
```

Secrets stay server-side only. Never expose Dropbox tokens, R2 keys, or `ASSET_SYNC_ADMIN_TOKEN` to the frontend.

## Dropbox OAuth

The sync token must include:

- `files.metadata.read`
- `files.content.read`
- `files.content.write`
- `sharing.read`
- `sharing.write`

To generate a token:

1. Start the server with Dropbox app key/secret configured.
2. Open `http://localhost:3000/auth/dropbox/start`.
3. Complete Dropbox consent.
4. Copy the returned `refreshToken` into `DROPBOX_REFRESH_TOKEN`.

## Category Model

Dropbox organized paths:

```text
/assets/home/
/assets/about/
/assets/services/
/assets/results/
/assets/testimonials/
/assets/gallery/
/assets/branding/
/assets/video/
/assets/misc/
```

R2 mirrors those paths under `site-assets/`, for example:

```text
site-assets/home/home-hero-jake-final.jpg
site-assets/results/client-transformation-before-after.png
site-assets/branding/logo-white-transparent.svg
site-assets/video/hero-home-loop-v1.webm
```

Supported extensions: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.gif`, `.svg`, `.webm`, `.mp4`.
Raster images (`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`) are optimized to WebP before upload when `ASSET_OPTIMIZE_IMAGES=true`. SVG, GIF, MP4, and WebM are passed through unchanged.

Unsupported files remain in `/latest` and are reported as skipped.

## Admin Endpoints

Protected endpoints require:

```http
Authorization: Bearer <ASSET_SYNC_ADMIN_TOKEN>
```

Check setup status:

```bash
curl -H "Authorization: Bearer $ASSET_SYNC_ADMIN_TOKEN" \
  http://localhost:3000/api/assets/setup-status
```

Preview what sync would do without mutating Dropbox or R2:

```bash
curl -H "Authorization: Bearer $ASSET_SYNC_ADMIN_TOKEN" \
  http://localhost:3000/api/assets/sync/plan
```

Run a real manual sync:

```bash
curl -X POST \
  -H "Authorization: Bearer $ASSET_SYNC_ADMIN_TOKEN" \
  http://localhost:3000/api/assets/sync
```

The protected API real sync requires a matching API dry-run before mutating Dropbox/R2. Server-side syncs started by the Express scheduler, startup hook, or `npm run sync-assets` create and verify their own dry-run plan before mutating.

## Health Check

`GET /healthz` returns HTTP 200 only after the asset manifest cache is ready. The response includes liveness and non-secret asset-cache status and is safe for local process monitoring.

## Oracle Production

Production deployment and operation on Oracle are documented in [`docs/deployment-oracle.md`](docs/deployment-oracle.md). Cloudflare and cloudflared are intentionally outside that runbook.

## Public Asset Endpoints

```text
GET /api/assets           — manifest, served from memory/disk, no Dropbox/R2 work
GET /api/assets/manifest  — compatibility alias for the manifest
GET /api/assets/:assetKey — redirects to the manifest URL when available
GET /api/assets/status    — non-secret service status
```

Confirm the manifest returns R2 URLs:

```bash
curl http://localhost:3000/api/assets
```

## Error and Outage Pages

The React app has a branded in-app 404 route for unknown client-side navigation.
Express also serves lightweight static fallback pages from `site/public`:

```text
/404.html      — missing browser routes and proxy-level 404s
/500.html      — unexpected server errors
/503.html      — maintenance, upstream failure, or app unavailable
/offline.html  — offline/browser fallback page
```

These files use local generated assets and inline CSS only. They do not depend on
React, `/api/assets`, Cloudflare R2, or the asset manifest, so they are safe to
serve from a reverse proxy when the Node process or upstream app is unhealthy.

When configuring nginx, Cloudflare, or another reverse proxy, map upstream
`502`, `503`, and `504` responses to `/503.html`. Use `/500.html` for generic
internal server errors where the proxy supports that distinction, and `/404.html`
for proxy-level missing routes.

## CLI Sync

```bash
npm run sync-assets:dry-run
npm run sync-assets
```

The dry run builds the same plan used by the protected endpoint. The real server-side sync self-primes with a fresh dry-run, then uploads changed assets, writes `data/asset-manifest.json`, and refreshes cache-busted R2 URLs. Express also runs the same trusted sync on startup when `ASSET_AUTO_SYNC_ENABLED=true` and `ASSET_SYNC_ON_BOOT=true`, and periodically according to `ASSET_SYNC_CRON` when automatic sync is enabled.

## Rebuild Optimized R2 Assets

To replace every object under the configured R2 `site-assets/` prefix with optimized Dropbox-sourced assets, first disable automatic sync in the target `.env`:

```env
ASSET_AUTO_SYNC_ENABLED=false
```

Preview the rebuild:

```bash
npm run rebuild-assets:dry-run
```

Run the purge-first rebuild:

```bash
npm run rebuild-assets -- --confirm PURGE_SITE_ASSETS
```

This command deletes the existing `site-assets/` R2 objects before uploading replacements. Public asset URLs can be temporarily broken until the rebuild finishes. If the upload phase fails, rerun the same command after fixing the reported source asset or configuration issue.

## Deploying to Raspberry Pi

One-time Pi setup:

```bash
sudo mkdir -p /var/www/teamjd /var/www/teamjd-staging
sudo chown pi:pi /var/www/teamjd /var/www/teamjd-staging
```

Keep separate `.env` files on the Pi; local `.env` files are intentionally not copied.

Production uses `/var/www/teamjd/.env`, PM2 process `jake-site`, and `PORT=3000`:

```bash
NODE_ENV=production
PORT=3000
HOST=localhost
```

Staging uses `/var/www/teamjd-staging/.env`, PM2 process `jake-site-staging`, and `PORT=3003`:

```bash
NODE_ENV=production
PORT=3003
HOST=localhost
ASSET_AUTO_SYNC_ENABLED=false
```

Keep `ASSET_AUTO_SYNC_ENABLED=false` in staging unless you are intentionally testing background Dropbox/R2 sync behavior. Manual admin API sync and `npm run sync-assets` still work with automatic sync disabled.

Deploy production:

```bash
DEPLOY_USER=pi \
DEPLOY_HOST=your-pi-hostname-or-ip \
npm run deploy:pi:production
```

Deploy staging:

```bash
DEPLOY_USER=pi \
DEPLOY_HOST=your-pi-hostname-or-ip \
npm run deploy:pi:staging
```

`npm run deploy:pi` defaults to production for backward compatibility. Override `DEPLOY_PATH` or `PM2_APP_NAME` only for custom Pi layouts.

Deploys skip deploy-time asset sync so the app can restart cleanly. After PM2 starts, Express will run startup sync in the background only when `ASSET_SYNC_ENABLED=true`, `ASSET_AUTO_SYNC_ENABLED=true`, and `ASSET_SYNC_ON_BOOT=true`. To force a protected API sync manually, run the API dry-run first, then the real sync against that target's port:

```bash
curl -H "Authorization: Bearer $ASSET_SYNC_ADMIN_TOKEN" \
  http://localhost:3003/api/assets/sync/plan

curl -X POST \
  -H "Authorization: Bearer $ASSET_SYNC_ADMIN_TOKEN" \
  http://localhost:3003/api/assets/sync
```

Use port `3000` for production. You can also SSH into the Pi and run `npm run sync-assets` inside the target directory; that server-side command self-primes with a dry-run. `DEPLOY_RUN_SYNC=true` is also an explicit one-off deployment sync and is not blocked by `ASSET_AUTO_SYNC_ENABLED=false`.

## Cloudflare R2 Setup Guide

See [`../docs/cloudflare-r2-setup.md`](../docs/cloudflare-r2-setup.md) for bucket creation, API credentials, custom domain setup, dry-run validation, real sync, Dropbox verification, R2 verification, and frontend verification.

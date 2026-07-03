# Team JD — Jake Dedert Fitness

Marketing site for Jake Dedert Fitness (`jakededert.fit`), served by an Express app with a React/Vite frontend and server-managed assets.

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
PORT=3000
HOST=localhost
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
ASSET_SYNC_ON_BOOT=true
ASSET_SYNC_CRON=*/15 * * * *
ASSET_SYNC_ADMIN_TOKEN=

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

The first real sync always performs or verifies a successful dry-run plan before mutating Dropbox/R2.

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

## CLI Sync

```bash
npm run sync-assets:dry-run
npm run sync-assets
```

The dry run builds the same plan used by the protected endpoint. The real sync uses the same first-sync preflight gate.

## Deploying to Raspberry Pi

```bash
DEPLOY_USER=pi \
DEPLOY_HOST=your-pi-hostname-or-ip \
DEPLOY_PATH=/path/to/site \
npm run deploy:pi
```

Keep production `.env` on the Pi at `DEPLOY_PATH/.env`; it is intentionally not copied from local.

## Cloudflare R2 Setup Guide

See [`../docs/cloudflare-r2-setup.md`](../docs/cloudflare-r2-setup.md) for bucket creation, API credentials, custom domain setup, dry-run validation, real sync, Dropbox verification, R2 verification, and frontend verification.

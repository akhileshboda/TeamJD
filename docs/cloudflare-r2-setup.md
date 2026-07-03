# Cloudflare R2 Setup for Jake Dedert Coaching

This site uses Dropbox as Jake's upload/admin library and Cloudflare R2 as the public runtime asset provider. Express uploads assets to R2 with private server-side credentials. Browsers only read public URLs from the generated `/api/assets` manifest.

## Recommended Values

```env
R2_BUCKET_NAME=jake-site-assets
R2_ASSET_PREFIX=site-assets
R2_PUBLIC_BASE_URL=https://jake-site-assets.akhileshboda.com
```

## Cloudflare Setup

1. In Cloudflare, create an R2 bucket named `jake-site-assets`.
2. Add a public custom domain for the bucket: `jake-site-assets.akhileshboda.com`.
3. Create R2 API credentials for this bucket. The token/key should be able to read and write objects in `jake-site-assets`.
4. Copy the R2 account ID, access key ID, and secret access key into the Express backend `.env`.
5. Keep all R2 credentials server-side. Do not add them to Vite or frontend env vars.

Public assets will be written under:

```text
site-assets/home/
site-assets/about/
site-assets/services/
site-assets/results/
site-assets/testimonials/
site-assets/gallery/
site-assets/branding/
site-assets/video/
site-assets/misc/
```

## Backend Environment

Create or update `site/.env`:

```env
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
ASSET_SYNC_ADMIN_TOKEN=replace-with-a-long-random-secret
ASSET_OPTIMIZE_IMAGES=true
ASSET_OPTIMIZER_FORMAT=webp
ASSET_OPTIMIZER_QUALITY=82
ASSET_OPTIMIZER_MAX_WIDTH=2400

DROPBOX_LATEST_PATH=/latest
DROPBOX_ASSETS_ROOT=/assets
DROPBOX_REORGANIZE_ENABLED=true
```

Dropbox OAuth must include `files.metadata.read`, `files.content.read`, and `files.content.write` so Express can discover, download, and move files.

## Validation Commands

Start the app:

```bash
cd site
npm run dev
```

Check non-secret setup status:

```bash
curl -H "Authorization: Bearer $ASSET_SYNC_ADMIN_TOKEN" \
  http://localhost:3000/api/assets/setup-status
```

Preview the sync without changing Dropbox or R2:

```bash
curl -H "Authorization: Bearer $ASSET_SYNC_ADMIN_TOKEN" \
  http://localhost:3000/api/assets/sync/plan
```

Run the real manual sync:

```bash
curl -X POST \
  -H "Authorization: Bearer $ASSET_SYNC_ADMIN_TOKEN" \
  http://localhost:3000/api/assets/sync
```

Confirm the manifest returns public R2 URLs:

```bash
curl http://localhost:3000/api/assets
```

You should see URLs beginning with:

```text
https://jake-site-assets.akhileshboda.com/site-assets/
```

## Dropbox Verification

1. Drop a supported file into Dropbox `/latest`, such as `Home Hero Jake Final.JPG`.
2. Run the dry-run plan and confirm it maps to `/assets/home/home-hero-jake-final.jpg`.
3. Run the real sync.
4. Confirm the original file is no longer in `/latest`.
5. Confirm it now exists in `/assets/home/`.

Unsupported files such as `.zip`, `.psd`, `.env`, or `.sh` should remain in `/latest` and appear as skipped in the dry-run response.

## R2 Verification

In Cloudflare R2, open the `jake-site-assets` bucket and confirm the uploaded object exists under the expected `site-assets/<category>/` prefix.

Then test the public URL:

```bash
curl -I https://jake-site-assets.akhileshboda.com/site-assets/home/home-hero-jake-final.jpg
```

A correct response should be `200 OK` with an image or video `Content-Type`.

## Optimized Rebuild

Raster images are converted to WebP before upload when `ASSET_OPTIMIZE_IMAGES=true`. To rebuild the R2 `site-assets/` prefix from Dropbox with optimized assets:

```bash
ASSET_AUTO_SYNC_ENABLED=false
npm run rebuild-assets:dry-run
npm run rebuild-assets -- --confirm PURGE_SITE_ASSETS
```

The real rebuild deletes current `site-assets/` objects before uploading replacements, so public asset URLs may be temporarily unavailable until the command completes. SVG, GIF, MP4, and WebM files are uploaded without format conversion.

## Frontend Verification

Open the site in a browser and inspect the Network tab. Image and video requests should load from:

```text
jake-site-assets.akhileshboda.com
```

They should not load from Dropbox, and normal asset rendering should not proxy large media through the Pi.

## Rollback

If R2 setup fails, disable scheduled sync:

```env
ASSET_SYNC_ENABLED=false
ASSET_AUTO_SYNC_ENABLED=false
ASSET_SYNC_ON_BOOT=false
```

For staging environments that should keep manual sync available but avoid background Dropbox/R2 usage, leave `ASSET_SYNC_ENABLED=true` and set:

```env
ASSET_AUTO_SYNC_ENABLED=false
```

The app will continue to serve the last known manifest when available. Existing local fallback behavior remains in place for missing manifest entries.

## CORS

For normal public image/video reads, a public R2 custom domain is usually enough. If browser CORS issues appear, allow `GET` and `HEAD` from the site domain:

```text
https://jakededert.fit
http://localhost:5173
```

# Team JD — Jake Dedert Fitness

Marketing site for Jake Dedert Fitness (jakededert.fit), served by an Express app with a `public/` frontend and `server/` API layer.

**Tech:** Express + HTML + Tailwind CDN + Vanilla JS.

## How It Works

On startup, the Express server syncs image assets from a configured Dropbox folder into `public/assets/generated/`. A manifest is generated mapping stable asset keys to local file paths. The frontend loads images directly from the local Express static server — Dropbox is never contacted during normal page loads or navigation.

## Running Locally

```bash
cd site
npm install
npm run dev
```

Open `http://localhost:3000`.

On first run (or after a Dropbox change), the server downloads all images from Dropbox into `public/assets/generated/`. Subsequent restarts skip unchanged files based on Dropbox file revision metadata — only new or changed files are re-downloaded.

## Deploying to Raspberry Pi

Deploy the current working tree to the Pi with:

```bash
DEPLOY_USER=pi \
DEPLOY_HOST=your-pi-hostname-or-ip \
DEPLOY_PATH=/path/to/site \
npm run deploy:pi
```

The deploy script rsyncs the project to `DEPLOY_USER@DEPLOY_HOST:DEPLOY_PATH`, excluding `node_modules`, `.git`, `.env`, `.DS_Store`, and npm debug logs. On the Pi it runs `npm install`, runs `npm run sync-assets` when available, then restarts the PM2 process named `jake-site` or starts it with `npm start` if it does not already exist.

Keep the production `.env` file on the Pi at `DEPLOY_PATH/.env`; it is intentionally not copied from your local machine.

## Environment

Create or edit `site/.env`:

```bash
PORT=3000
HOST=localhost
DROPBOX_APP_KEY=your_app_key
DROPBOX_APP_SECRET=your_app_secret
DROPBOX_REDIRECT_URI=http://localhost:3000/auth/dropbox/callback
DROPBOX_REFRESH_TOKEN=
DROPBOX_ASSET_ROOT_PATH=
SESSION_SECRET=some-long-random-string
```

`DROPBOX_REFRESH_TOKEN` is the server-side token used to sync assets. It must have the `files.content.read` scope. See [Dropbox OAuth](#dropbox-oauth) for how to obtain one.

`DROPBOX_ASSET_ROOT_PATH` optionally limits file discovery to a specific Dropbox folder, such as `/site-assets`. Leave blank to scan the Dropbox app root. Use a Dropbox path — not a URL.

## Asset Sync Workflow

### On startup

`npm run dev` automatically syncs assets before the server starts listening:

```
[sync] Starting asset sync from Dropbox...
[sync] Found 33 image file(s) in Dropbox.
[sync] hero-bg.jpg — rev match, skipped
[sync] new-photo.jpg — downloading (245 KB)...
[sync] new-photo.jpg — downloaded in 892ms
[sync] Sync complete: 32 skipped, 1 downloaded, 0 failed.
```

### Explicit one-shot sync (without starting the server)

```bash
npm run sync-assets
```

### Refresh assets after Dropbox changes (server already running)

```bash
POST http://localhost:3000/api/assets/refresh
# or
GET  http://localhost:3000/api/assets/refresh
```

This re-runs the full sync: skips unchanged files, downloads new or changed ones, and updates the in-memory manifest and disk cache.

### Verify images are serving locally

After sync, images are in `public/assets/generated/`. Check a specific asset:

```bash
curl -I http://localhost:3000/assets/generated/hero-bg.jpg
# Expected: 200 OK with Cache-Control: max-age=86400
```

Check the manifest:

```bash
GET http://localhost:3000/api/assets/manifest
```

All `url` fields should show `/assets/generated/…` local paths, not Dropbox URLs.

### Fallback behaviour

If Dropbox sync fails on startup (bad token, no internet) but a previous sync has already populated `public/assets/generated/` and `data/asset-manifest.json`, the server falls back to the local files and starts normally. If neither exists, the server starts with a clear error log explaining what is missing.

## Dropbox OAuth

The sync uses a long-lived refresh token stored in `.env`. To get one:

1. Start the dev server: `npm run dev`
2. Open `http://localhost:3000/auth/dropbox/start` in a browser
3. Complete Dropbox login and consent
4. Dropbox redirects back to `http://localhost:3000/auth/dropbox/callback`
5. Copy the returned `refreshToken` value into `DROPBOX_REFRESH_TOKEN` in `.env`
6. Restart the server

**Required OAuth scopes:**

- `files.metadata.read`
- `files.content.read` ← required for downloading images
- `sharing.read`
- `sharing.write`

**Re-authentication:** If your existing `DROPBOX_REFRESH_TOKEN` was obtained before `files.content.read` was added to the scope list, downloads will return 403. Re-run the OAuth flow above to get a new token with the correct scopes.

### Callback response (non-production)

```json
{
  "connected": true,
  "provider": "dropbox",
  "sessionStored": true,
  "expiresIn": 14400,
  "accessToken": "...",
  "refreshToken": "..."
}
```

## Working With Content

All browser-rendered content lives in `public/content/`.

- Services: `public/content/services.json`
- Testimonials: `public/content/testimonials.json`
- FAQs: `public/content/faqs.json`
- Results: `public/content/results.json`

### Adding a results photo

1. Upload the image to the configured Dropbox asset folder.
2. Run `POST /api/assets/refresh` or restart the server to sync it locally.
3. Run `GET /api/assets/discover` to confirm the generated `assetKey`.
4. Add a matching entry in `public/content/results.json`:

```json
{
  "id": 7,
  "src": "/api/assets/your-photo",
  "alt": "Description of the photo",
  "caption": "Card caption text",
  "category": "competition"
}
```

Categories: `competition`, `posing`, `training`

The `src` value uses the `/api/assets/<key>` format. At runtime, the manifest resolves this to the local path `/assets/generated/your-photo.jpg` — no Dropbox contact during page load.

## Asset API Reference

```text
GET  /api/assets/manifest        — full manifest with local asset URLs
GET  /api/assets/status          — sync state, asset count, last error
POST /api/assets/refresh         — re-run Dropbox sync (preferred)
GET  /api/assets/refresh         — re-run Dropbox sync (convenience)
GET  /api/assets/:assetKey       — compatibility redirect to local asset path
GET  /api/assets/discover        — list Dropbox folder contents (dev only)
```

## File Structure

```text
site/
├── public/
│   ├── index.html
│   ├── about/index.html
│   ├── services/index.html
│   ├── results/index.html
│   ├── contact/index.html
│   ├── privacy/index.html
│   ├── js/main.js
│   ├── assets/
│   │   └── generated/          ← git-ignored, populated by sync
│   └── content/
├── server/
│   ├── app.js
│   ├── sync-assets.js          ← standalone sync script
│   ├── routes/assets.js
│   ├── routes/auth.js
│   ├── services/dropbox.js
│   ├── services/dropboxAuth.js
│   └── utils/url.js
├── data/                       ← git-ignored
│   ├── asset-manifest.json     ← last-known-good manifest (disk fallback)
│   └── sessions.sqlite
├── .env
├── .gitignore
└── package.json
```

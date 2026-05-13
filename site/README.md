# Team JD — Jake Dedert Fitness

Marketing site for Jake Dedert Fitness (jakededert.fit), served by an Express app with a `public/` frontend and `server/` API layer.

**Tech:** Express + HTML + Tailwind CDN + Vanilla JS.

## Running Locally

```bash
cd site
npm install
npm run dev
```

Open `http://localhost:3000`.

The app serves static pages from `public/`, third-party asset redirects from `/api/assets/:assetKey`, and Dropbox OAuth routes from `/auth/dropbox/*`.

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
DROPBOX_ASSET_CACHE_TTL_MS=300000
SESSION_SECRET=some-long-random-string
DROPBOX_ASSET_MAP=
```

`DROPBOX_REFRESH_TOKEN` is the server-side token used by the public asset API. Without it, the server falls back to `DROPBOX_ASSET_MAP`.

`DROPBOX_ASSET_ROOT_PATH` optionally limits file discovery to a Dropbox folder, such as `/site-assets`. Leave it blank to scan the Dropbox app root. Do not use a site URL such as `http://localhost:3000/`; Dropbox expects a Dropbox path.

`DROPBOX_ASSET_MAP` accepts an optional JSON object mapping asset keys to Dropbox share URLs. This is useful as a local fallback or for one-off assets before the Dropbox listing flow is connected.

Example:

```json
{
  "ab_posing": "https://www.dropbox.com/scl/fi/.../ab-posing.jpg?rlkey=...&st=...&dl=0"
}
```

## Dropbox OAuth

The first auth flow is server-side Dropbox OAuth with session-backed token storage. The requested scopes are:

- `files.metadata.read`
- `sharing.read`
- `sharing.write`

- `GET /auth/dropbox/start`
  Redirects the user to Dropbox and stores a one-time OAuth state value in the session.
- `GET /auth/dropbox/callback`
  Validates the returned `code` and `state`, exchanges the code for tokens, stores them in the session, and returns JSON.

Session storage is backed by SQLite at `data/sessions.sqlite`.

### Callback response

In non-production, the callback returns token values directly for easy local testing:

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

In production, token values are redacted and replaced with booleans.

### Local / Postman testing

Recommended flow:

1. Open `http://localhost:3000/auth/dropbox/start` in a browser.
2. Complete Dropbox login and consent.
3. Let Dropbox redirect back to `http://localhost:3000/auth/dropbox/callback`.
4. Inspect the JSON response in the browser or copy the callback URL into Postman for follow-up testing.

Notes:

- Dropbox login itself is interactive, so the browser is the easiest way to start the flow.
- Postman is most useful for checking callback/error responses or using the returned token against Dropbox APIs.
- Tokens are stored in the session-backed SQLite store for now; they are not yet persisted in an app-owned database table.
- Copy the returned refresh token into `DROPBOX_REFRESH_TOKEN` for the public asset API until a DB/admin token store exists.

## Working With Content

All browser-rendered content still lives in `public/content/`.

- Services: `public/content/services.json`
- Testimonials: `public/content/testimonials.json`
- FAQs: `public/content/faqs.json`
- Results: `public/content/results.json`

To add a results photo:

1. Add the image to `public/assets/images/results/`
2. Add a matching entry in `public/content/results.json`

Example:

```json
{
  "id": 7,
  "src": "assets/images/results/your-photo.jpg",
  "alt": "Description of the photo",
  "caption": "Card caption text",
  "category": "competition"
}
```

Categories: `competition`, `posing`, `training`

## Third-Party Assets

The server-managed asset map route is:

```text
GET /api/assets
```

It returns:

```json
{
  "assets": {
    "hero-home-main": {
      "url": "https://www.dropbox.com/scl/fi/.../hero-home-main.webp?raw=1",
      "name": "hero-home-main.webp",
      "path": "/site-assets/home/hero-home-main.webp",
      "source": "dropbox"
    }
  }
}
```

Known asset keys also resolve through:

```text
GET /api/assets/:assetKey
```

That route redirects to the normalized Dropbox raw asset URL, which keeps older content entries such as `/api/assets/ab_posing` working.

To manually rebuild the cached asset map:

```text
GET /api/assets/refresh
```

The map is cached in memory for 5 minutes by default. Adjust `DROPBOX_ASSET_CACHE_TTL_MS` if needed.

To verify server-side Dropbox configuration without exposing secrets:

```text
GET /api/assets/status
```

During local development, use the discovery endpoint to confirm what the connected Dropbox app can see before creating shared links:

```text
GET /api/assets/discover
GET /api/assets/discover?path=/site-assets
```

This route is disabled in production.

### Postman asset route testing

Start the local server first:

```bash
npm start
```

Use `http://localhost:3000` as the base URL unless `PORT` is changed.

1. Confirm Dropbox configuration:

```text
GET http://localhost:3000/api/assets/status
```

Expected checks:

- `dropboxApiConfigured` is `true`
- `assetRootPath` is blank for the Dropbox app root, or a Dropbox folder path such as `/site-assets`
- no token or secret values are returned

2. Confirm folder access and image discovery:

```text
GET http://localhost:3000/api/assets/discover
```

To test a specific Dropbox folder without editing `.env`:

```text
GET http://localhost:3000/api/assets/discover?path=/site-assets
```

Expected checks:

- `counts.totalEntries` shows what Dropbox can see in that folder
- `counts.images` matches the number of supported image files
- `images[]` includes each discovered image path and generated `assetKey`
- `unsupportedFiles[]` explains files skipped because their extension is not supported

Supported image extensions are `.avif`, `.gif`, `.jpeg`, `.jpg`, `.png`, and `.webp`.

3. Build or refresh public shared links:

```text
GET http://localhost:3000/api/assets/refresh
```

Expected checks:

- `refreshed` is `true`
- `assets` contains the same image keys discovered in the previous step
- each asset has a Dropbox `url`, `name`, `path`, and `source`

4. Read the cached asset map:

```text
GET http://localhost:3000/api/assets
```

5. Test a single image redirect:

```text
GET http://localhost:3000/api/assets/<assetKey>
```

In Postman, leave redirects enabled to confirm the image loads. Disable redirects if you want to inspect the `302 Location` header directly.

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
│   └── content/
├── server/
│   ├── app.js
│   ├── routes/assets.js
│   ├── routes/auth.js
│   ├── services/dropbox.js
│   ├── services/dropboxAuth.js
│   └── utils/url.js
├── data/
├── .env
├── .gitignore
└── package.json
```

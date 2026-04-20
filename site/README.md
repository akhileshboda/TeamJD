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
SESSION_SECRET=some-long-random-string
DROPBOX_ASSET_MAP=
```

`DROPBOX_ASSET_MAP` accepts an optional JSON object mapping asset keys to Dropbox share URLs.

Example:

```json
{
  "ab_posing": "https://www.dropbox.com/scl/fi/.../ab-posing.jpg?rlkey=...&st=...&dl=0"
}
```

## Dropbox OAuth

The first auth flow is server-side Dropbox OAuth with session-backed token storage.

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

The first server-managed asset route is:

```text
GET /api/assets/:assetKey
```

Known asset keys resolve through `server/services/dropbox.js` and redirect to a normalized Dropbox raw asset URL.

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

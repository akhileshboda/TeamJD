# Team JD — Jake Dedert Fitness

Static marketing site for Jake Dedert Fitness (jakededert.fit).

**Tech:** HTML + Tailwind CDN + Vanilla JS — no build step required.

---

## Running Locally

Open any HTML file directly in a browser, **or** use a simple static server for proper module script and fetch() support:

```bash
# Option 1: Python (built-in)
cd site
python3 -m http.server 8080
# Open: http://localhost:8080

# Option 2: Node (npx)
cd site
npx serve .
# Opens automatically

# Option 3: VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

> Note: Content (services, testimonials, FAQs, results) is loaded via `fetch()` from JSON files. You need a local server (not `file://`) for fetch to work correctly.

---

## Deploying with GitHub Pages (`gh-pages` npm package)

Current architecture:
- Static site files live in `site/`
- Deploy command (from repo root `package.json`): `gh-pages -d site`
- Result: contents of `site/` are pushed to the `gh-pages` branch

### One-time setup

1. From repo root, install dependencies:
   ```bash
   npm install
   ```
2. In GitHub repo settings, set Pages source to:
   - Branch: `gh-pages`
   - Folder: `/ (root)`
3. Confirm your deploy script in root `package.json` exists:
   ```json
   "scripts": {
     "deploy": "gh-pages -d site"
   }
   ```

### Quick deploy workflow (every update)

From repo root:

```bash
# 1) Edit files in site/
# 2) Optional: preview locally
cd site && python3 -m http.server 8080

# 3) Back to repo root and commit your changes
cd ..
git add site
git commit -m "Update site content/layout"

# 4) Push source branch (recommended)
git push origin main

# 5) Publish site/ to gh-pages
npm run deploy
```

After step 5, `gh-pages` updates the `gh-pages` branch and pushes it to GitHub.  
Your GitHub Pages URL will serve that deployed branch content.

### Notes

- Run `npm run deploy` from repo root (where `package.json` is), not inside `site/`.
- Because paths in `site/` are relative, the site works under project subpaths on GitHub Pages.
- If deployment fails, verify remote permissions and that `gh-pages` branch is selected in GitHub Pages settings.

---

## Deploying to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. **Set Root Directory to `/site`**
4. Framework Preset: **Other** (static)
5. Build Command: *(leave empty)*
6. Output Directory: *(leave empty — Vercel serves from root)*
7. Click Deploy

That's it — Vercel will auto-assign a domain and serve all pages at clean URLs.

**Custom domain:** Connect `jakededert.fit` in Vercel Project Settings → Domains.

---

## Changing Calendly Links

All Calendly URLs are in `content/services.json`. Update once there — all pages read from this file.

| Field | Current URL |
|---|---|
| Free 15-min consult | `https://calendly.com/team-jd/15min` |
| Comp prep (30 min) | `https://calendly.com/team-jd/30min` |
| Posing session | `https://calendly.com/team-jd/1-on-1-posing-session` |

Also check `contact/index.html` — the three booking cards have hardcoded Calendly links (intentional for layout reasons).

---

## Changing Stripe / Payment Links

Replace `#stripe-placeholder` in any HTML file. Search the codebase:

```bash
grep -r "stripe-placeholder" site/
```

---

## Updating Instagram / Social Links

Replace `#instagram-placeholder` with the real URL (e.g. `https://instagram.com/jakededert`). It appears in the footer and contact page.

```bash
grep -r "instagram-placeholder" site/
```

---

## Adding Results Photos

1. Add your image file to `site/assets/images/results/`
2. Open `site/content/results.json`
3. Add an entry:
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

---

## File Structure

```
site/
├── index.html              ← Home page
├── about/index.html        ← About Jake
├── services/index.html     ← All coaching services
├── results/index.html      ← Results gallery
├── contact/index.html      ← Contact & booking
├── privacy/index.html      ← Privacy policy
├── robots.txt
├── sitemap.xml
├── assets/
│   ├── css/styles.css      ← Design system (CSS vars, components)
│   ├── js/
│   │   ├── main.js         ← Nav toggle, FAQ accordion, lightbox, filter
│   │   └── render.js       ← JSON → HTML renderers
│   └── images/
│       ├── logo.png        ← Cyan wordmark (header)
│       ├── logo-mark.png   ← Icon only (favicon)
│       ├── jake-hero.png   ← Jake's photo
│       ├── hero-bg.jpg     ← Hero background
│       ├── results/        ← Client competition photos
│       ├── icons/          ← Service feature icons
│       └── federations/    ← Federation logos
└── content/
    ├── services.json       ← All 4 services (edit here first)
    ├── testimonials.json   ← Client testimonials
    ← faqs.json            ← FAQ questions & answers
    └── results.json        ← Results gallery entries
```

---

## Migrating to Next.js Later

The content model (`/content/*.json`) is already structured for a CMS-ready migration:
- Move JSON to a headless CMS (Contentful, Sanity, etc.)
- Replace `render.js` calls with `getStaticProps()` + React components
- Copy design tokens from `styles.css` → Tailwind config or CSS modules
- Nav/footer → React components with the same markup
- Pages map 1:1 to Next.js `pages/` directory

---

*Built with HTML + Tailwind CDN + Vanilla JS. No build system required.*

# Pre-staging audit: `dev` at a298a94 (2026-11-12)

A lightweight pass before the staging deploy: automated suites, a rerun of the layout audit against the earlier baselines, a by-eye review, and functional checks of the critical paths. Everything ran against the local sandbox (`site/tools/ui-audit/serve.sh`, port 3110, no R2, Dropbox or Resend credentials, scratch data only).

**Result: no blockers. Three visible defects were found and fixed on `fix/pre-staging-polish`. Two items need a decision from the owner (below).**

## Automated

| Check | Result |
|---|---|
| Client tests (`cd client && npm test`) | 38 files, 289 tests pass (also after the fixes) |
| Backend tests (`npm test`) | 199 of 203 pass, 1 skipped. The 4 failures are all in `server/deploy.test.js` and fail identically on the last production branch (`deploy/production-2026-11-11`). They exercise the rsync/PM2 deploy script and do not run on this Windows machine. The deploy scripts and `ecosystem.config.cjs` are unchanged since production. |
| Client build | Clean. Only the existing chunk-size warning. |

## Layout audit, rerun at six widths

| Run | Baseline | Now |
|---|---|---|
| Dashboard (146 captures) | P1 1, P2 67 | **P1 0, P2 2** |
| Public site (90 captures) | P1 0, P2 57, P3 172 | **P1 0, P2 20** (at `--min P2`) |

Every remaining candidate was reviewed against screenshots and dismissed as an analyzer artifact: decorative hero rings and glows, glass-card media, accent-rail padding compensation (16/16/16/20 plus a 3px rail), a sticky publish bar pinned to the viewport on a short page, a toolbar compared with a table. The home `wide` layout-shift candidate measured CLS 0.0001 over repeated loads (a font-swap nudge in the nav). Four small tap-target candidates are inline links with at least 20px of clear space around them. The competition-prep gate's back link (22px high, `globals.css:5189`) and the contact-reel caption (9.9px type, `globals.css:9669`) are P3 polish.

## Functional

- **Enquiries, real sandbox endpoints:** config reports unavailable when mail is not configured; empty body gives 400 with per-field errors; bad JSON gives 400; the honeypot gives a silent 202; a well-formed request with a fake security token gives a clean 403.
- **Enquiry form in a browser** (Turnstile and the API mocked): success clears the form and shows the confirmation. The 400, 403, 502, 503 and non-JSON 500 responses each show the right message in an alert, keep everything the visitor typed, and re-arm the security check. Each submission sends the expected payload and a fresh reference id.
- **Enquiry emails:** the rendered text carries the `JD-xxxxxx` reference, and the simpler customer confirmation (checked in the plain-text versions), and HTML in a message is escaped. The HTML layout of the emails was not eyeballed.
- **Dashboard content flow:** create, publish (live on the public API), edit-as-draft (not live until published), revision-conflict detection, "Publish all" skipping an invalid draft, unpublish, delete. All against scratch data.
- **Find Your Fit and the Competition Prep gate:** no booking or application links are exposed before qualifying; the questionnaire runs to a recommendation and stores it for the session.

## Defects found and fixed (`fix/pre-staging-polish`)

All confirmed by measurement before and after, in addition to the reviewer's report.

1. **Phone and tablet menu, "Find Your Fit" button:** label was grey (`rgb(136,136,136)`) on cyan, about 1.9:1 contrast, on every public page. `.nav-mobile a` outranked `.btn-primary`. Fixed in `globals.css` (after `.nav-mobile .mobile-cta`).
2. **Landing "four paths" panels on phones:** the large outlined numeral ran into the label and title at 375px and below (up to 51px of overlap at 360 to 375px, 64px at 320px). Panel copy now starts below the numeral at 640px and under (`Home.css`), with at least 16px of clear space at every width tested.
3. **Landing hero, Replay pill:** overlapped the "View Services" button on laptop-height screens (11px at 1024x768, 15px at 1280x720) after the video ends. It now sits top-right under the nav (`Home.css`), clear of everything, including 1024x600.
4. **Mobile menu, "Reduce motion" pill:** sat flush at x=0 while the links sit at 20px; it now lines up.

A changelog entry was added for 1 to 3 (`server/content/changelog.json`).

## Needs an owner decision (not changed)

- **Third-party AI watermark in the hero poster.** `hero-home-poster-v1.jpg` (the image shown when Reduce motion is on, before the video loads and for reduced-motion visitors) has "MINIMAX | Hailuo AI" baked into its bottom-right corner. It is legible beside the CTAs at 1024px. The playing hero video does not show it at 1280px. The poster should be cropped, regenerated or swapped in the dashboard (`home.hero-video` slot). This audit could not check whether production already overrides it.
- **Competition Prep application link.** The seed data (`server/seed/services.json`) still has the placeholder `https://form.typeform.com/to/REPLACE-WITH-COMP-PREP-FORM-ID`. A running store keeps whatever was saved in the dashboard, so confirm on staging that Services, Competition Preparation has the real application link.

## Minor, left as is (P3)

- "TRUE POTENTIAL" outlined hero line draws small internal contour artifacts in the "A" (`Home.css:130`, `-webkit-text-stroke`).
- Two identical H2s on the home page ("Find the Coaching That Fits Your Next Move.").
- `/contact` at 1024px: the two route cards stack with the content hugging the left side.
- Service pricing "Book" button is intrinsic width rather than full width on phones (`globals.css:6653` beats `6865`).

## Not verifiable in the sandbox (check on staging)

- A real enquiry sent through Turnstile and Resend: both emails arriving and rendering.
- R2 photos and videos (the sandbox shows broken thumbnails by design).
- The staging sign-in gate (`SITE_AUTH_*`).
- Touch gestures on the new landing page (checked with the wheel only), and the landing page by eye at 1440 and 1920.
- Before deploying, confirm the staging `.env` does not set `CMS_DATA_PATH` or `ANALYTICS_DATA_DIR` to a non-default location. `.env` is now loaded before those paths are read (56474af), so a value that used to be ignored would start to apply and could point the dashboard at an empty store.

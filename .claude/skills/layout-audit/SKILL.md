---
name: layout-audit
description: Measure and screenshot the Team JD dashboard (/admin) and public site for spacing, alignment, container and overflow defects at six viewport widths. Use when asked to audit, QA or polish UI layout, check gaps/misaligned cards/spacing, verify a CSS change didn't regress layout, or before shipping UI work.
argument-hint: "[admin|public|all] [scenario ids] [viewports]"
---

# Layout audit

A deterministic DOM-geometry sweep plus screenshots, for the Team JD site in `site/`.
Use it as the first pass of any UI QA, then confirm each finding by looking at the
screenshot before reporting it.

## 1. Start the sandbox (never the real data)

```bash
cd site && bash tools/ui-audit/serve.sh            # builds the client, serves on :3100
SKIP_BUILD=1 bash tools/ui-audit/serve.sh          # reuse the last build
```

`serve.sh` runs the built app with sign-in bypassed, asset sync off, blank R2/Dropbox/Resend
credentials, and scratch data in `site/data/ui-audit/` (gitignored). It seeds ~120 days of fake
visits on first run (`node tools/ui-audit/seed-analytics.js` re-seeds). Do not point audits at
`npm run dev` with a real `.env`: that `.env` can reach real storage (R2 and Dropbox).
Rebuild (`serve.sh` without `SKIP_BUILD`) after any CSS/JSX change you want to measure.

Public photos and videos come from R2/Dropbox, so they are missing in the sandbox. Judge
media frames by their reserved boxes, not by the image.

## 2. Run the sweep

```bash
cd site
node tools/ui-audit/layout-audit.mjs --set admin                       # whole dashboard
node tools/ui-audit/layout-audit.mjs --only admin-home,admin-faqs --viewports phone,wide
node tools/ui-audit/layout-audit.mjs --set public
node tools/ui-audit/report.mjs data/ui-audit/runs/<stamp>              # merge + dedupe → findings.md
```

Scenarios live in `site/tools/ui-audit/scenarios.mjs`: routes, mocked empty/loading/error
states, editor discovery, and interactive states driven by an `after(page)` hook (drawer open,
collapsed sidebar, bulk select, reorder, media picker). Viewports: phone 375, tablet 768,
laptop 1024, desktop 1280, wide 1440, xl 1920. `--concurrency 3` is the default. Results are
saved after every capture, so rerunning with the same `--out` resumes an interrupted run.

Output per capture in `shots/`: `<scenario>@<viewport>.top.png` (the viewport as a person sees
it, sticky bars in place; review these first), `.png` (full page; sticky bars land wherever the
scroll left them, so ignore their position), and `.annotated.png` (P1 red, P2 amber boxes
numbered in finding order). `node tools/ui-audit/crop.js <png> <top> <height>` cuts a band out of
a tall full-page shot for review.

On Git Bash, set `MSYS_NO_PATHCONV=1` before passing paths like `/admin` to helper scripts.

## 3. What the checks mean

| Check | Sev | Meaning |
|---|---|---|
| `page-overflow`, `content-spill`, `clipped-text`, `overlap` | P1 | Something is visibly broken |
| `edge-misaligned` | P2 | Stacked cards' outer edges miss by 1–12px |
| `inner-edge-misaligned` | P2 | Cards share an edge but their content insets differ |
| `heading-misaligned` | P2 | Heading text is 2–12px off the card below it |
| `uneven-rhythm` | P2 | Space after cards varies on one page |
| `gutter-mismatch` | P2 | Side-by-side gap differs from stacked gap |
| `peer-mismatch` | P2 | Sibling cards disagree on radius or horizontal padding |
| `asymmetric-padding` (L/R) | P2 | Content sits off-centre in its card |
| `small-touch-target` | P2 | Under 24px tap target at phone/tablet widths |
| `layout-shift` | P2 | CLS > 0.05 while loading (skeleton ≠ content size) |
| `off-scale-*`, `asymmetric-padding` (T/B), `long-measure` | P3 | Token hygiene: value not on the 4px spacing or 6/8/12/16/24 radius scale |

The scale comes from `site/client/src/styles/globals.css` `:root` (`--space-*`, `--radius-*`).
The dashboard's `--jd-radius` (10px) is itself off that scale.

## 4. Confirm, then report

The script finds candidates; a reviewer decides. For each P1/P2: open the annotated shot,
confirm it is visible and not intended, find the rule in `site/client/src/admin/admin.css` or
`site/client/src/styles/globals.css` (grep the class in the selector), and record
route · state · viewport · selector · measured vs expected · file:line · screenshot. Drop false
positives. Things the geometry can't see (stats floating mid-card, text blocks capped far short of
their panel, hierarchy, icon/label baselines) come from a visual pass with the Playwright MCP
browser or the screenshots.

Follow-up passes: `/impeccable audit <target>` / `/impeccable polish` (design quality; never
`live` or `generate`) and `/web-design-guidelines <files>` (code review against Vercel's rules).

## 5. Lock fixes in

When fixing, rerun the same scenarios and viewports and diff the finding counts. Fixes should
land with Playwright `toHaveScreenshot` baselines for the touched screens (see the action plan
in `docs/ui-audit/`).

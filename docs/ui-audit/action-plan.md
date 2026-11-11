# UI polish: action plan

The plan for fixing what's in [findings.md](findings.md). Work is grouped by root cause, not by screen, because about five causes produce most of the findings. Fixing a cause once clears many rows at the same time.

The order goes cascade first, then tokens and the card primitive, then container layout. Each later group assumes the earlier ones have landed. Each group is one Notion ticket with the planning record `site/AGENTS.md` asks for. The acceptance criteria and checks below are the starting point for those tickets.

User-facing changes need a dashboard changelog entry (`server/content/changelog.json`). The tooling itself doesn't.

## Shared verification for every group

- **Layout sweep:** Rerun `layout-audit` on the touched scenarios at all six widths (`tools/ui-audit/layout-audit.mjs --only …`). Compare against the baseline run `admin-2` and confirm the targeted checks drop to zero, with no new P1/P2 findings.
- **Screenshot baselines:** Add Playwright `toHaveScreenshot` baselines for the touched screens: phone, tablet, laptop and wide; populated, empty and error states where relevant. These come from a new `site/tools/ui-audit/visual.spec.mjs` running against the sandbox. They stop regressions creeping back.
- **Unit tests:** Run `cd site/client && npm test`. One test, "deep links open their section", already fails on this branch for timing reasons (its `findByRole` gives up after the 1s default while the lazy page takes ~2s). Bump that `findByRole` timeout in G1 so the suite is green.
- **By-eye check:** Do a pass on the screenshots before closing the ticket.

---

## G1 · Fix the cascade: base resets must not outrank components (P1)

**Fixes:** D-X1, D-X2, and the `!important` workaround at line 611.

**Change:**
- Wrap the element resets at `admin.css:42–55` in `:where(.jd-admin)`, giving specificity 0,0,1.
- Delete the `.jd-admin` prefixes that were added to work around the problem (`.jd-admin .jd-panel-title` and similar).
- Remove the `!important` at 611.

**Acceptance criteria:**
- Computed colour checks in the sandbox:
  - `.jd-field-error` is the danger colour.
  - `.jd-change--up` and `--down` are teal and salmon.
  - Hints, ledes, legends, footnotes and empty-state text are `--jd-muted`.
- `.jd-settings-panel-title` is 18px.
- No `!important` remains in `admin.css`.

**Check:** a computed-style script over the 20 affected classes, plus screenshots of Home, an editor with a validation error, Settings and the Change log.

## G2 · Tokens and one card primitive (P2/P3)

**Fixes:** D-X7, D-H4, D-H8, D-H11, D-S9, the inset half of D-E4, and the token side of every off-scale finding.

**Change:**
- Map dashboard tokens onto the shared scale at the top of `admin.css`:
  - `--jd-space-*` → `--space-*`.
  - `--jd-radius` → `--radius-lg` (12px) or `--radius-md` (8px). Pick one and record the decision.
  - A small set: `--jd-card-pad` 20px, `--jd-card-pad-sm` 16px, `--jd-section-gap` 24px, `--jd-stack-gap` 16px.
- Introduce one surface primitive (for example `.jd-card` with `--compact` and `--hero` modifiers). Move `.jd-panel`, `.jd-scoreboard`, `.jd-form-section`, `.jd-publish-bar` (floating), `.jd-preview`, `.jd-settings-panel`, `.jd-spot` and `.jd-admin-error` onto it.
- Replace the off-scale literals (10, 14 and 6px spacing; 3px and 7px), and settle on 4 or 5 font sizes.

**Acceptance criteria:**
- `layout-audit` reports zero `off-scale-radius`, `peer-mismatch` and `inner-edge-misaligned` on dashboard scenarios.
- Off-scale spacing values in `admin.css` drop below 5% (from 21%).
- Every card on Home, editors and Settings shares one inset and one radius.

## G3 · Layout by container width, not viewport (P1)

**Fixes:** D-E1, D-E2, D-S6, D-L2, D-E5, D-E8.

**Change:**
- Add `container-type: inline-size` to `.jd-editor-form`, `.jd-settings-panel` and `.jd-table`.
- Switch these from `@media` to `@container` queries:
  - `.jd-field-row` goes 2-up at ≥ 30rem.
  - `.jd-rows-field-cells--3` goes 3-up at ≥ 34rem, otherwise stacking the label, value and link fields.
  - The list's Category, Type and Changes columns collapse as the table narrows. Changes shows only when a row has unpublished changes, or narrows to an icon.
- Editor grid becomes `minmax(18rem, 34rem) 1fr`.
- Use a subgrid (label / hint / control / error) so labels in a field row line up.

**Acceptance criteria:**
- At 1024, 1280 and 1440 with the sidebar full and as a rail:
  - Every editor input is ≥ 160px wide.
  - No "Required" tag wraps.
  - Labels in a row are at the same y.
  - The Result list column is ≥ 240px at 1024.
- No dead strip between form and preview at 1920.

## G4 · Chrome sized from reality: publish bar, sticky bars, focus (P1/P2)

**Fixes:** D-E3, D-X4, D-E7, D-L4, D-S5, D-X8, D-X9.

**Change:**
- Measure the publish bar's height with a `ResizeObserver` into a `--jd-publishbar-h` custom property on `.jd-admin`, including `env(safe-area-inset-bottom)`.
- Reserve that height for the end of the editor.
- Move the chrome tokens (`--jd-topbar` and others) to `:root`, and compute `scroll-padding` from the top bar plus any sticky bar.
- Make the bulk bar overlay the list header rather than push it, or reserve its slot.
- Give the Edit/Preview switch a full-width solid band.
- Add a backdrop and safe-area padding to the media bottom sheet.
- Add a named z-index scale (`--jd-z-*`), and move the pending dropdown out of the top bar's stacking context.

**Acceptance criteria:**
- On phone, scrolled to the end of every editor, the last control is fully visible with ≥ 16px clearance.
- Tabbing through a long form never puts the focused field under a bar.
- Selecting a row doesn't move the row under the cursor.
- Toasts are visible over full-screen preview.

## G5 · Home layout (P2) — the owner's most-used screen

**Fixes:** D-H1, D-H2, D-H3, D-H5, D-H6, D-H7, D-H8, D-H9, D-H10.

**Change:**
- Page order becomes title + period switcher, then scoreboard, then the two panels, then What's new (or What's new as a compact card beside the panels on wide screens).
- Reserve What's new's height so it can't push anything down.
- Make the skeleton match the real structure: scoreboard, two panels, footnote.
- Align the side stats to the visit number's baseline.
- One section gap (`--jd-section-gap`).
- Cap the main content at ~1200–1280px (`.jd-admin-main` max-width, centred or left-aligned; decide with the owner).
- Let changelog text span the panel, or right-size the panel.
- Hide the legend when the chart is empty.
- Make the error state a card with a "Try again" action.
- Line the ranked-list labels up with the panel title.

**Acceptance criteria:**
- Home CLS < 0.02 at every width (`layout-audit` layout-shift check).
- `uneven-rhythm` = 0.
- Scoreboard and panels share an inset.
- At 1920 no card is wider than the cap.
- Populated, empty, loading and error states each have a screenshot baseline.

## G6 · Lists and reorder mode on phone (P1/P2)

**Fixes:** D-L1, D-L3, D-L5, D-L6, D-L7, D-L8, D-X5.

**Change:**
- Rebuild the phone row as a two-line grid: grip, thumbnail, title/subtitle, with switch, status and move controls on one row.
- Set `--jd-row-indent` from the real grip width.
- Show the "—" marker only when there's something to say.
- Make "Clear" a quiet button.
- Restore the disclosure affordance on the status help.
- Use one button style for Reorder and Done.
- Add `:disabled` styles for icon buttons.

**Acceptance criteria:**
- At 375 a reorder-mode row is ≤ 88px tall.
- No `overlap` findings.
- Disabled move buttons are visibly disabled (opacity or colour check).

## G7 · Editors and shell consistency (P2/P3)

**Fixes:** D-E6, D-E9, D-E10, D-E11, D-E12, D-E13, D-S1, D-S2, D-S3, D-S4, D-S7, D-S8, D-S10, D-S11, D-S12, D-L9.

**Change:**
- Auto-growing textareas (`field-sizing: content` with a JS fallback).
- One publish-bar behaviour across collections.
- "Use this photo" disabled until something is selected.
- `svg { flex: none }` in the dropzone.
- One sidebar item metric (icon, gap, rail box) shared by nav, Sign out and Collapse.
- A close button in the drawer.
- Top-bar buttons at one height and radius.
- Media filter that doesn't wrap, hidden on an empty library.
- Settings insets on the card primitive.
- The doubled field margin removed.
- The dashboard 404 on the normal page template.
- A sort select with a fixed small width.
- Copy fixes: "Live · Live.", "Question / Question", "Search…".

**Acceptance criteria:** each listed finding is gone in its screenshot. `layout-audit` shows no regressions.

## G8 · Tap targets and motion (P2/P3)

**Fixes:** D-X3, D-X6, D-X11, D-X12.

**Change:**
- Give standalone links a ≥ 24px hit area (padding or `::after`) and add them to the coarse-pointer list at line 2909.
- Disabled buttons styled beyond opacity.
- Tabular numbers on changing counts.
- Reduced-motion handling for toggles, the upload bar (use `transform`), autoplaying previews and Reorder (`MotionConfig reducedMotion="user"`).

**Acceptance criteria:** `small-touch-target` = 0 at phone and tablet, and the `prefers-reduced-motion: reduce` emulation shows no animated transitions.

## G9 · Public site: loading shifts (P1/P2)

**Fixes:** P-1, P-2.

**Change:**
- Render the footer inside the `<Suspense>` boundary, or make `.route-loading` `100svh` tall.
- Make the service skeleton use the same structure and padding as `.service-journey-hero`, and key the skeleton and loaded branches differently so React doesn't reuse the node. Better: resolve services before the lazy route mounts.
- Add a metric-matched fallback font (`size-adjust`) for Manrope.

**Acceptance criteria:** CLS < 0.02 on every public route at every width over 5 cold loads (`cls-probe`), with the content API delayed by 300ms to force the slow path.

## G10 · Public site: containers and components (P2/P3)

**Fixes:** P-3 to P-16.

**Change:**
- One container width (service detail and services hub on `.container`).
- Put the timeline rail behind opaque badges and centre it.
- Space out the phone service hero (spacing and CTA label).
- Make the results toolbar grid follow how many controls it has, and give the toggle the input height.
- Align the contact route cards.
- Add a fade or affordance to the story testimonial's scroll.
- Drop the fixed pathway `min-height` and pill width.
- Use `text-wrap: balance` instead of `Nch` caps on headings.
- Fold the late override block into the original rules.
- One stacked-button rule.

**Acceptance criteria:**
- Page edges line up with the nav at 1280 and 1440 on every page.
- No heading leaves one word on a line at 768, 1024 or 1440.
- Each listed finding is gone in its screenshot.

---

## Not UI (separate small tickets)

- **README local-testing advice:** move `dotenv.config()` to the first line of `server/app.js` (before any `require` that reads env), or fix the README. Today `CMS_DATA_PATH` in `.env` is ignored.
- **Flaky test:** raise the `findByRole` timeout in `AdminApp.test.jsx` "deep links open their section".

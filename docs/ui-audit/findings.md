# UI polish audit: findings register

Audit date 2026-11-11, branch `chore/ui-audit` (based on `feature/admin-changelog`). Scope: Jake's dashboard (`/admin`) first, then the public site.

**How the findings were gathered:**
- An automated layout sweep: 249 page × viewport captures at 375 / 768 / 1024 / 1280 / 1440 / 1920px, including empty, loading, error and interactive states.
- A static review of `admin.css` and the dashboard JSX against Vercel's Web Interface Guidelines.
- Three by-eye QA passes.

**What counts as a finding:** Every item below was confirmed in a screenshot or by computed styles in the running app. Machine candidates that weren't visibly wrong were dropped (about 30). How to rerun the audit: [tooling.md](tooling.md).

**Severity:**
- **P1:** visibly broken or unusable.
- **P2:** an inconsistency a user would notice.
- **P3:** polish or hygiene.

**Location:** Line numbers are in `site/client/src/admin/admin.css` unless another file is named.

**Not findings (sandbox artifacts):**
- Missing photos, videos and the sidebar logo: these come from R2, which the sandbox can't reach.
- The 8px sidebar shift on load: it's caused by that missing logo collapsing.
- Sticky bars sitting mid-page in full-page captures.

## Summary

| Area | P1 | P2 | P3 |
|---|---|---|---|
| Dashboard: cross-cutting | 1 | 5 | 6 |
| Dashboard: Home | 0 | 8 | 3 |
| Dashboard: lists | 1 | 5 | 3 |
| Dashboard: editors | 2 | 7 | 4 |
| Dashboard: shell, media, settings, changelog | 0 | 6 | 8 |
| Public site | 1 | 8 | 7 |

**Five root causes account for most of the dashboard findings:**
1. **The base-element resets outrank component styles.** `.jd-admin p` and `.jd-admin h1–h4` (lines 42–55) have specificity 0,1,1, which beats every single-class rule. As a result, about 20 colour and size rules are silently ignored.
2. **There is no shared card primitive and no spacing tokens.** About 25 surface classes each set their own padding (12–28px) and radius (8/10/12/16px). `admin.css` uses `var(--space-*)` and `var(--radius-*)` zero times, 21% of its spacing values are off the 4px grid, and `--jd-radius` (10px) is off the radius scale.
3. **Form and list density switch on viewport width, not on the width actually available.** The editor's form column is only 309–413px wide on a laptop or desktop, so desktop gets the most cramped forms.
4. **Fixed and sticky bars are sized with constants.** The publish bar reserve, `scroll-padding` and the skeleton heights all assume a single height, but the bars wrap.
5. **The same component is styled differently in different places.** Rules for one component are split across 2–4 places in the file, and editors, buttons and empty states behave differently per collection.

---

## Dashboard: cross-cutting

**D-X1 · P1 · every screen, every width: muted, accent and error text renders full white.**
- **Cause:** `.jd-admin p { color: inherit }` (line 51) beats single-class rules on every `<p>`.
- **Measured in the app** (`rgb(240,240,240)`):
  - Field errors (`.jd-field-error`, line 392) should be red.
  - The "Up 7%" trend chip (629–639) should be teal/salmon.
  - Hints and section descriptions (392, 1468) should be muted.
  - The rest: page ledes (962), sidebar group headings "Content"/"Site" (128), account email (159), scoreboard label (615), chart legend (738), ranked-list header, footnote (840), notices and errors (433–446), changelog summary (3008), empty states (656, 791), list meta (1040), preview note (1713), settings lede (2528).
- **Effects:**
  - The visual hierarchy is gone.
  - Error messages don't look like errors.
  - Hints are brighter than the headings above them, while `<span>` hints on the same form stay muted.
- The `line-height: .9 !important` at line 611 is an earlier workaround for the same bug.
- Evidence: `D01`, `D25`.

**D-X2 · P2 · Settings: panel titles are 14px, the same as their lede.** `.jd-admin h2 { font-size: inherit }` beats `.jd-settings-panel-title` (2524), so the panel has no heading level. Same root cause as D-X1. `D21`.

**D-X3 · P2 · phone, tablet: standalone links are about 20px tall** (minimum 24px). Affected:
- `.jd-back` (1302) on every editor and the Change log page.
- `.jd-settings-back` (2521).
- "View all (32)" (2963).
- Sidebar Sign out (166).
- Bulk-bar "Clear" (349).
- Settings booking-link URLs (2658).
- Toast action (1906).
- Pending-list links (938).

**D-X4 · P2 · keyboard focus lands under the sticky bars.**
- `scroll-padding` on `html` uses `var(--jd-topbar, 3.75rem)`, but the variable is defined on `.jd-admin`, so the 60px fallback always applies (line 38).
- It also ignores the sticky bulk bar (1020) and the Edit/Preview switch (2939), which reach about 110px.

**D-X5 · P2 · disabled icon buttons look enabled.**
- `.jd-admin-icon-button` (335/344) has no `:disabled` style, and its hover still applies when disabled.
- So the first row's "up" arrow and the last row's "down" arrow look clickable.

**D-X6 · P2 · disabled primary buttons are signalled by opacity only.** On phone, the full-width teal "Publish changes" still reads as active (1794).

**D-X7 · P3 · token hygiene.**
- No use of the shared `--space-*`/`--radius-*` tokens.
- 65 of 313 spacing declarations are off the 4px scale: 21 uses of 10px, 19 of 14px, 19 of 6px, and some 3px and 7px.
- 7 radius values.
- 13 font sizes.

**D-X8 · P3 · z-index values are ad hoc** (1, 5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 70, 90).
- Toasts (60) sit under the full-screen preview (90) and under the dialog backdrop (70).
- The pending-changes dropdown is trapped in the top bar's stacking context, so on windows ≤599px tall the publish bar (25) paints over its "Publish all" button.

**D-X9 · P3 · sticky offsets vary:** top bar + 0.5rem / 1rem / 1.5rem (1020, 1342, 2197, 2472, 2939).

**D-X10 · P3 · rules for one component are split or duplicated:**
- `.jd-row-check` (1134/1139).
- `.jd-field-row` (1480/2438).
- `.jd-rows-field-cells` (2388/2398/2443).
- `.jd-editor-switch` (1321/1385/2939).
- `.jd-editor` padding-bottom ×4.
- The publish bar is re-carded at 1439 only to undo 1802.
- `.jd-field + .jd-field` margin is undone three times.

**D-X11 · P3 · missing typographic details:**
- No tabular numbers on changing counts (chart tooltip 724, row "Updated" 1217, list meta, pending count).
- The chart tooltip doesn't use `Intl.NumberFormat`.
- Search placeholders end in "Search" rather than "Search…".

**D-X12 · P3 · reduced-motion gaps:**
- Toggle/switch transitions (1559–1618).
- The upload bar animates `width` (2064).
- Autoplaying video in `ImageFramer.jsx:77` and `VideoTrimmer.jsx:38`.
- Reorder in `CollectionList.jsx:170` has no `MotionConfig reducedMotion="user"`.

## Dashboard: Home

**D-H1 · P2 · all widths: "What's new" renders above the page title.** Every other page starts with its title; here the `<h1>` and period switcher sit below the changelog panel (`pages/Home.jsx:7`). `D06`, `D07`.

**D-H2 · P2 · all widths: Home jumps on load.**
- "What's new" arrives after the stats and pushes them down 235px on phone and 80px on tablet (CLS 0.18 on phone).
- The skeleton is a single 26rem block (484) with a 10px radius. The real content is a ~34rem, 16px-radius scoreboard plus two panels plus a footnote, so the page also jumps when stats arrive.
- `D08`.

**D-H3 · P2 · all widths: the space between sections varies.**
- What's new → title: 24–31px.
- Title → scoreboard: 24–31px.
- Scoreboard → panels: 16px.
- Panels → footnote: 20px.
- `D06`.

**D-H4 · P2 · all widths: the scoreboard doesn't match the panels around it.**
- Content inset 29px against 21px (8px misaligned; 17 vs 21px on phone).
- Radius 16px against 10px.
- Padding 28/28/20px, which is asymmetric.
- `.jd-scoreboard` (592, 769) against `.jd-panel` (780). `D06`.

**D-H5 · P2 · tablet and up: "Page views" and "Pages per visit" float at mid-height on the right**, not aligned with the big visit number. `D06`.

**D-H6 · P2 · ≥1280: nothing caps the content width.**
- `.jd-admin-main` (219) has no max-width, so at 1920 the cards are 1650px wide.
- What's new and the Change log text stop at 70ch (~590px) while "View all" sits at the far edge.
- `D11`, `D20`.

**D-H7 · P2 · empty state: the chart legend shows although no chart is drawn** (`HomeStats.jsx` ~143, 738). `D09`.

**D-H8 · P2 · error state: a bare strip with no retry, and the page ends there.** Its inset is 17px and radius 8px against the panels' 21px and 10px, and its text is white (D-X1). `D10`.

**D-H9 · P3 · ranked lists: the column header and labels sit 12px inside the panel title**, while the bars start at the title edge (800, 816).

**D-H10 · P3 · chart details.**
- The legend's dashed swatch doesn't match the plotted dash pattern.
- Three gridlines have no values and there's no baseline (706–712, 756–758).

**D-H11 · P3 · segmented control padding is 3px**, off the scale.

## Dashboard: lists (Results, Services, FAQs)

**D-L1 · P1 · FAQ reorder mode on phone falls apart.**
- The "Move" header wraps under "Question" and overlaps the grip.
- Each row's Live switch, "—" marker and up/down arrows stack on separate lines, so rows are ~150px tall.
- `--jd-row-indent` (2rem) doesn't match the grip width (~2.6rem) (263, 1127, 1238).
- `D05`.

**D-L2 · P2 · 1024 and 1280: the Result column is squeezed to 90px ("ANB champ…")** while fixed columns waste space.
- "Changes" is a fixed 168px column showing "—" on every row.
- Category and Type are 144px each, followed by ~100px of dead space.
- Same in tablet reorder view.
- `.jd-row-status` (1210), `.jd-row-cell` (1197). `D14`.

**D-L3 · P2 · phone: the "—" changes marker drops onto its own line** at the bottom-left of each row. `D16`.

**D-L4 · P2 · selecting a row moves the table.** The bulk bar is inserted in normal flow, so the header moves from y=301 to 367 and the row just clicked jumps 66px under the cursor (1018). `D15`.

**D-L5 · P2 · bulk bar: "Clear" is an underlined text link next to bordered buttons.** `D15`.

**D-L6 · P2 · "What Live, Offline and Unpublished changes mean" looks like static text.** `display: inline-flex` on the `<summary>` removes the disclosure triangle (1051). `D14`.

**D-L7 · P3 · "Reorder" and "Done reordering" use different button styles** in the same slot (967).

**D-L8 · P3 · Pages index: 7 cards leave an orphan on laptop and a gap on wide.** On phone each card is ~270px, mostly placeholder, so the list is 2242px long (2279).

**D-L9 · P3 · Change log: the two-option sort select stretches to 410–780px wide** (985). `D20`.

## Dashboard: editors (Results, Services, FAQs, Pages)

**D-E1 · P1 · laptop/desktop: Services "Quick facts" and price rows have 57px inputs.**
- The text is cut to "Entr" and "Read", and hints wrap to 3–4 lines.
- `.jd-rows-field-cells--3` (2405) stays 3 columns plus reorder controls inside a 309–413px form column.
- `D02`.

**D-E2 · P1 · laptop/desktop: two-up field rows don't fit.**
- Fields are 147px wide (199px on wide), so the "Required" tags wrap.
- Labels in one row are staggered by 18–45px.
- Inputs truncate ("Request Prep Asse…", "https://calendly.co…").
- Same root cause as D-E1. `.jd-field-row` (1480, 2438). `D03`.

**D-E3 · P1/P2 · phone: the fixed publish bar covers the end of the form.**
- The bar wraps to 104–146px (with the iPhone safe area) but only 88px is reserved (`--jd-publishbar` 4rem + 1.5rem; 1399, 1817, 1845).
- The last card and the Delete button sit under it.
- `D04`.

**D-E4 · P2 · ≥1000: the form column is out of line with the preview.**
- Form cards start 4px below the preview card.
- The gutter is 32px against ~20px elsewhere, because `.jd-editor-form` adds `padding: .25rem .75rem` for focus rings (1371–1376).
- The publish-bar content inset is 15px against 17px for form sections.
- Affects every editor. `D12`, `D13`.

**D-E5 · P2 · ≥1700: a dead strip of up to ~100px opens between form and preview.** The form stops at 34rem but its `2fr` track keeps growing (1328/1337).

**D-E6 · P2 · long-text fields don't grow with their content.**
- The FAQ answer is 144px tall for 188px of text, cut mid-sentence.
- Services list text areas are 79px tall for up to 188px of text (1515).
- `D25`.

**D-E7 · P2 · phone/tablet: the sticky Edit/Preview switch floats over the form with only an 8px halo**, so scrolled content shows beside it (2939). `D25`.

**D-E8 · P2 · Pages: chip position changes from card to card.** "Coaching process photo 1" wraps with an orphaned "1" and its "Built-in" chip drops a line, growing the title row from 24px to 74px (2341). `D13`.

**D-E9 · P2 · publish bar differs by collection.** Services and Pages show a disabled "Publish changes" button; Results and FAQs show none.

**D-E10 · P2 · media picker:**
- "Use this photo" is shown while nothing is selected.
- On phone the upload icon is squashed to 10×22px (2001).
- About 70px of dead space above the footer.
- `D18`.

**D-E11 · P3 · the publish bar says "Live · Live."** (1770). On the FAQ editor, the section title "Question" is followed straight away by the field label "Question".

**D-E12 · P3 · forms are inconsistent across collections.** Results uses static sections and a "Fields marked Required…" note; Services uses collapsible sections and no note.

**D-E13 · P3 · a long user-entered editor title can overflow at 320px.** It has no `overflow-wrap` and no `min-width: 0` (1314, `RecordEditor.jsx:269`).

## Dashboard: shell, media, settings, Change log

**D-S1 · P2 · sidebar: bottom actions don't line up with the nav.**
- "Sign out" and "Collapse menu" labels start 6px left of the nav labels.
- Their icons are 16px against 18px, and the gap is 8px against 12px (163, 2845 vs 135–138).
- `D24`.

**D-S2 · P2 · phone/tablet: the nav drawer has no close button.** Only the scrim or Esc closes it, and the drawer header doesn't match the 52px top bar it covers (237–246). `D19`.

**D-S3 · P2 · top bar: a 36px pill sits next to a 40px button with a different radius** (889 vs 278).

**D-S4 · P2 · Media, phone: the filter wraps to two rows inside one pill** ("Not used anywhere" drops under "Everything"), and the upload icon is squashed (2174, 2001). `D17`.

**D-S5 · P2 · Media, phone: the bottom sheet has no backdrop and no safe-area padding**, and lower tiles can't be scrolled clear of it (2263–2273).

**D-S6 · P2 · narrow windows force a two-up layout into tiny space.**
- Between 900 and 999px with the full sidebar, the settings two-pane layout leaves ~268px for the panel.
- `.jd-field-row` is still two-up there, giving 126px fields (2465).

**D-S7 · P3 · icon rail (900–1279):**
- Group dividers have 20px above and 8px below.
- Nav items are 51×36 rectangles while Sign out and Expand are 44×44 squares.
- Tooltips are native `title` attributes only.

**D-S8 · P3 · top bar: "View site" ends 16px inside the content's right edge.** On phone the right icon sits 18px in against 4px on the left.

**D-S9 · P3 · Settings: insets differ between the menu and panel columns.**
- Menu text at 20px, panel at 25px, other cards at 21px.
- Fields are capped at 44rem, leaving ~100px dead on the right.
- `D21`.

**D-S10 · P3 · Settings > Search listings:**
- Fieldset legends sit 6px right of their labels.
- The Title → Description gap is 27px against the grid's 12px, from a doubled `.jd-field + .jd-field` margin (385, 2615, 2626).
- `D22`.

**D-S11 · P3 · the dashboard 404 uses a different page template.** It's top-left with a 28px heading at y=134, against 22px at y=89 everywhere else (499). `D23`.

**D-S12 · P3 · Media: the filter shows on an empty library.** Change log on phone: the lede wraps with an orphaned "English." Section gaps under page headers: 1.5rem on Home, 1.25rem on lists and editors, 1rem on Media.

---

## Public site

Line numbers are in `site/client/src/styles/globals.css` unless another file is named. There is no horizontal overflow at 375px on any page.

**P-1 · P1 · service detail pages (all 4) · tablet and up: the page jumps on load (CLS 0.6–0.97).**
- **What happens:** if the route chunk arrives before `/api/content/services` (3 of 4 runs), `ServiceDetailPage.jsx:41-56` first renders `.service-route-loading` (3254, 3262). The real hero then replaces it, but the two don't match: at 768px the skeleton is 1033px tall with 96px top padding and no pill, stats or pricing, while the real hero is 1149px.
- **Why the score is so high:** React reuses the skeleton's `<div>` as `.service-journey-page`, so the whole page is scored as moving.
- **Font swap:** Manrope loads later and adds another 0.01–0.02.
- **Not part of the shift:** the faded first frame is an opacity entrance animation.
- **Risk:** these are the conversion pages, and the score affects Core Web Vitals.
- Evidence: `P01`.

**P-2 · P2 · every lazily loaded page · all widths: the footer shows before the page content** (CLS 0.06–0.11).
- The cause: `<Layout>` (nav, main, footer) sits outside `<Suspense>`, and the fallback `.route-loading` is `calc(100vh - 4.5rem)` tall (6979).
- So the footer's top 72px paints in the first frame, then gets pushed below the fold.
- /About is loaded eagerly and doesn't shift.
- `P02`.

**P-3 · P2 · service detail · all widths: in "The Team JD standard", the accent rail is drawn through the 01–04 step badges.**
- The rail sits at x=16.8px while the badge centre is at 14px.
- The badges have no z-index or opaque fill (3932–3940, 3964).
- `P03`.

**P-4 · P2 · service detail · phone ≤390: the hero is cramped.**
- The "Service Menu" pill is 8px under the nav (32px at 768), and the kicker, heading, stats and pricing are 8px apart.
- The CTA "Book Online Coaching Consult" wraps onto 2 lines with the arrow stranded (6923–6935).
- `P04`.

**P-5 · P2 · /results · desktop/wide: the toolbar grid has 4 columns but only 3 children** (when there are no mixed types).
- The HIDE toggle stretches to 236px and stops 12px short of the container edge.
- It's a 42px pill beside 48px square inputs (8252–8290, `Results.jsx:199`).
- `P05`.

**P-6 · P2 · /results · tablet: the toolbar breaks into 3 rows** (search, half-width select, then HIDE alone on the right) (8977–8990). `P06`.

**P-7 · P2 · /contact · laptop: the stacked route cards don't line up.**
- The secondary card is `calc(100% - 4rem)` with `margin-left: auto`, so its left edge is 64px right of the primary card's.
- The primary heading wraps at 14ch inside a 976px card (10213–10217, 9465–9467).
- `P07`.

**P-8 · P2 · home · laptop and up: the result-story testimonial is cut off mid-line** at the bottom of its card. It scrolls (415 vs 305px) with no fade or other sign that it does (`AppleWatchGallery.css:452-463`, `ResultPresentation.css:83`). `P08`.

**P-9 · P2 · service detail · desktop and up: the page sits 32px inside the nav and footer on each side.**
- Service detail uses a 76rem container (144/1296px at 1440); the nav, footer and every other page use 1280px (112/1328) (3740–3742, 3408–3414).
- `P09`.

**P-10 · P3 · /services: the card grid is capped at 64rem** (240/1200px at 1440), so it doesn't line up with the page hero or nav (2532–2537). `P10`.

**P-11 · P3 · home · tablet/laptop: pathway cards keep `min-height: 420px` in two columns**, leaving ~100px of dead space. The same rule also declares `min-height` twice (2261, 2271). The label pill has a fixed width, so labels wrap; at 1440 the "Best fit" line sits 18px higher in one card (2385). `P11`.

**P-12 · P3 · home: the credibility strip wraps 4+1 on wide** (one orphaned item) and 2+3 on tablet (940–946).

**P-13 · P3 · /, /about, /results: CTA banner.**
- The heading is capped at 15ch, leaving one word on its own line.
- The button stack ends 160px short of the card's inner edge (7013–7033).
- `P12`.

**P-14 · P3 · headings capped with `max-width: Nch` leave single words alone on a line at some widths.**
- About "Same" (7459).
- About bio heading at tablet: a ≤768 override loses to a later base rule of the same specificity (2930 vs 7106).
- The 4-line contact hero (9313).
- `text-wrap: balance` is applied to only some of them.

**P-15 · P3 · /about: the identity card has radius 0 and no side borders**, between a 16px-radius photo and 12px-radius stat cards (7075–7078). `P13`.

**P-16 · P3 · smaller items:**
- /contact: the service rows' trailing links end 17px before the "Find your fit" link below them (9653), and the form note leaves "Your Fit." alone on a line (`Contact.jsx:473`).
- Home on phone: stacked hero buttons are different widths (178 vs 190px) and left-aligned, while other pages stretch them (3152).
- Service detail: the standard section has three left edges, and the fact chips wrap 2+1 at 1440.
- /contact on phone: the "Film: Nike ↗" link is a 69×14px tap target (9507).

**Public site patterns:**
- Three container widths (1280px / 76rem / 64rem).
- `Nch` heading caps tuned for one viewport.
- A block of later "override" rules (~6900–7500) that silently beats earlier media queries; `.cta-banner` is defined twice (1223, 6991).
- Loading states don't match the real layout's size.
- No shared rule for stacked buttons.

---

## Not UI, found along the way

- **The README's local-testing advice doesn't work.** `CMS_DATA_PATH` and `ANALYTICS_DATA_DIR` set in `site/.env` are ignored, because `server/app.js` calls `dotenv.config()` (line ~34) after the content store and analytics modules have read them. Following the advice writes to `site/data/cms.json`.
- **A frontend test already fails on this branch.** `client/src/admin/AdminApp.test.jsx` "deep links open their section" fails consistently on this machine: its `findByRole` uses the 1s default and the lazy FAQs page takes ~2s to load. It fails with no source changes.

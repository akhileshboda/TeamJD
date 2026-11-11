# UI audit tooling

How the findings in this folder were produced, and how to run the audit again after a fix.

## Pieces

| Piece | Where | What it does |
|---|---|---|
| Sandbox server | `site/tools/ui-audit/serve.sh` | Builds the client and serves the site and dashboard on `:3100`. Sign-in is bypassed, asset sync is off, R2, Dropbox and Resend credentials are blank, and data lives in `site/data/ui-audit/` (gitignored). |
| Visit seeder | `site/tools/ui-audit/seed-analytics.js` | Writes ~120 days of fake visits so Home is audited with data in it. |
| Layout analyzer | `site/tools/ui-audit/analyze.js` | Runs inside the page and measures overflow, clipped text, overlap, card edge and inner-edge alignment, side-by-side row alignment, section rhythm, gutters, peer cards' padding and radius, off-scale values, tap targets, line length. |
| Runner | `site/tools/ui-audit/layout-audit.mjs` | Visits every scenario at 375/768/1024/1280/1440/1920, records layout shift, and saves viewport, full-page and annotated screenshots. Runs 3 at a time and can resume. |
| Scenarios | `site/tools/ui-audit/scenarios.mjs` | Every dashboard route, the empty/loading/error states of Home (mocked), editors, settings panels, and interactive states (drawer, collapsed sidebar, bulk select, reorder, media picker), plus the public pages. |
| Report | `site/tools/ui-audit/report.mjs` | Merges a run, collapses the same defect across viewports, and points each finding at the CSS rule. |
| Claude skill | `.claude/skills/layout-audit/` | The workflow above, for an agent. |
| Claude reviewer | `.claude/agents/ui-qa.md` | A QA persona that confirms the machine candidates against the screenshots and adds what geometry can't see. |
| Design skills | `.claude/skills/impeccable/`, `.claude/skills/web-design-guidelines/` | Vendored, pinned. See `.claude/skills/VENDORED.md`. |
| Browser for agents | `.mcp.json` | Playwright MCP, so an agent can open and inspect the running app. |

## Run it

```bash
cd site
bash tools/ui-audit/serve.sh                     # build + serve on :3100 (leave running)
node tools/ui-audit/layout-audit.mjs --set admin --out data/ui-audit/runs/<name>
node tools/ui-audit/layout-audit.mjs --set public --out data/ui-audit/runs/<name>-public
node tools/ui-audit/report.mjs data/ui-audit/runs/<name> --min P2
```

`--only admin-home,admin-faqs` and `--viewports phone,wide` narrow a run. On Git Bash, set `MSYS_NO_PATHCONV=1` before passing URL paths to helper scripts.

Never point the tools at a server started with a real `.env`: it reaches the production R2 bucket and Dropbox. Note that `CMS_DATA_PATH` and `ANALYTICS_DATA_DIR` set in `.env` are ignored (`server/app.js` loads `.env` after the modules that read them), which is why `serve.sh` exports them.

## Known limits

- Photos, videos and the dashboard logo come from R2, so they are missing in the sandbox. The 8px sidebar shift on load comes from the missing logo collapsing, not from the app.
- In full-page screenshots, sticky bars land wherever the scroll left them. Review the `.top.png` captures for those.
- The analyzer finds candidates. Every finding in `findings.md` was confirmed by eye or by computed styles.

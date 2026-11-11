---
name: web-design-guidelines
description: Review UI code (JSX/CSS) against Vercel's Web Interface Guidelines and report file:line findings. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or to check the dashboard/site against interface best practices.
metadata:
  author: vercel (vendored)
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Vercel's Web Interface Guidelines.

1. Read the rules in [guidelines.md](guidelines.md) (in this folder). This is a pinned copy; do not fetch rules from the network.
2. Read the files the user named (or the pattern). In this repo the usual targets are
   `site/client/src/admin/**/*.jsx` with `site/client/src/admin/admin.css`, and
   `site/client/src/{pages,components}/**/*.jsx` with `site/client/src/styles/*.css`.
   If nothing was named, ask which area to review.
3. Apply every rule and output findings in the `file:line` format the guidelines define.

The project's styling is plain CSS (no Tailwind utilities in JSX), so read rules written in Tailwind terms
(`focus-visible:ring-*`, `outline-none`) as their CSS equivalents.

# Vendored skills

| Skill | Source | Pinned at | Notes |
|---|---|---|---|
| `impeccable/` | github.com/pbakaus/impeccable, `plugin/skills/impeccable` (Apache-2.0) | commit c1e0e5492fbb, skill 4.8.2, engine 0.1.22 | Skill files only. The design-detector hook and subagents are **not** installed. The launcher (`scripts/impeccable[.cmd]`) downloads its engine binary from GitHub releases on first use and verifies it against `scripts/engine-checksums.txt`. Do **not** use `live` / `generate`: live Apply can start an agent with permissions bypassed. |
| `web-design-guidelines/` | github.com/vercel-labs/agent-skills + vercel-labs/web-interface-guidelines `command.md` (MIT) | guidelines commit 434b7f91364665 | Upstream fetches its rules from the network on every run; this copy reads the pinned `guidelines.md` instead. |

To update: re-clone the source, diff against this folder, review, then copy over and update the table.

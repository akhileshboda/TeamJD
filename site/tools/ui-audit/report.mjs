#!/usr/bin/env node
// Merges a layout-audit run into a deduplicated findings list.
//
//   node tools/ui-audit/report.mjs data/ui-audit/runs/<stamp> [--min P2]
//
// Writes <run>/findings.json and <run>/findings.md. The same defect at several
// viewports collapses into one row listing the viewports; each row gets the
// CSS file:line that defines its most specific class.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const siteRoot = path.resolve(here, '..', '..')
const runDir = path.resolve(siteRoot, process.argv[2] || '')
const minIdx = process.argv.indexOf('--min')
const MIN = minIdx >= 0 ? process.argv[minIdx + 1] : 'P3'
const rank = { P1: 1, P2: 2, P3: 3 }
const VIEWPORT_ORDER = ['phone', 'tablet', 'laptop', 'desktop', 'wide', 'xl']

const { results } = JSON.parse(fs.readFileSync(path.join(runDir, 'results.json'), 'utf8'))

// CSS index: class → first "file:line" where it starts a rule.
const cssFiles = [
  'client/src/admin/admin.css',
  'client/src/styles/globals.css',
  ...fs.readdirSync(path.join(siteRoot, 'client/src/styles')).filter((f) => f.endsWith('.css') && f !== 'globals.css').map((f) => `client/src/styles/${f}`),
]
const cssIndex = new Map()
for (const file of cssFiles) {
  const lines = fs.readFileSync(path.join(siteRoot, file), 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    if (!/[{,]\s*$/.test(line)) return
    for (const m of line.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
      const key = m[1]
      if (!cssIndex.has(key)) cssIndex.set(key, `site/${file}:${i + 1}`)
    }
  })
}
function sourceOf(selector) {
  const segment = selector.split(/\s+(?:\/|×|\||→)\s+/)[0]
  const classes = [...segment.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]).reverse()
  for (const c of classes) if (cssIndex.has(c)) return cssIndex.get(c)
  return ''
}

const groups = new Map()
const errors = []
for (const r of results) {
  if (r.error) { errors.push(`${r.scenario}@${r.viewport}: ${r.error.split('\n')[0]}`); continue }
  const marked = r.markedOrder || []
  let markIndex = 0
  for (const f of r.findings) {
    const marker = f.severity !== 'P3' && (f.rect || f.rects) ? ++markIndex : null
    if (rank[f.severity] > rank[MIN]) continue
    const key = `${r.scenario}|${f.check}|${f.selector}`
    if (!groups.has(key)) {
      groups.set(key, { scenario: r.scenario, path: r.path, check: f.check, severity: f.severity, selector: f.selector, label: f.label || '', source: sourceOf(f.selector), occurrences: [] })
    }
    groups.get(key).occurrences.push({ viewport: r.viewport, width: r.width, message: f.message, measured: f.measured, shot: r.annotated || r.shot, marker })
  }
  void marked
}

const findings = [...groups.values()].map((g) => {
  g.occurrences.sort((a, b) => VIEWPORT_ORDER.indexOf(a.viewport) - VIEWPORT_ORDER.indexOf(b.viewport))
  g.viewports = g.occurrences.map((o) => o.viewport)
  g.message = g.occurrences[g.occurrences.length - 1].message
  return g
}).sort((a, b) => rank[a.severity] - rank[b.severity] || a.scenario.localeCompare(b.scenario) || a.check.localeCompare(b.check))

findings.forEach((f, i) => { f.id = `A${String(i + 1).padStart(3, '0')}` })
fs.writeFileSync(path.join(runDir, 'findings.json'), JSON.stringify(findings, null, 2))

const counts = ['P1', 'P2', 'P3'].map((p) => `${p}: ${findings.filter((f) => f.severity === p).length}`).join(' · ')
const byCheck = {}
for (const f of findings) byCheck[f.check] = (byCheck[f.check] || 0) + 1
let md = `# Layout audit candidates\n\nRun: \`${path.relative(siteRoot, runDir)}\` · ${results.length} page/viewport captures · ${counts}\n\n`
md += `Candidates from the automated sweep. Each needs confirming against its screenshot before it goes in the findings register.\n\n`
md += `| Check | Count |\n|---|---|\n${Object.entries(byCheck).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n\n`
if (errors.length) md += `## Capture errors\n\n${errors.map((e) => `- ${e}`).join('\n')}\n\n`
let current = ''
for (const f of findings) {
  if (f.scenario !== current) { current = f.scenario; md += `\n## ${f.scenario} (\`${f.path}\`)\n\n` }
  const measured = [...new Set(f.occurrences.map((o) => `${o.viewport}: ${o.measured}`))].join('; ')
  md += `- **${f.id} ${f.severity} ${f.check}** — ${f.message}${f.label ? ` _(${f.label})_` : ''}\n  - \`${f.selector}\`${f.source ? ` → \`${f.source}\`` : ''}\n  - ${f.viewports.join(', ')} · ${measured.slice(0, 400)}\n`
}
fs.writeFileSync(path.join(runDir, 'findings.md'), md)
console.log(`${findings.length} findings (${counts}) → ${path.join(runDir, 'findings.md')}`)

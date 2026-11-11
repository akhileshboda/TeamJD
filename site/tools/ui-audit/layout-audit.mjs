#!/usr/bin/env node
// Layout audit: visits every scenario at every viewport, measures the rendered
// DOM (tools/ui-audit/analyze.js) and writes findings plus clean and annotated
// screenshots.
//
//   node tools/ui-audit/layout-audit.mjs [--base http://localhost:3100]
//        [--set admin|public|all] [--only admin-home,admin-faqs]
//        [--viewports phone,wide] [--out data/ui-audit/runs/<stamp>]
//
// Start the sandbox first: bash tools/ui-audit/serve.sh

import { chromium } from 'playwright'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ADMIN, PUBLIC, VIEWPORTS, SPACING_SCALE, RADIUS_SCALE } from './scenarios.mjs'

const require = createRequire(import.meta.url)
const { analyzeLayout } = require('./analyze.js')
const here = path.dirname(fileURLToPath(import.meta.url))
const siteRoot = path.resolve(here, '..', '..')

const argv = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : fallback
}
const BASE = opt('base', 'http://localhost:3100')
const SET = opt('set', 'all')
const ONLY = opt('only', '')?.split(',').filter(Boolean)
const VIEWPORT_NAMES = opt('viewports', Object.keys(VIEWPORTS).join(',')).split(',')
const CONCURRENCY = Number(opt('concurrency', 3))
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const OUT = path.resolve(siteRoot, opt('out', `data/ui-audit/runs/${stamp}`))
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true })

const FREEZE_CSS = `*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;caret-color:transparent!important;scroll-behavior:auto!important}`

const CLS_SCRIPT = () => {
  window.__shifts = []
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue
        window.__shifts.push({
          value: entry.value,
          sources: (entry.sources || []).map((s) => {
            const n = s.node && s.node.nodeType === 1 ? s.node : s.node?.parentElement
            return n ? `${n.tagName.toLowerCase()}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}` : '?'
          }),
        })
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch (_e) { /* not supported */ }
}

// Resolves once no request has been in flight for 400ms (max 6s). Unlike
// networkidle this doesn't stall on screens that poll.
function trackRequests(page) {
  const state = { inflight: 0, last: Date.now() }
  const done = () => { state.inflight = Math.max(0, state.inflight - 1); state.last = Date.now() }
  page.on('request', () => { state.inflight += 1; state.last = Date.now() })
  page.on('requestfinished', done)
  page.on('requestfailed', done)
  page.__net = state
}
async function quiet(page, { idle = 400, max = 6000 } = {}) {
  const start = Date.now()
  while (Date.now() - start < max) {
    const n = page.__net
    if (!n || (n.inflight === 0 && Date.now() - n.last >= idle)) return
    await page.waitForTimeout(100)
  }
}

async function settle(page, scenario) {
  if (scenario.waitFor) await page.waitForSelector(scenario.waitFor, { state: 'visible', timeout: 15000 }).catch(() => {})
  if (!scenario.noIdle) await quiet(page)
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {})
  // Walk the page so whileInView reveals fire, then return to the top.
  await page.evaluate(async () => {
    const step = Math.max(200, window.innerHeight * 0.7)
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 250))
  })
}

async function annotate(page, findings) {
  await page.evaluate((items) => {
    const layer = document.createElement('div')
    layer.id = '__ui_audit_layer'
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none'
    const colours = { P1: '#ff2d55', P2: '#ffb020', P3: '#4da3ff' }
    items.forEach((f, i) => {
      const rects = f.rects && f.rects.length ? f.rects : f.rect ? [f.rect] : []
      rects.forEach((r, j) => {
        const box = document.createElement('div')
        box.style.cssText = `position:absolute;left:${r.x}px;top:${r.y}px;width:${Math.max(r.w, 2)}px;height:${Math.max(r.h, 2)}px;outline:2px solid ${colours[f.severity]};background:${colours[f.severity]}14`
        if (j === 0) {
          const tag = document.createElement('span')
          tag.textContent = `${i + 1}`
          tag.style.cssText = `position:absolute;left:-2px;top:-18px;font:700 11px/16px system-ui;padding:0 4px;color:#000;background:${colours[f.severity]}`
          box.appendChild(tag)
        }
        layer.appendChild(box)
      })
    })
    document.body.appendChild(layer)
  }, findings)
}

async function expand(browser, scenarios) {
  const out = []
  for (const s of scenarios) {
    if (!s.discover) { out.push(s); continue }
    const page = await browser.newPage({ viewport: VIEWPORTS.wide })
    trackRequests(page)
    await page.goto(BASE + s.discover.from, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await quiet(page)
    await page.waitForTimeout(300)
    const hrefs = await page.$$eval(s.discover.selector, (as) => [...new Set(as.map((a) => a.getAttribute('href')))]).catch(() => [])
    await page.close()
    if (s.discover.includeFrom) out.push({ ...s, id: s.id, path: s.discover.from, discover: undefined })
    hrefs.filter((h) => h !== s.discover.from).slice(0, s.discover.limit).forEach((href) => {
      const slug = href.split('/').filter(Boolean).pop()
      out.push({ ...s, id: `${s.id}--${slug}`, path: href, discover: undefined })
    })
    if (!hrefs.length) console.warn(`  ! discover found nothing for ${s.id} (${s.discover.selector})`)
  }
  return out
}

async function main() {
  const browser = await chromium.launch()
  let scenarios = SET === 'admin' ? ADMIN : SET === 'public' ? PUBLIC : [...ADMIN, ...PUBLIC]
  scenarios = await expand(browser, scenarios)
  if (ONLY.length) scenarios = scenarios.filter((s) => ONLY.some((o) => s.id === o || s.id.startsWith(`${o}--`)))

  const resultsFile = path.join(OUT, 'results.json')
  const previous = fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile, 'utf8')).results : []
  const results = previous.filter((r) => !r.error)
  const done = new Set(results.map((r) => `${r.scenario}@${r.viewport}`))
  const save = () => fs.writeFileSync(resultsFile, JSON.stringify({ base: BASE, createdAt: new Date().toISOString(), results }, null, 2))
  if (done.size) console.log(`Resuming: ${done.size} captures already in ${resultsFile}`)

  const jobs = []
  for (const scenario of scenarios) {
    for (const vpName of (scenario.viewports || VIEWPORT_NAMES).filter((n) => VIEWPORT_NAMES.includes(n))) {
      if (!done.has(`${scenario.id}@${vpName}`)) jobs.push({ scenario, vpName })
    }
  }

  async function capture({ scenario, vpName }) {
    const viewport = VIEWPORTS[vpName]
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' })
    const page = await context.newPage()
    trackRequests(page)
    await page.addInitScript(CLS_SCRIPT)
    const consoleErrors = []
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 200)))
    page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)))
    if (scenario.setup) await scenario.setup(page)
    const key = `${scenario.id}@${vpName}`
    try {
      await page.goto(BASE + scenario.path, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await settle(page, scenario)
      if (scenario.after) {
        await scenario.after(page)
        await page.waitForTimeout(500)
      }
      const shifts = await page.evaluate(() => window.__shifts || [])
      await page.addStyleTag({ content: FREEZE_CSS })
      const [first, second] = scenario.scope.split(',').map((x) => x.trim())
      const scope = (await page.$(first)) ? first : (second || 'body')
      const { findings, metrics } = await page.evaluate(analyzeLayout, {
        scopeSelector: scope,
        spacingScale: SPACING_SCALE,
        radiusScale: RADIUS_SCALE,
        narrow: viewport.width < 900,
      })
      const cls = shifts.reduce((sum, e) => sum + e.value, 0)
      if (cls > 0.05) {
        const sources = [...new Set(shifts.flatMap((e) => e.sources))].slice(0, 5)
        findings.push({ check: 'layout-shift', severity: 'P2', message: `Content jumps while loading (CLS ${cls.toFixed(3)}).`, measured: cls.toFixed(3), selector: sources.join(' | '), rect: null })
      }
      const shot = `shots/${key}.png`
      const top = `shots/${key}.top.png`
      const annotated = `shots/${key}.annotated.png`
      // Viewport capture first: what a person actually sees, with sticky bars in place.
      await page.screenshot({ path: path.join(OUT, top) })
      await page.screenshot({ path: path.join(OUT, shot), fullPage: true })
      const marked = findings.filter((f) => f.severity !== 'P3' && (f.rect || f.rects))
      if (marked.length) {
        await annotate(page, marked)
        await page.screenshot({ path: path.join(OUT, annotated), fullPage: true })
      }
      results.push({ scenario: scenario.id, path: scenario.path, viewport: vpName, width: viewport.width, findings, metrics, cls, consoleErrors, shot, top, annotated: marked.length ? annotated : null, markedOrder: marked.map((f) => f.check) })
      const counts = ['P1', 'P2', 'P3'].map((p) => `${p}:${findings.filter((f) => f.severity === p).length}`).join(' ')
      console.log(`${key.padEnd(48)} ${counts}`)
    } catch (error) {
      console.log(`${key.padEnd(48)} ERROR ${error.message.split(String.fromCharCode(10))[0]}`)
      results.push({ scenario: scenario.id, path: scenario.path, viewport: vpName, error: error.message })
    }
    save()
    await context.close()
  }

  let next = 0
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, async () => {
    while (next < jobs.length) await capture(jobs[next++])
  }))
  await browser.close()
  save()
  console.log(`
Wrote ${results.length} page/viewport results to ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

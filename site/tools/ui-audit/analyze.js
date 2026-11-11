// In-page layout analyzer. Serialised by Playwright and run inside the page, so it
// must stay self-contained (no imports, no closures over Node values).
//
// It measures what a picky front-end reviewer would eyeball: block rhythm, edge
// alignment, peer cards that disagree on padding/radius, values off the token
// scale, overflow, overlap, clipped text, small touch targets and long lines.
// Every finding carries a page-coordinate rect so it can be drawn on a screenshot.

/* eslint-disable no-undef */
function analyzeLayout(opts) {
  const {
    scopeSelector,
    spacingScale,
    radiusScale,
    alignTolerance = 12,
    touchMin = 24,
    narrow = false,
  } = opts

  const findings = []
  const metrics = { radii: {}, paddings: {}, gaps: {} }
  const sx = window.scrollX
  const sy = window.scrollY
  const vw = document.documentElement.clientWidth
  const scope = document.querySelector(scopeSelector) || document.body

  const px = (v) => Math.round(parseFloat(v) * 100) / 100 || 0
  const near = (a, b, t = 0.6) => Math.abs(a - b) <= t
  const inScale = (v, scale) => v === 0 || scale.some((s) => near(v, s))
  const pageRect = (r) => ({ x: Math.round(r.left + sx), y: Math.round(r.top + sy), w: Math.round(r.width), h: Math.round(r.height) })
  const bump = (bag, key) => { bag[key] = (bag[key] || 0) + 1 }

  function selectorOf(el) {
    const parts = []
    let node = el
    for (let depth = 0; node && node.nodeType === 1 && depth < 4; depth += 1) {
      if (node.id) { parts.unshift(`#${node.id}`); break }
      const classes = [...node.classList].filter((c) => !/^(is-|has-)/.test(c)).slice(0, 2)
      let part = node.tagName.toLowerCase() + (classes.length ? `.${classes.join('.')}` : '')
      const parent = node.parentElement
      if (parent && !classes.length) {
        const same = [...parent.children].filter((c) => c.tagName === node.tagName)
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`
      }
      parts.unshift(part)
      if (classes.length && depth >= 1) break
      node = parent
    }
    return parts.join(' > ')
  }

  function label(el) {
    const heading = el.querySelector('h1,h2,h3,h4,[class*="title"]')
    const text = (heading || el).textContent.replace(/\s+/g, ' ').trim()
    return text.slice(0, 48)
  }

  function visible(el) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false
    if (parseFloat(cs.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    if (r.width <= 1.5 || r.height <= 1.5) return false
    if (cs.clip && cs.clip !== 'auto' && /^rect\(0(px)?,? ?0(px)?/.test(cs.clip)) return false
    return true
  }

  function hiddenByAncestor(el) {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (parseFloat(cs.opacity) === 0 || cs.visibility === 'hidden') return true
      if (n.getAttribute('aria-hidden') === 'true' && n.closest('[inert]')) return true
    }
    return false
  }

  function alpha(color) {
    if (!color || color === 'transparent') return 0
    const m = color.match(/rgba?\(([^)]+)\)/)
    if (!m) return 1
    const parts = m[1].split(/[ ,/]+/).filter(Boolean)
    return parts.length >= 4 ? parseFloat(parts[3]) : 1
  }

  const SKIP_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'IMG', 'SVG', 'PATH', 'VIDEO', 'IFRAME', 'CANVAS', 'LABEL', 'OPTION', 'PICTURE', 'SOURCE', 'HR'])

  function isContainer(el, cs, r) {
    if (SKIP_TAGS.has(el.tagName)) return false
    if (el.tagName === 'A' && r.height < 64) return false
    if (r.width < 48 || r.height < 32) return false
    if (cs.position === 'fixed') return false
    const bg = alpha(cs.backgroundColor) > 0.02 || (cs.backgroundImage && cs.backgroundImage !== 'none' && !cs.backgroundImage.startsWith('url'))
    const borders = ['Top', 'Right', 'Bottom', 'Left'].filter((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none' && alpha(cs[`border${s}Color`]) > 0.02).length
    const shadow = cs.boxShadow && cs.boxShadow !== 'none'
    return Boolean(bg || borders >= 3 || shadow)
  }

  // ---- collect ------------------------------------------------------------
  const nodes = [...scope.querySelectorAll('*')].filter((el) => visible(el) && !hiddenByAncestor(el))
  const boxes = new Map()
  for (const el of nodes) {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    boxes.set(el, { el, cs, r })
  }

  const containers = []
  for (const b of boxes.values()) {
    if (!isContainer(b.el, b.cs, b.r)) continue
    const pad = ['Top', 'Right', 'Bottom', 'Left'].map((s) => px(b.cs[`padding${s}`]))
    const border = ['Top', 'Right', 'Bottom', 'Left'].map((s) => px(b.cs[`border${s}Width`]))
    const radius = px(b.cs.borderTopLeftRadius)
    containers.push({ ...b, pad, border, radius, sel: selectorOf(b.el) })
  }
  const containerSet = new Set(containers.map((c) => c.el))
  const outerContainer = (el) => {
    for (let n = el.parentElement; n && n !== scope.parentElement; n = n.parentElement) if (containerSet.has(n)) return n
    return null
  }
  for (const c of containers) c.parentContainer = outerContainer(c.el)

  const add = (f) => findings.push(f)

  // ---- 1. page-level horizontal overflow ----------------------------------
  const docW = document.documentElement.scrollWidth
  if (docW > vw + 1) {
    const clipped = (el) => {
      for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX
        if (ox !== 'visible') return true
      }
      return false
    }
    const culprits = [...document.body.querySelectorAll('*')]
      .filter((el) => visible(el))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.right > vw + 1 && !clipped(el) })
      .filter((el, _i, arr) => !arr.includes(el.parentElement))
      .slice(0, 5)
    add({
      check: 'page-overflow', severity: 'P1',
      message: `Page scrolls sideways: content is ${docW}px wide in a ${vw}px viewport.`,
      measured: `${docW - vw}px overflow`,
      selector: culprits.map(selectorOf).join(' | ') || 'html',
      rect: culprits[0] ? pageRect(culprits[0].getBoundingClientRect()) : null,
    })
  }

  // ---- 2. clipped / spilling content ----------------------------------------
  for (const b of boxes.values()) {
    const { el, cs } = b
    if (SKIP_TAGS.has(el.tagName)) continue
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    const overX = el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0
    if (!overX) continue
    if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && hasText && cs.textOverflow !== 'ellipsis' && cs.whiteSpace !== 'normal') {
      add({ check: 'clipped-text', severity: 'P1', message: 'Text is cut off without an ellipsis.', measured: `${el.scrollWidth - el.clientWidth}px hidden`, selector: selectorOf(el), label: el.textContent.trim().slice(0, 40), rect: pageRect(b.r) })
    } else if (cs.overflowX === 'visible' && containerSet.has(el)) {
      add({ check: 'content-spill', severity: 'P1', message: 'Content spills out of its card/panel.', measured: `${el.scrollWidth - el.clientWidth}px past the edge`, selector: selectorOf(el), label: label(el), rect: pageRect(b.r) })
    }
  }

  // ---- 3. overlap between flex/grid siblings ----------------------------------
  const flowParents = new Set()
  for (const b of boxes.values()) if (/flex|grid/.test(b.cs.display)) flowParents.add(b.el)
  for (const parent of flowParents) {
    const kids = [...parent.children].map((k) => boxes.get(k)).filter((k) => k && !/absolute|fixed/.test(k.cs.position))
    for (let i = 0; i < kids.length; i += 1) {
      for (let j = i + 1; j < kids.length; j += 1) {
        const a = kids[i].r; const c = kids[j].r
        const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left)
        const oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top)
        if (ox > 2 && oy > 2) {
          add({ check: 'overlap', severity: 'P1', message: 'Two items in the same row/column overlap.', measured: `${Math.round(ox)}x${Math.round(oy)}px`, selector: `${selectorOf(kids[i].el)}  ×  ${selectorOf(kids[j].el)}`, rect: pageRect({ left: Math.max(a.left, c.left), top: Math.max(a.top, c.top), width: ox, height: oy }) })
        }
      }
    }
  }

  // ---- 4. container token hygiene + inventory ---------------------------------
  const seenOff = new Set()
  for (const c of containers) {
    bump(metrics.radii, c.radius)
    bump(metrics.paddings, c.pad.join(' '))
    const cls = c.sel
    if (c.radius > 0 && c.radius < 500 && !inScale(c.radius, radiusScale) && !seenOff.has(`r:${cls}`)) {
      seenOff.add(`r:${cls}`)
      add({ check: 'off-scale-radius', severity: 'P3', message: `Corner radius ${c.radius}px is not on the radius scale (${radiusScale.join('/')}).`, measured: `${c.radius}px`, selector: cls, label: label(c.el), rect: pageRect(c.r) })
    }
    const offPads = c.pad.filter((p) => !inScale(p, spacingScale))
    if (offPads.length && !seenOff.has(`p:${cls}`)) {
      seenOff.add(`p:${cls}`)
      add({ check: 'off-scale-padding', severity: 'P3', message: `Padding ${c.pad.join(' ')}px uses values off the 4px spacing scale.`, measured: c.pad.join(' '), selector: cls, label: label(c.el), rect: pageRect(c.r) })
    }
    const [pt, pr, pb, pl] = c.pad
    if (c.r.height > 80 && Math.abs(pt - pb) > 4 && pt > 0 && pb > 0 && !seenOff.has(`a:${cls}`)) {
      seenOff.add(`a:${cls}`)
      add({ check: 'asymmetric-padding', severity: 'P3', message: `Top and bottom padding differ (${pt} vs ${pb}px).`, measured: `${pt}/${pb}`, selector: cls, label: label(c.el), rect: pageRect(c.r) })
    }
    if (Math.abs(pl - pr) > 1 && pl > 0 && pr > 0 && !seenOff.has(`h:${cls}`)) {
      seenOff.add(`h:${cls}`)
      add({ check: 'asymmetric-padding', severity: 'P2', message: `Left and right padding differ (${pl} vs ${pr}px), so content sits off-centre.`, measured: `${pl}/${pr}`, selector: cls, label: label(c.el), rect: pageRect(c.r) })
    }
  }

  // Gaps on flex/grid parents.
  const seenGap = new Set()
  for (const parent of flowParents) {
    const b = boxes.get(parent)
    for (const prop of ['rowGap', 'columnGap']) {
      const v = px(b.cs[prop])
      if (!v) continue
      bump(metrics.gaps, v)
      const sel = selectorOf(parent)
      if (!inScale(v, spacingScale) && !seenGap.has(sel)) {
        seenGap.add(sel)
        add({ check: 'off-scale-gap', severity: 'P3', message: `${prop === 'rowGap' ? 'Row' : 'Column'} gap ${v}px is off the 4px spacing scale.`, measured: `${v}px`, selector: sel, rect: pageRect(b.r) })
      }
    }
  }

  // ---- 5. peer cards that disagree ---------------------------------------------
  // Peers = containers with the same parent, or the same CSS selector on the page.
  const isControl = (el) => el.matches('[role="group"], [role="tablist"], [role="toolbar"], [role="radiogroup"], fieldset')
  const groups = new Map()
  for (const c of containers) {
    if (isControl(c.el)) continue
    const key = `parent:${selectorOf(c.el.parentElement)}::${c.el.tagName}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  }
  for (const [, peers] of groups) {
    if (peers.length < 2) continue
    const describe = (c) => `${c.sel} (pad ${c.pad.join(' ')}, radius ${c.radius})`
    const radii = new Set(peers.map((p) => p.radius))
    const padX = new Set(peers.map((p) => `${p.pad[3]}/${p.pad[1]}`))
    if (radii.size > 1 || padX.size > 1) {
      add({ check: 'peer-mismatch', severity: 'P2', message: `Sibling cards disagree on ${[radii.size > 1 && 'corner radius', padX.size > 1 && 'horizontal padding'].filter(Boolean).join(' and ')}.`, measured: peers.map(describe).join(' | '), selector: peers[0].sel, rect: pageRect(peers[0].r), rects: peers.map((p) => pageRect(p.r)) })
    }
  }

  // ---- 6. main-column blocks: alignment + rhythm ---------------------------------
  // Blocks = outermost containers plus headings/heading rows that sit outside any container.
  const headingEls = nodes.filter((el) => /^H[1-3]$/.test(el.tagName) && !outerContainer(el))
  const blocks = [
    ...containers.filter((c) => !c.parentContainer && c.r.height >= 56 && !c.el.matches('[role="group"], [role="tablist"], [role="toolbar"], [role="radiogroup"], fieldset')).map((c) => ({ kind: 'card', el: c.el, r: c.r, c })),
    ...headingEls.map((el) => ({ kind: 'heading', el, r: boxes.get(el).r })),
  ].filter((b) => b.r.width > 120)
  // Text-ish blocks outside cards (paragraphs) participate in rhythm but not edge checks.
  const loose = nodes.filter((el) => el.tagName === 'P' && !outerContainer(el) && el.textContent.trim().length > 20).map((el) => ({ kind: 'text', el, r: boxes.get(el).r }))
  const flow = [...blocks, ...loose].sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left)

  // 6a. edge near-misses between vertically adjacent cards.
  const cards = blocks.filter((b) => b.kind === 'card')
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = 0; j < cards.length; j += 1) {
      if (i === j) continue
      const a = cards[i]; const b = cards[j]
      if (b.r.top < a.r.bottom - 1) continue
      if (b.r.top - a.r.bottom > 80) continue
      const hOverlap = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
      if (hOverlap < 40) continue
      for (const edge of ['left', 'right']) {
        const d = Math.abs(a.r[edge] - b.r[edge])
        if (d > 1 && d <= alignTolerance) {
          add({ check: 'edge-misaligned', severity: 'P2', message: `Stacked cards' ${edge} edges miss each other by ${Math.round(d)}px.`, measured: `${Math.round(d)}px`, selector: `${selectorOf(a.el)}  /  ${selectorOf(b.el)}`, rect: pageRect(b.r), rects: [pageRect(a.r), pageRect(b.r)] })
        }
      }
      // 6b. inner content edge: same outer edge, different inset.
      if (near(a.r.left, b.r.left, 1) && a.c.pad[3] > 0 && b.c.pad[3] > 0) {
        const ia = a.r.left + a.c.border[3] + a.c.pad[3]
        const ib = b.r.left + b.c.border[3] + b.c.pad[3]
        if (Math.abs(ia - ib) > 1) {
          add({ check: 'inner-edge-misaligned', severity: 'P2', message: `Cards share an outer edge but their content starts ${Math.round(Math.abs(ia - ib))}px apart.`, measured: `insets ${Math.round(ia - a.r.left)} vs ${Math.round(ib - b.r.left)}px`, selector: `${selectorOf(a.el)}  /  ${selectorOf(b.el)}`, rect: pageRect(b.r), rects: [pageRect(a.r), pageRect(b.r)] })
        }
      }
    }
  }

  // 6c. headings vs the cards below them: outer edge near-miss.
  for (const h of blocks.filter((b) => b.kind === 'heading')) {
    const below = cards.filter((c) => c.r.top >= h.r.bottom - 1 && c.r.top - h.r.bottom < 64).sort((a, b) => a.r.top - b.r.top)[0]
    if (!below) continue
    const range = document.createRange()
    range.selectNodeContents(h.el)
    const textLeft = range.getBoundingClientRect().left
    const inner = below.r.left + below.c.border[3] + below.c.pad[3]
    const dOuter = Math.abs(textLeft - below.r.left)
    const dInner = Math.abs(textLeft - inner)
    const d = Math.min(dOuter, dInner)
    if (d > 1.5 && d <= alignTolerance) {
      add({ check: 'heading-misaligned', severity: 'P2', message: `Heading text starts ${Math.round(d)}px off the card edge below it.`, measured: `${Math.round(d)}px`, selector: selectorOf(h.el), label: h.el.textContent.trim().slice(0, 40), rect: pageRect(h.r) })
    }
  }

  // 6d. vertical rhythm between consecutive blocks in the same column.
  const rhythm = []
  for (let i = 0; i < flow.length; i += 1) {
    const a = flow[i]
    const next = flow.slice(i + 1).find((b) => b.r.top >= a.r.bottom - 1 && Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 40 && !a.el.contains(b.el) && !b.el.contains(a.el))
    if (!next) continue
    const gap = Math.round(next.r.top - a.r.bottom)
    if (gap > 160) continue
    rhythm.push({ from: a.kind, to: next.kind, gap, a, b: next })
  }
  metrics.rhythm = rhythm.map((g) => `${g.from}→${g.to} ${g.gap}`)
  const cardGaps = rhythm.filter((g) => g.from === 'card' && g.to === 'card')
  // Section separations: any gap that follows a card (card→card, card→heading, card→text).
  const sectionGaps = rhythm.filter((g) => g.from === 'card' && g.gap > 0)
  const distinct = [...new Set(sectionGaps.map((g) => g.gap))]
  if (distinct.length > 1 && Math.max(...distinct) - Math.min(...distinct) > 4) {
    add({ check: 'uneven-rhythm', severity: 'P2', message: `Space after cards varies: ${distinct.sort((x, y) => x - y).join(', ')}px.`, measured: sectionGaps.map((g) => `${selectorOf(g.a.el)} → ${g.to} ${selectorOf(g.b.el)}: ${g.gap}`).join(' | '), selector: 'main column', rect: pageRect(sectionGaps[0].b.r), rects: sectionGaps.map((g) => pageRect({ left: Math.max(g.a.r.left, g.b.r.left), top: g.a.r.bottom, width: Math.min(g.a.r.width, g.b.r.width), height: Math.max(g.gap, 2) })) })
  }
  for (const g of rhythm) {
    if (g.gap > 0 && !inScale(g.gap, spacingScale)) {
      add({ check: 'off-scale-gap', severity: 'P3', message: `${g.from} → ${g.to} gap is ${g.gap}px, off the spacing scale.`, measured: `${g.gap}px`, selector: `${selectorOf(g.a.el)} → ${selectorOf(g.b.el)}`, rect: pageRect({ left: g.b.r.left, top: g.a.r.bottom, width: g.b.r.width, height: Math.max(g.gap, 2) }) })
    }
  }

  // 6e. side-by-side cards: column gap vs the column's vertical gap.
  const rows = []
  for (const a of cards) for (const b of cards) {
    if (a === b || b.r.left <= a.r.right - 1) continue
    if (!near(a.r.top, b.r.top, 2)) continue
    const gap = Math.round(b.r.left - a.r.right)
    if (gap >= 0 && gap < 120) rows.push({ a, b, gap })
  }
  const vGaps = cardGaps.map((g) => g.gap)
  for (const row of rows) {
    if (vGaps.length && !vGaps.some((v) => Math.abs(v - row.gap) <= 2)) {
      add({ check: 'gutter-mismatch', severity: 'P2', message: `Side-by-side cards are ${row.gap}px apart but stacked cards are ${[...new Set(vGaps)].join('/')}px apart.`, measured: `${row.gap}px vs ${[...new Set(vGaps)].join('/')}px`, selector: `${selectorOf(row.a.el)} | ${selectorOf(row.b.el)}`, rect: pageRect({ left: row.a.r.right, top: row.a.r.top, width: Math.max(row.gap, 2), height: Math.min(row.a.r.height, row.b.r.height) }) })
    }
  }

  // 6f. side-by-side cards whose top (or bottom) edges nearly, but don't, line up.
  for (const a of cards) for (const b of cards) {
    if (a === b || b.r.left < a.r.right - 1 || b.r.left - a.r.right > 120) continue
    const vOverlap = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
    if (vOverlap < Math.min(a.r.height, b.r.height) * 0.5) continue
    const dTop = Math.abs(a.r.top - b.r.top)
    if (dTop > 1 && dTop <= alignTolerance) {
      add({ check: 'row-misaligned', severity: 'P2', message: `Side-by-side cards' top edges miss each other by ${Math.round(dTop)}px.`, measured: `${Math.round(dTop)}px`, selector: `${selectorOf(a.el)}  /  ${selectorOf(b.el)}`, rect: pageRect(b.r), rects: [pageRect(a.r), pageRect(b.r)] })
    }
    // Inner content of side-by-side cards: first line of content should start at the same height.
    const ta = a.r.top + a.c.border[0] + a.c.pad[0]
    const tb = b.r.top + b.c.border[0] + b.c.pad[0]
    if (dTop <= 1 && Math.abs(ta - tb) > 1 && Math.abs(ta - tb) <= 16) {
      add({ check: 'inner-edge-misaligned', severity: 'P2', message: `Side-by-side cards start their content ${Math.round(Math.abs(ta - tb))}px apart vertically.`, measured: `top insets ${Math.round(ta - a.r.top)} vs ${Math.round(tb - b.r.top)}px`, selector: `${selectorOf(a.el)}  /  ${selectorOf(b.el)}`, rect: pageRect(b.r), rects: [pageRect(a.r), pageRect(b.r)] })
    }
  }

  // ---- 7. touch targets (narrow viewports)---------------------------------------
  if (narrow) {
    const seenTarget = new Set()
    for (const b of boxes.values()) {
      const { el, r } = b
      const interactive = el.matches('button, [role="button"], select, input:not([type="hidden"]), a[href], [role="tab"], [role="switch"]')
      if (!interactive) continue
      if (el.tagName === 'A' && el.closest('p, li') && getComputedStyle(el).display === 'inline') continue
      if (r.width >= touchMin && r.height >= touchMin) continue
      const wrap = el.closest('label')
      if (wrap && wrap !== el) { const lr = wrap.getBoundingClientRect(); if (lr.width >= touchMin && lr.height >= touchMin) continue }
      const after = getComputedStyle(el, '::after')
      if (after.content !== 'none' && after.position === 'absolute') continue
      const sel = selectorOf(el)
      if (seenTarget.has(sel)) continue
      seenTarget.add(sel)
      add({ check: 'small-touch-target', severity: 'P2', message: `Tap target is ${Math.round(r.width)}x${Math.round(r.height)}px (minimum ${touchMin}px).`, measured: `${Math.round(r.width)}x${Math.round(r.height)}`, selector: sel, label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), rect: pageRect(r) })
    }
  }

  // ---- 8. line length ------------------------------------------------------------
  const seenMeasure = new Set()
  for (const b of boxes.values()) {
    if (b.el.tagName !== 'P') continue
    const fs = parseFloat(b.cs.fontSize)
    const textRange = document.createRange()
    textRange.selectNodeContents(b.el)
    const textWidth = Math.max(...[...textRange.getClientRects()].map((r) => r.width), 0)
    const chars = textWidth / (fs * 0.5)
    const lines = Math.round(b.r.height / (parseFloat(b.cs.lineHeight) || fs * 1.5))
    if (chars > 100 && lines >= 2) {
      const sel = selectorOf(b.el)
      if (seenMeasure.has(sel)) continue
      seenMeasure.add(sel)
      add({ check: 'long-measure', severity: 'P3', message: `Paragraph runs about ${Math.round(chars)} characters per line (aim for 45–80).`, measured: `${Math.round(b.r.width)}px wide`, selector: sel, rect: pageRect(b.r) })
    }
  }

  const scopeRect = scope.getBoundingClientRect()
  return {
    findings,
    metrics: { ...metrics, scopeWidth: Math.round(scopeRect.width), viewport: vw, documentWidth: docW, containers: containers.length },
  }
}

if (typeof module !== 'undefined') module.exports = { analyzeLayout }

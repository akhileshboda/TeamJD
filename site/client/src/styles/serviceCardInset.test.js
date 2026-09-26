// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// jsdom loads no stylesheet and computes no layout, so a rendered test cannot
// see this card's padding -- it reads 0px whether the CSS is right or wrong.
// These assertions guard the source contract instead: the section-04 card gets
// its horizontal inset from a rule keyed on the shared .service-content-block
// --readiness class, and both branches of that section carry the class.

const CSS = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8')

// A selector can head more than one rule, and can also appear as the last line
// of a grouped selector, so collect every body it heads rather than the first.
function ruleBodies(selector) {
  const needle = `${selector} {`
  const bodies = []
  let from = 0

  for (;;) {
    const at = CSS.indexOf(needle, from)
    if (at === -1) return bodies

    const before = CSS[at - 1]
    // Only count it when the selector starts a line, so `.a .b {` is not matched
    // by a search for `.b {`.
    if (before === '\n') bodies.push(CSS.slice(at + needle.length, CSS.indexOf('}', at)))
    from = at + needle.length
  }
}

const someRule = (selector, pattern) => ruleBodies(selector).some((body) => pattern.test(body))

describe('service readiness card inset', () => {
  it('defines the padding custom property on the shared section class', () => {
    expect(someRule('.service-content-block--readiness', /--service-booking-pad:/)).toBe(true)
  })

  it('does not scope the custom property to the direct-booking branch alone', () => {
    expect(someRule('.service-direct-booking', /--service-booking-pad:/)).toBe(false)
  })

  it('applies the final-placement padding via the shared section class', () => {
    const selector = '.service-content-block--readiness .service-pricing-conversion--final'

    expect(someRule(selector, /padding:[^;]*var\(--service-booking-pad\)/)).toBe(true)
  })

  it('leaves no direct-booking-only rule padding the final placement', () => {
    const selector = '.service-direct-booking .service-pricing-conversion--final'

    expect(ruleBodies(selector)).toEqual([])
  })
})

describe('service readiness card markup', () => {
  const componentSource = (relativePath) =>
    readFileSync(resolve(process.cwd(), 'src', relativePath), 'utf8')

  // Both branches used to carry the section class themselves, so this asserted the
  // string in each of them. They now share one card, which is a stronger guarantee:
  // the class is declared once and neither branch can drift off it.
  it('declares the shared section class on the card both branches render', () => {
    expect(componentSource('components/ServiceBookingCard.jsx'))
      .toContain('service-content-block--readiness')
  })

  it.each([
    ['the gated readiness branch', 'components/ServiceReadinessGate.jsx'],
    ['the direct booking branch', 'pages/ServiceDetailPage.jsx'],
  ])('routes %s through the shared card', (_label, path) => {
    expect(componentSource(path)).toContain('<ServiceBookingCard')
  })
})

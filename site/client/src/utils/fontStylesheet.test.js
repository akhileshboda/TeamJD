import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyFontStylesheet } from './fontStylesheet'

describe('font stylesheet', () => {
  it('switches the preloaded font link to a stylesheet', () => {
    document.head.innerHTML = '<link id="site-font-css" rel="preload" as="style" href="https://fonts.example/css">'
    applyFontStylesheet()
    expect(document.getElementById('site-font-css').rel).toBe('stylesheet')
  })

  it('does nothing when the link is missing', () => {
    document.head.innerHTML = ''
    expect(() => applyFontStylesheet()).not.toThrow()
  })

  // The CSP has no 'unsafe-inline' or 'unsafe-hashes' for scripts, so inline event
  // handlers in index.html would be blocked in production.
  it('index.html has no inline event handlers', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
    expect(html).not.toMatch(/\son[a-z]+\s*=/i)
  })
})

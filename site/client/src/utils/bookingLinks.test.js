// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const TEAM_JD_CALENDLY = /https:\/\/calendly\.com\/team-jd\//g

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(?:js|jsx|html)$/.test(path) ? [path] : []
  })
}

describe('global booking entry points', () => {
  it('contains no direct Team JD Calendly links in React source', () => {
    const sourceRoot = resolve(process.cwd(), 'src')
    const offenders = sourceFiles(sourceRoot).filter((path) => {
      TEAM_JD_CALENDLY.lastIndex = 0
      return TEAM_JD_CALENDLY.test(readFileSync(path, 'utf8'))
    })

    // The tests assert against URL-shaped selectors, so exclude test fixtures
    // from the product-source safety check.
    expect(offenders.filter((path) => !path.endsWith('.test.js') && !path.endsWith('.test.jsx'))).toEqual([])
  })

  it('contains no direct Team JD Calendly links in static fallback pages', () => {
    const publicRoot = resolve(process.cwd(), '../public')
    const fallbackPages = ['404.html', '500.html', '503.html', 'offline.html']
    const offenders = fallbackPages.filter((filename) => {
      TEAM_JD_CALENDLY.lastIndex = 0
      return TEAM_JD_CALENDLY.test(readFileSync(join(publicRoot, filename), 'utf8'))
    })

    expect(offenders).toEqual([])
  })

  it('keeps exactly one service-specific destination per service', () => {
    const servicesPath = resolve(process.cwd(), '../public/content/services.json')
    const services = JSON.parse(readFileSync(servicesPath, 'utf8'))

    expect(services).toHaveLength(4)
    expect(services.every((service) => service.cta_url.startsWith('https://calendly.com/team-jd/'))).toBe(true)
    expect(new Set(services.map((service) => service.slug)).size).toBe(4)
  })
})

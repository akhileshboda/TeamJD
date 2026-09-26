// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isApplicationService, resolveServiceAction } from './bookingLinks'

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

function loadServices() {
  return JSON.parse(readFileSync(resolve(process.cwd(), '../public/content/services.json'), 'utf8'))
}

describe('application destinations', () => {
  it('gives every application service a non-Calendly application URL', () => {
    const applicationServices = loadServices().filter(isApplicationService)

    expect(applicationServices.length).toBeGreaterThan(0)
    applicationServices.forEach((service) => {
      expect(service.application_url).toMatch(/^https:\/\/[a-z0-9.-]*typeform\.com\//)
      expect(service.application_url.startsWith('https://calendly.com/')).toBe(false)
      expect(service.application_cta_text).toEqual(expect.any(String))
    })
  })

  it('does not leave an application URL on a directly bookable service', () => {
    const strays = loadServices().filter(
      (service) => !isApplicationService(service) && service.application_url,
    )

    expect(strays.map((service) => service.slug)).toEqual([])
  })
})

describe('resolveServiceAction', () => {
  it('routes an application service to its Typeform, never its Calendly link', () => {
    const prep = loadServices().find((service) => service.slug === 'competition-preparation')
    const action = resolveServiceAction(prep)

    expect(action).toEqual({
      href: prep.application_url,
      label: prep.application_cta_text,
      shortLabel: 'Apply now',
      isApplication: true,
    })
    expect(action.href).not.toBe(prep.cta_url)
  })

  it('routes a directly bookable service to its Calendly link', () => {
    const coaching = loadServices().find((service) => service.slug === 'online-coaching')

    expect(resolveServiceAction(coaching)).toEqual({
      href: coaching.cta_url,
      label: coaching.cta_text,
      shortLabel: 'Book now',
      isApplication: false,
    })
  })

  it('returns a null href rather than falling back when the URL is missing', () => {
    expect(resolveServiceAction({ application_required: true }).href).toBeNull()
    expect(resolveServiceAction(undefined).href).toBeNull()
  })
})

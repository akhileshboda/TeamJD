// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const FACEBOOK_URL = 'https://www.facebook.com/p/Jake-Dedert-Team-JD-Coaching-100063678694779/'
const INSTAGRAM_URL = 'https://www.instagram.com/jake_dedert_teamjd_coaching/'
const RETIRED_INSTAGRAM_HANDLE = 'jakededert'
const LOCAL_LOGO_PATH = '/assets/branding/team-jd-logo.png'
const fallbackPages = ['404.html', '500.html', '503.html', 'offline.html']
const clientRoot = resolve(process.cwd(), 'src')
const publicRoot = resolve(process.cwd(), '../public')

function readClientSource(path) {
  return readFileSync(join(clientRoot, path), 'utf8')
}

describe('social links and resilient logos', () => {
  it('ships a committed local logo for static fallback pages', () => {
    const localLogo = join(publicRoot, 'assets', 'branding', 'team-jd-logo.png')

    expect(existsSync(localLogo)).toBe(true)
    expect(statSync(localLogo).size).toBeGreaterThan(0)

    fallbackPages.forEach((filename) => {
      const page = readFileSync(join(publicRoot, filename), 'utf8')
      expect(page).toContain(`src="${LOCAL_LOGO_PATH}"`)
      expect(page).not.toContain('/assets/generated/logo.png')
    })

    expect(readClientSource('pages/NotFound.jsx')).toContain(`src="${LOCAL_LOGO_PATH}"`)
  })

  it('keeps the React navigation and footer logos recoverable', () => {
    ;['components/Nav.jsx', 'components/Footer.jsx'].forEach((filename) => {
      const source = readClientSource(filename)
      expect(source).toContain(`const LOGO_FALLBACK = '${LOCAL_LOGO_PATH}'`)
      expect(source).toContain("resolveAsset('/api/assets/logo', LOGO_FALLBACK)")
      expect(source).toContain('onError={restoreLocalLogo}')
    })
  })

  it('keeps Facebook external and secure in every social surface', () => {
    const socialSources = [
      'components/Footer.jsx',
      'pages/Contact.jsx',
      ...fallbackPages.map((filename) => `../public/${filename}`),
    ]

    socialSources.forEach((path) => {
      const source = path.startsWith('../public/')
        ? readFileSync(resolve(process.cwd(), path), 'utf8')
        : readClientSource(path)

      expect(source).toContain(FACEBOOK_URL)
      expect(source).toContain('target="_blank"')
      expect(source).toContain('rel="noopener noreferrer"')
    })
  })

  it('uses the official Instagram profile in every social surface', () => {
    const socialSources = [
      'components/Footer.jsx',
      'pages/Contact.jsx',
      'pages/NotFound.jsx',
      ...fallbackPages.map((filename) => `../public/${filename}`),
    ]

    socialSources.forEach((path) => {
      const source = path.startsWith('../public/')
        ? readFileSync(resolve(process.cwd(), path), 'utf8')
        : readClientSource(path)

      expect(source).toContain(INSTAGRAM_URL)
      expect(source).not.toContain(`https://www.instagram.com/${RETIRED_INSTAGRAM_HANDLE}/`)
    })
  })
})

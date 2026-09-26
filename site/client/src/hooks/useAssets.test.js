import { describe, expect, it } from 'vitest'
import { resolveAsset, resolveMedia } from './useAssets'

const LOGO_FALLBACK = '/assets/branding/team-jd-logo.png'
const manifest = { assets: { logo: { url: 'https://cdn.example/logo.webp' } } }

describe('resolveAsset', () => {
  it('uses the manifest URL when the key is present', () => {
    expect(resolveAsset('/api/assets/logo', manifest, LOGO_FALLBACK)).toBe('https://cdn.example/logo.webp')
  })

  it('serves a static fallback as-is instead of re-keying it into a 404', () => {
    expect(resolveAsset('/api/assets/logo', { assets: {} }, LOGO_FALLBACK)).toBe(LOGO_FALLBACK)
  })

  it('keeps the server redirect until the manifest has loaded', () => {
    expect(resolveAsset('/api/assets/logo', null, LOGO_FALLBACK)).toBe('/api/assets/logo')
  })

  it('resolves a keyed fallback through the manifest', () => {
    expect(resolveAsset('missing', manifest, 'logo')).toBe('https://cdn.example/logo.webp')
  })
})

describe('resolveMedia', () => {
  const withSlots = {
    ...manifest,
    slots: {
      'about.portrait': { kind: 'image', url: 'https://cdn.example/new.webp', posterUrl: null, alt: 'Jake on stage' },
      'contact.reel': { kind: 'video', url: 'https://cdn.example/reel.mp4', posterUrl: 'https://cdn.example/reel.webp', alt: '' },
    },
  }

  it("uses Jake's replacement and its alt text when he has uploaded one", () => {
    expect(resolveMedia('about.portrait', withSlots, 'logo', 'Built-in alt')).toMatchObject({
      src: 'https://cdn.example/new.webp',
      alt: 'Jake on stage',
      replaced: true,
    })
  })

  it('keeps the built-in alt when a replacement has none', () => {
    expect(resolveMedia('contact.reel', withSlots, 'logo', 'Built-in alt')).toMatchObject({
      poster: 'https://cdn.example/reel.webp',
      alt: 'Built-in alt',
    })
  })

  it('falls back to the built-in asset for untouched slots and before the manifest loads', () => {
    expect(resolveMedia('home.about-photo', withSlots, 'logo', 'Alt')).toMatchObject({
      src: 'https://cdn.example/logo.webp',
      replaced: false,
      ready: true,
    })
    expect(resolveMedia('home.about-photo', null, 'logo')).toMatchObject({ replaced: false, ready: false })
  })
})

import { describe, expect, it } from 'vitest'
import { resolveAsset } from './useAssets'

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

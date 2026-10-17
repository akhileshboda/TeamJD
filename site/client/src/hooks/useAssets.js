import { useState, useEffect } from 'react'
import { usePreviewOverride } from './useContent'

const STORAGE_KEY = 'teamjd:asset-manifest'
const TTL_MS = 5 * 60 * 1000

let manifestPromise = null
let manifestResolvedAt = 0

async function fetchManifest() {
  // Expire a successful manifest after TTL so re-navigation picks up fresh assets
  if (manifestPromise && manifestResolvedAt && Date.now() - manifestResolvedAt > TTL_MS) {
    manifestPromise = null
    manifestResolvedAt = 0
  }

  if (manifestPromise) return manifestPromise

  manifestPromise = fetch('/api/assets', { cache: 'no-cache' })
    .then(async (r) => {
      if (!r.ok) {
        throw new Error(`Asset manifest request failed with ${r.status}`)
      }

      const manifest = await r.json()
      if (!manifest || typeof manifest.assets !== 'object') {
        throw new Error('Asset manifest response did not include an assets map')
      }

      return manifest
    })
    .then((manifest) => {
      manifestResolvedAt = Date.now()
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ manifest, cachedAt: Date.now() }))
      } catch (_) {}
      return manifest
    })
    .catch((err) => {
      // Reset so the next call retries rather than returning a permanently-empty manifest
      manifestPromise = null
      manifestResolvedAt = 0
      try {
        const cached = sessionStorage.getItem(STORAGE_KEY)
        if (cached) {
          const { manifest, cachedAt } = JSON.parse(cached)
          if (Date.now() - cachedAt < TTL_MS) {
            console.warn('Asset manifest unavailable, using cache.', err)
            return manifest
          }
        }
      } catch (_) {}
      console.warn('Asset manifest unavailable, falling back to routes.', err)
      return { assets: {} }
    })

  return manifestPromise
}

function getAssetKey(assetPath) {
  if (!assetPath) return ''
  const filename = assetPath.split('/').pop()
  return filename.replace(/\.[^.]+$/, '')
}

// Files Express serves straight from public/ -- a fallback pointing here must be
// used as-is, not re-keyed into /api/assets/<key>, which has no such key and 404s.
const STATIC_PATH = /^\/assets\//

// `manifest` is null until /api/assets resolves. Until then the server redirect is
// the best guess; the fallback is only chosen once the manifest proves the key absent.
export function resolveAsset(assetPath, manifest, fallbackAssetPath) {
  if (!assetPath) return ''
  if (/^(?:[a-z]+:|#|\/\/)/i.test(assetPath)) return assetPath
  const key = getAssetKey(assetPath)
  if (manifest?.assets?.[key]?.url) return manifest.assets[key].url
  if (manifest && fallbackAssetPath !== undefined) {
    if (STATIC_PATH.test(fallbackAssetPath)) return fallbackAssetPath
    return fallbackAssetPath ? resolveAsset(fallbackAssetPath, manifest) : ''
  }
  return `/api/assets/${key}`
}

function useManifest() {
  const [manifest, setManifest] = useState(null)

  useEffect(() => {
    fetchManifest().then(setManifest)
  }, [])

  return manifest
}

export function useAssets() {
  const manifest = useManifest()
  return (assetPath, fallbackAssetPath) => resolveAsset(assetPath, manifest, fallbackAssetPath)
}

// Photo and video spots: what Jake has published from the dashboard for a spot,
// otherwise the component's built-in asset and alt text. `slotId` matches
// server/services/mediaSlots.js.
export function resolveMedia(slotId, manifest, fallbackPath, fallbackAlt = '') {
  const replaced = manifest?.slots?.[slotId]
  if (replaced?.url) {
    return {
      src: replaced.url,
      poster: replaced.posterUrl || '',
      alt: replaced.alt || fallbackAlt,
      replaced: true,
      ready: true,
    }
  }
  return {
    src: resolveAsset(fallbackPath, manifest),
    poster: '',
    alt: fallbackAlt,
    replaced: false,
    ready: Boolean(manifest),
  }
}

export function useMedia() {
  const manifest = useManifest()
  // Inside the dashboard's live preview, draft spots replace the published ones.
  const previewSlots = usePreviewOverride('slots')
  const effective = previewSlots && manifest ? { ...manifest, slots: previewSlots } : manifest
  return (slotId, fallbackPath, fallbackAlt) => resolveMedia(slotId, effective, fallbackPath, fallbackAlt)
}

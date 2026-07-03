import { useState, useEffect } from 'react'

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

function resolveAsset(assetPath, manifest, fallbackAssetPath) {
  if (!assetPath) return ''
  if (/^(?:[a-z]+:|#|\/\/)/i.test(assetPath)) return assetPath
  const key = getAssetKey(assetPath)
  if (manifest?.assets?.[key]?.url) return manifest.assets[key].url
  if (fallbackAssetPath !== undefined) {
    return fallbackAssetPath ? resolveAsset(fallbackAssetPath, manifest) : ''
  }
  return `/api/assets/${key}`
}

export function useAssets() {
  const [manifest, setManifest] = useState({ assets: {} })

  useEffect(() => {
    fetchManifest().then(setManifest)
  }, [])

  return (assetPath, fallbackAssetPath) => resolveAsset(assetPath, manifest, fallbackAssetPath)
}

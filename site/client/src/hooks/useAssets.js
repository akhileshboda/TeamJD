import { useState, useEffect } from 'react'

const STORAGE_KEY = 'teamjd:asset-manifest'
const TTL_MS = 5 * 60 * 1000

let manifestPromise = null

async function fetchManifest() {
  if (manifestPromise) return manifestPromise

  manifestPromise = fetch('/api/assets/manifest', { cache: 'no-cache' })
    .then((r) => r.json())
    .then((manifest) => {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ manifest, cachedAt: Date.now() }))
      } catch (_) {}
      return manifest
    })
    .catch((err) => {
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

function resolveAsset(assetPath, manifest) {
  if (!assetPath) return ''
  if (/^(?:[a-z]+:|#|\/\/)/i.test(assetPath)) return assetPath
  const key = getAssetKey(assetPath)
  return manifest?.assets?.[key]?.url || `/api/assets/${key}`
}

export function useAssets() {
  const [manifest, setManifest] = useState({ assets: {} })

  useEffect(() => {
    fetchManifest().then(setManifest)
  }, [])

  return (assetPath) => resolveAsset(assetPath, manifest)
}

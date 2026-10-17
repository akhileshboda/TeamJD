import { useEffect, useReducer, useState } from 'react'

// Published dashboard content (GET /api/content/:collection), shared across every
// component that asks for the same collection.
//
// Inside the dashboard's live preview (any URL with ?cmsPreview) the editor posts
// draft versions of collections into this window, and they replace the published
// data until the preview closes. Messages are accepted from this origin only.

export const PREVIEW_MESSAGE = 'jd-cms-preview'
export const PREVIEW_READY = 'jd-cms-preview-ready'
const CACHE_MS = 60 * 1000

const cache = new Map()
const overrides = new Map()
const listeners = new Set()

function isPreviewWindow() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('cmsPreview')
}

if (isPreviewWindow()) {
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== PREVIEW_MESSAGE) return
    for (const [collection, items] of Object.entries(event.data.collections || {})) overrides.set(collection, items)
    listeners.forEach((notify) => notify())
  })
  window.parent?.postMessage({ type: PREVIEW_READY }, window.location.origin)
}

export function contentUrl(collection) {
  return `/api/content/${collection}`
}

function loadCollection(collection) {
  const entry = cache.get(collection)
  if (entry && Date.now() - entry.at < CACHE_MS) return entry.promise
  const promise = fetch(contentUrl(collection))
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to fetch ${collection}: ${response.status}`)
      return response.json()
    })
    .catch((error) => {
      cache.delete(collection)
      throw error
    })
  cache.set(collection, { at: Date.now(), promise })
  return promise
}

export function clearContentCache() {
  cache.clear()
  overrides.clear()
}

// Same { data, loading, error } shape as useJSON, so pages can switch over as-is.
export function useContent(collection) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [, rerender] = useReducer((count) => count + 1, 0)

  useEffect(() => {
    listeners.add(rerender)
    return () => listeners.delete(rerender)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadCollection(collection)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }))
    return () => {
      cancelled = true
    }
  }, [collection])

  return overrides.has(collection) ? { data: overrides.get(collection), loading: false, error: null } : state
}

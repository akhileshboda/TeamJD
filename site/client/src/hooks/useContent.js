import { useEffect, useReducer, useState } from 'react'

// Published dashboard content (GET /api/content/:collection), shared across every
// component that asks for the same collection.
//
// Inside the dashboard's live preview (any URL with ?cmsPreview) the editor posts
// draft versions of collections into this window, and they replace the published
// data until the preview closes. Messages are accepted from this origin only.
// A message can also name the part of the page being edited (`section`, matched
// against data-cms-section attributes), which is scrolled into view and briefly
// outlined, so Jake sees what he is changing without hunting for it.

export const PREVIEW_MESSAGE = 'jd-cms-preview'
export const PREVIEW_READY = 'jd-cms-preview-ready'
const CACHE_MS = 60 * 1000

const cache = new Map()
const overrides = new Map()
const listeners = new Set()

export function isPreviewWindow() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('cmsPreview')
}

const HIGHLIGHT_MS = 1600
let shownSection = null

// Scrolls only when the section changes (or the dashboard asks again because the
// preview just came into view), so typing never fights Jake scrolling around the
// preview himself. Waits two frames for the new content to render, and does
// nothing while the preview is hidden (no layout to scroll).
function showSection(section, again = false) {
  if (!section || (section === shownSection && !again)) return
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const target = document.querySelector(`[data-cms-section~="${CSS.escape(section)}"]`)
    if (!target || !target.getClientRects().length || !window.innerHeight) return
    shownSection = section
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fits = target.getBoundingClientRect().height < window.innerHeight * 0.8
    target.scrollIntoView({ block: fits ? 'center' : 'start', behavior: smooth ? 'smooth' : 'auto' })
    target.setAttribute('data-cms-focus', '')
    setTimeout(() => target.removeAttribute('data-cms-focus'), HIGHLIGHT_MS)
  }))
}

if (isPreviewWindow()) {
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== PREVIEW_MESSAGE) return
    for (const [collection, items] of Object.entries(event.data.collections || {})) overrides.set(collection, items)
    listeners.forEach((notify) => notify())
    showSection(event.data.section, event.data.reveal)
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

// The draft version of a public output posted by the dashboard preview, or
// undefined outside a preview.
export function usePreviewOverride(name) {
  const [, rerender] = useReducer((count) => count + 1, 0)

  useEffect(() => {
    listeners.add(rerender)
    return () => listeners.delete(rerender)
  }, [])

  return overrides.get(name)
}

// Returns { data, loading, error }, like a plain fetch hook.
export function useContent(collection) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const override = usePreviewOverride(collection)

  useEffect(() => {
    let cancelled = false
    loadCollection(collection)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }))
    return () => {
      cancelled = true
    }
  }, [collection])

  return override === undefined ? state : { data: override, loading: false, error: null }
}

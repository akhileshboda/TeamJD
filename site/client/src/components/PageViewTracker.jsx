import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const VISIT_KEY = 'teamjd:visit'

// Counts page views for the dashboard's Home screen. No cookies: a per-tab
// sessionStorage flag marks the first page of a visit, and only that page sends
// where the visitor came from. See server/services/analytics.js.
function isFirstPageOfVisit() {
  try {
    if (window.sessionStorage.getItem(VISIT_KEY)) return false
    window.sessionStorage.setItem(VISIT_KEY, '1')
    return true
  } catch {
    return false
  }
}

function send(payload) {
  const body = JSON.stringify(payload)
  try {
    if (navigator.sendBeacon?.('/api/analytics/pv', new Blob([body], { type: 'application/json' }))) return
  } catch {
    // Fall through to fetch.
  }
  fetch('/api/analytics/pv', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(() => {})
}

export default function PageViewTracker() {
  const { pathname, search } = useLocation()
  const lastPath = useRef(null)

  useEffect(() => {
    // StrictMode re-runs effects in development; one view per path change.
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    const params = new URLSearchParams(search)
    // Automated browsers and the dashboard's own previews are not visitors.
    if (navigator.webdriver || params.has('cmsPreview')) return

    const visitStart = isFirstPageOfVisit()
    send({
      path: pathname,
      visitStart,
      ...(visitStart ? { referrer: document.referrer, utmSource: params.get('utm_source') || '' } : {}),
    })
  }, [pathname, search])

  return null
}

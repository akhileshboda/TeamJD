import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { FIND_YOUR_FIT_HASH } from './FindYourFitLink'

// SPA navigation preserves scroll position by default. Reset to top on every
// pathname change so moving between pages (e.g. into a service detail page)
// always starts at the top, like a real multi-page site.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const previousLocationRef = useRef({ pathname, hash })

  useEffect(() => {
    const previousLocation = previousLocationRef.current
    previousLocationRef.current = { pathname, hash }

    if (hash === FIND_YOUR_FIT_HASH) return undefined
    if (
      previousLocation.pathname === pathname &&
      previousLocation.hash === FIND_YOUR_FIT_HASH
    ) {
      return undefined
    }

    if (!hash) {
      window.scrollTo(0, 0)
      return undefined
    }

    const scrollToTarget = () => {
      const target = document.getElementById(hash.slice(1))
      if (target) target.scrollIntoView({ block: 'start' })
    }

    const frame = requestAnimationFrame(scrollToTarget)
    const retry = window.setTimeout(scrollToTarget, 180)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(retry)
    }
  }, [pathname, hash])

  return null
}

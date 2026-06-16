import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// SPA navigation preserves scroll position by default. Reset to top on every
// pathname change so moving between pages (e.g. into a service detail page)
// always starts at the top, like a real multi-page site.
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

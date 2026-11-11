import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

const read = () => (typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches) || false

// True when the device asks for less motion. Follows the setting if it changes
// while the dashboard is open.
export default function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(read)

  useEffect(() => {
    const query = window.matchMedia?.(QUERY)
    if (!query) return undefined
    const onChange = () => setReduced(query.matches)
    onChange()
    query.addEventListener?.('change', onChange)
    return () => query.removeEventListener?.('change', onChange)
  }, [])

  return reduced
}

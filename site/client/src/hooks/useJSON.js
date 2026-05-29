import { useState, useEffect } from 'react'

export function useJSON(path) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!path) return
    let cancelled = false

    fetch(path)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`)
        return r.json()
      })
      .then((json) => { if (!cancelled) { setData(json); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false) } })

    return () => { cancelled = true }
  }, [path])

  return { data, loading, error }
}

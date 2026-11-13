import { useEffect, useState } from 'react'
import { getChangelog } from './api'

export function useChangelog() {
  const [state, setState] = useState({ entries: null, error: '' })

  useEffect(() => {
    let cancelled = false
    getChangelog()
      .then((entries) => !cancelled && setState({ entries, error: '' }))
      .catch((error) => !cancelled && setState({ entries: null, error: error.message }))
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

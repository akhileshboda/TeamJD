import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { MotionConfig, useReducedMotion as useSystemReducedMotion } from 'motion/react'

// A visitor's own "calm the site down" choice, layered over the operating system's
// reduced-motion setting. 'system' follows the OS; 'reduce' and 'full' are explicit
// choices that win over it and are remembered in this browser.
//
// The same key is read by the inline script in index.html, so the very first paint
// already carries html[data-motion="reduced"] before React loads.

export const MOTION_STORAGE_KEY = 'jd-motion'
const PREFERENCES = ['system', 'reduce', 'full']

export function readStoredPreference() {
  try {
    const value = window.localStorage.getItem(MOTION_STORAGE_KEY)
    return PREFERENCES.includes(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

function storePreference(value) {
  try {
    if (value === 'system') window.localStorage.removeItem(MOTION_STORAGE_KEY)
    else window.localStorage.setItem(MOTION_STORAGE_KEY, value)
  } catch {
    // Private windows and blocked storage: the choice still applies for this visit.
  }
}

export function resolveReduced(preference, systemReduced) {
  if (preference === 'reduce') return true
  if (preference === 'full') return false
  return Boolean(systemReduced)
}

const MotionPreferenceContext = createContext(null)

export function MotionPreferenceProvider({ children }) {
  const [preference, setPreferenceState] = useState(readStoredPreference)
  const systemReduced = useSystemReducedMotion()
  const reduced = resolveReduced(preference, systemReduced)

  useEffect(() => {
    const root = document.documentElement
    if (reduced) root.setAttribute('data-motion', 'reduced')
    else root.removeAttribute('data-motion')
  }, [reduced])

  const setPreference = useCallback((value) => {
    const next = PREFERENCES.includes(value) ? value : 'system'
    storePreference(next)
    setPreferenceState(next)
  }, [])

  // The toggle flips between calm and moving. Turning calm off when the OS asks
  // for reduced motion is an explicit opt-in to motion, so it is stored as 'full';
  // otherwise it returns to following the OS.
  const toggleReduced = useCallback(() => {
    if (reduced) setPreference(systemReduced ? 'full' : 'system')
    else setPreference('reduce')
  }, [reduced, systemReduced, setPreference])

  const value = useMemo(
    () => ({ preference, reduced, setPreference, toggleReduced }),
    [preference, reduced, setPreference, toggleReduced],
  )

  return (
    <MotionPreferenceContext.Provider value={value}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>
    </MotionPreferenceContext.Provider>
  )
}

export function useMotionPreference() {
  return useContext(MotionPreferenceContext)
}

// Drop-in replacement for motion/react's useReducedMotion that also honours the
// visitor's toggle. Outside the provider it behaves exactly like the original.
export function useReducedMotion() {
  const context = useContext(MotionPreferenceContext)
  const systemReduced = useSystemReducedMotion()
  return context ? context.reduced : Boolean(systemReduced)
}

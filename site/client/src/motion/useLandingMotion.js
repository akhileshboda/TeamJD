import { useEffect, useState } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { gsap, ScrollTrigger } from './gsap'
import { useReducedMotion } from './MotionPreference'
import { isPreviewWindow } from '../hooks/useContent'

function isCoarsePointer() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches)
}

// Whether the landing page may run its GSAP choreography at all. Off for reduced
// motion (the OS setting or the visitor's toggle) and inside the dashboard preview,
// where pinning would move the sections Jake is editing.
export function useMotionAllowed() {
  const reduced = useReducedMotion()
  return !reduced && !isPreviewWindow()
}

// Lenis smooth scrolling for the landing page only. It is created when Home mounts
// and destroyed when it unmounts, so every other page keeps native scrolling.
// Touch devices keep native scrolling too (Lenis would only add latency there).
export function useSmoothScroll(enabled) {
  const [lenis, setLenis] = useState(null)

  useEffect(() => {
    if (!enabled || isCoarsePointer()) return undefined

    const instance = new Lenis({ duration: 1.15, smoothWheel: true })
    const onTick = (time) => instance.raf(time * 1000)
    instance.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(onTick)
    gsap.ticker.lagSmoothing(0)
    setLenis(instance)

    // The Find Your Fit overlay locks the page by setting body overflow; Lenis
    // ignores that, so pause it while the lock is on.
    const syncWithBodyLock = () => {
      if (document.body.style.overflow === 'hidden') instance.stop()
      else instance.start()
    }
    const observer = new MutationObserver(syncWithBodyLock)
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] })
    syncWithBodyLock()

    return () => {
      observer.disconnect()
      gsap.ticker.remove(onTick)
      gsap.ticker.lagSmoothing(500, 33)
      instance.destroy()
      setLenis(null)
    }
  }, [enabled])

  return lenis
}

// Pins and start positions are measured when they are created; content, fonts and
// images that arrive afterwards move everything. Re-measure when they settle.
export function useRefreshOnSettle(deps) {
  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      if (!cancelled) ScrollTrigger.refresh()
    }
    const frame = requestAnimationFrame(refresh)
    document.fonts?.ready?.then(refresh)
    window.addEventListener('load', refresh)
    const pending = [...document.images].filter((img) => !img.complete)
    pending.forEach((img) => img.addEventListener('load', refresh, { once: true }))
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      window.removeEventListener('load', refresh)
      pending.forEach((img) => img.removeEventListener('load', refresh))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

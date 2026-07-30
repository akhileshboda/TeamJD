import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import { useAssets } from '../hooks/useAssets'

const LOOP_DURATION_MS = 35000

export default function ClientResultsCarousel({
  results = [],
  onOpen,
  eyebrow = 'Client Results',
  title = 'The work shows.',
  caption = 'Built with intent. Shown with confidence.',
  headingId = 'client-results-heading',
}) {
  const resolveAsset = useAssets()
  const shouldReduceMotion = useReducedMotion()
  const viewportRef = useRef(null)
  const pointerRef = useRef(null)
  const hoverPausedRef = useRef(false)
  const focusPausedRef = useRef(false)
  const interactionPausedRef = useRef(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || shouldReduceMotion) {
      setIsInView(false)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { rootMargin: '15% 0px 15% 0px' },
    )

    observer.observe(viewport)
    return () => observer.disconnect()
  }, [results.length, shouldReduceMotion])

  useEffect(() => {
    const viewport = viewportRef.current
    if (
      !viewport ||
      shouldReduceMotion ||
      isPaused ||
      !isInView ||
      results.length === 0
    ) return undefined

    let frameId
    let lastTime = performance.now()

    const animate = (now) => {
      const duplicateGroup = viewport.querySelector('[data-carousel-duplicate]')
      const loopWidth = duplicateGroup?.offsetLeft || 0
      const delta = Math.min(now - lastTime, 64)
      lastTime = now

      if (
        loopWidth > 0 &&
        !hoverPausedRef.current &&
        !viewport.matches(':hover') &&
        !focusPausedRef.current &&
        !viewport.contains(document.activeElement) &&
        !interactionPausedRef.current
      ) {
        viewport.scrollLeft += (loopWidth / LOOP_DURATION_MS) * delta
        if (viewport.scrollLeft >= loopWidth) {
          viewport.scrollLeft -= loopWidth
        }
      }

      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [isInView, isPaused, results.length, shouldReduceMotion])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || shouldReduceMotion || !isInView) return undefined

    const items = Array.from(viewport.querySelectorAll('[data-carousel-item]'))
    let frameId = null

    const updateSpotlight = () => {
      frameId = null
      const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2
      let closestItem = null
      let closestDistance = Number.POSITIVE_INFINITY

      items.forEach((item) => {
        const itemCenter = item.offsetLeft + item.offsetWidth / 2
        const distance = Math.abs(viewportCenter - itemCenter)
        if (distance < closestDistance) {
          closestItem = item
          closestDistance = distance
        }
      })

      items.forEach((item) => {
        item.classList.toggle('is-spotlighted', item === closestItem)
      })
    }

    const requestSpotlightUpdate = () => {
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(updateSpotlight)
    }

    const resizeObserver = new ResizeObserver(requestSpotlightUpdate)
    resizeObserver.observe(viewport)
    viewport.addEventListener('scroll', requestSpotlightUpdate, { passive: true })
    requestSpotlightUpdate()

    return () => {
      viewport.removeEventListener('scroll', requestSpotlightUpdate)
      resizeObserver.disconnect()
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      items.forEach((item) => item.classList.remove('is-spotlighted'))
    }
  }, [isInView, results.length, shouldReduceMotion])

  const openResult = (result, trigger) => {
    onOpen(result, trigger)
  }

  const handlePointerDown = (event) => {
    if (event.pointerType === 'touch') return
    pointerRef.current = {
      id: event.pointerId,
      x: event.clientX,
      scrollLeft: viewportRef.current.scrollLeft,
    }
    interactionPausedRef.current = true
    viewportRef.current.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (!pointerRef.current || pointerRef.current.id !== event.pointerId) return
    viewportRef.current.scrollLeft =
      pointerRef.current.scrollLeft - (event.clientX - pointerRef.current.x)
  }

  const endPointerInteraction = (event) => {
    if (!pointerRef.current || pointerRef.current.id !== event.pointerId) return
    pointerRef.current = null
    interactionPausedRef.current = false
    if (viewportRef.current.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId)
    }
  }

  const renderResult = (result, duplicate = false) => (
    <li
      key={`${duplicate ? 'duplicate' : 'primary'}-${result.id}`}
      className="client-results-item"
      data-carousel-item
      aria-hidden={duplicate || undefined}
    >
      <button
        type="button"
        className="client-result-card"
        onClick={(event) => {
          const primaryTrigger = duplicate
            ? viewportRef.current.querySelector(`[data-result-id="${result.id}"]`)
            : event.currentTarget
          openResult(result, primaryTrigger)
        }}
        tabIndex={duplicate ? -1 : 0}
        aria-label={duplicate ? undefined : `View result: ${result.caption}`}
        data-analytics-event={duplicate ? undefined : 'result_open'}
        data-analytics-location={duplicate ? undefined : 'about_carousel'}
        data-analytics-id={duplicate ? undefined : result.id}
        data-result-id={duplicate ? undefined : result.id}
      >
        <img
          src={resolveAsset(result.src)}
          alt={duplicate ? '' : result.alt}
          loading="lazy"
          decoding="async"
          width="683"
          height="1024"
        />
        <span className="client-result-card-overlay">
          <span>{result.caption}</span>
          <span aria-hidden="true">View result ↗</span>
        </span>
      </button>
    </li>
  )

  return (
    <div className="client-results-carousel">
      <div className="client-results-heading-row">
        <div className="client-results-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h2 id={headingId}>{title}</h2>
          {caption && <p className="client-results-caption">{caption}</p>}
        </div>
        <div className="client-results-actions">
          {!shouldReduceMotion && (
            <button
              type="button"
              className="carousel-toggle"
              onClick={() => setIsPaused((value) => !value)}
              aria-pressed={isPaused}
              data-analytics-event="carousel_toggle"
              data-analytics-location="about_carousel"
            >
              <span aria-hidden="true">{isPaused ? '▶' : 'Ⅱ'}</span>
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          )}
          <Link
            to="/results"
            className="client-results-link"
            data-analytics-event="results_view_all"
            data-analytics-location="about_carousel"
          >
            View all results <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      {results.length > 0 && (
        <div className={`client-results-stage${isInView ? ' is-active' : ''}`}>
          {!shouldReduceMotion && <span className="client-results-spotlight" aria-hidden="true" />}
          <div
            ref={viewportRef}
            className={`client-results-viewport${shouldReduceMotion ? ' is-reduced-motion' : ''}`}
            role="region"
            aria-label="Client results carousel"
            onMouseEnter={() => { hoverPausedRef.current = true }}
            onMouseLeave={() => { hoverPausedRef.current = false }}
            onFocusCapture={() => { focusPausedRef.current = true }}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                focusPausedRef.current = false
              }
            }}
            onTouchStart={() => { interactionPausedRef.current = true }}
            onTouchEnd={() => { interactionPausedRef.current = false }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPointerInteraction}
            onPointerCancel={endPointerInteraction}
          >
            <div className="client-results-track">
              <ul className="client-results-group">
                {results.map((result) => renderResult(result))}
              </ul>
              {!shouldReduceMotion && (
                <ul className="client-results-group" data-carousel-duplicate aria-hidden="true">
                  {results.map((result) => renderResult(result, true))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

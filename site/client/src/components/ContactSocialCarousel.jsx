import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useAssets } from '../hooks/useAssets'
import { useDragScroll } from '../hooks/useDragScroll'

const LOOP_DURATION_MS = 42000

export default function ContactSocialCarousel({ posts = [] }) {
  const resolveAsset = useAssets()
  const shouldReduceMotion = useReducedMotion()
  const viewportRef = useRef(null)
  const hoverPausedRef = useRef(false)
  const focusPausedRef = useRef(false)
  const interactionPausedRef = useRef(false)
  const dragScroll = useDragScroll(viewportRef, interactionPausedRef)
  const [isPaused, setIsPaused] = useState(false)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || shouldReduceMotion) {
      setIsInView(false)
      return undefined
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { rootMargin: '15% 0px 15% 0px' },
    )

    observer.observe(viewport)
    return () => observer.disconnect()
  }, [posts.length, shouldReduceMotion])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || shouldReduceMotion || isPaused || !isInView || posts.length === 0) {
      return undefined
    }

    let frameId
    let lastTime = performance.now()

    const animate = (now) => {
      const duplicateGroup = viewport.querySelector('[data-social-carousel-duplicate]')
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
        if (viewport.scrollLeft >= loopWidth) viewport.scrollLeft -= loopWidth
      }

      frameId = window.requestAnimationFrame(animate)
    }

    frameId = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frameId)
  }, [isInView, isPaused, posts.length, shouldReduceMotion])

  const renderPost = (post, duplicate = false) => (
    <li
      className="contact-social-carousel-item"
      data-social-carousel-item
      aria-hidden={duplicate || undefined}
      key={`${duplicate ? 'duplicate' : 'primary'}-${post.id}`}
    >
      <a
        className="contact-social-card"
        href={post.href}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={duplicate ? -1 : 0}
        aria-label={duplicate ? undefined : `View Facebook post: ${post.label}`}
      >
        <img
          src={post.src || resolveAsset(`/api/assets/${post.asset}`)}
          alt={duplicate ? '' : post.alt}
          loading="lazy"
          decoding="async"
          width="1080"
          height="1350"
        />
        <span className="contact-social-card-overlay">
          <span>{post.label}</span>
          <span>
            Facebook
            <span aria-hidden="true"> ↗</span>
          </span>
        </span>
      </a>
    </li>
  )

  if (posts.length === 0) return null

  return (
    <div className="contact-social-carousel">
      {!shouldReduceMotion && (
        <div className="contact-social-carousel-toolbar">
          <button
            type="button"
            className="carousel-toggle"
            aria-pressed={isPaused}
            onClick={() => setIsPaused((value) => !value)}
          >
            <span aria-hidden="true">{isPaused ? '▶' : 'Ⅱ'}</span>
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      )}

      <div className={`contact-social-carousel-stage${isInView ? ' is-active' : ''}`}>
        {!shouldReduceMotion && <span className="contact-social-carousel-glow" aria-hidden="true" />}
        <div
          ref={viewportRef}
          className={`contact-social-carousel-viewport${shouldReduceMotion ? ' is-reduced-motion' : ''}`}
          role="region"
          aria-roledescription="carousel"
          aria-label="Recent Team JD social posts"
          onMouseEnter={() => { hoverPausedRef.current = true }}
          onMouseLeave={() => { hoverPausedRef.current = false }}
          onFocusCapture={() => { focusPausedRef.current = true }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) focusPausedRef.current = false
          }}
          onTouchStart={() => { interactionPausedRef.current = true }}
          onTouchEnd={() => { interactionPausedRef.current = false }}
          {...dragScroll}
        >
          <div className="contact-social-carousel-track">
            <ul className="contact-social-carousel-group">
              {posts.map((post) => renderPost(post))}
            </ul>
            {!shouldReduceMotion && (
              <ul
                className="contact-social-carousel-group"
                data-social-carousel-duplicate
                aria-hidden="true"
              >
                {posts.map((post) => renderPost(post, true))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

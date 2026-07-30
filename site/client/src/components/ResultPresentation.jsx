import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import ResultMedia from './ResultMedia'
import ResultStory from './ResultStory'
import '../styles/ResultPresentation.css'

const DESKTOP_PRESENTATION_QUERY = '(min-width: 1025px)'
const GESTURE_THRESHOLD = 2
const WHEEL_SETTLE_DELAY_MS = 120
const RESTING_RATIO = 0.55

function StoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  )
}

function useDesktopPresentation() {
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia(DESKTOP_PRESENTATION_QUERY).matches
      : false
  ))

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_PRESENTATION_QUERY)
    const update = () => setIsDesktop(query.matches)
    update()
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    }
    query.addListener(update)
    return () => query.removeListener(update)
  }, [])

  return isDesktop
}

export function getStoryOverlayGeometry(frameHeight, storyHeight) {
  const safeFrameHeight = Math.max(0, frameHeight)
  const safeStoryHeight = Math.max(0, storyHeight)
  const minimumHeight = safeFrameHeight * RESTING_RATIO
  const hasOverflow = safeStoryHeight > safeFrameHeight + 1

  return {
    frameHeight: safeFrameHeight,
    storyHeight: safeStoryHeight,
    minimumHeight,
    displayHeight: hasOverflow
      ? safeFrameHeight
      : Math.min(safeFrameHeight, Math.max(minimumHeight, safeStoryHeight)),
    hasOverflow,
  }
}

function useOverflowResultOverlay({
  active,
  frameRef,
  isModal,
}) {
  const [geometry, setGeometry] = useState(() => getStoryOverlayGeometry(0, 0))
  const [scrollLocked, setScrollLocked] = useState(false)
  const overlayRef = useRef(null)
  const scrollRef = useRef(null)
  const storyMeasureRef = useRef(null)
  const geometryRef = useRef(geometry)
  const releaseTimerRef = useRef(null)
  const touchYRef = useRef(null)
  const wheelSessionRef = useRef({ active: false, direction: 0, owner: 'page' })
  const touchSessionRef = useRef({ active: false, direction: 0, owner: 'page' })

  const clearGestureOwnership = useCallback(() => {
    if (releaseTimerRef.current) {
      window.clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = null
    }
    wheelSessionRef.current = { active: false, direction: 0, owner: 'page' }
    touchSessionRef.current = { active: false, direction: 0, owner: 'page' }
    touchYRef.current = null
    setScrollLocked(false)
  }, [])

  const reset = useCallback(() => {
    clearGestureOwnership()
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [clearGestureOwnership])

  useLayoutEffect(() => {
    if (!active) {
      clearGestureOwnership()
      return undefined
    }

    const frame = frameRef.current
    const storyMeasure = storyMeasureRef.current
    if (!frame || !storyMeasure) return undefined

    const measure = () => {
      const frameHeight = frame.clientHeight || frame.getBoundingClientRect().height
      const storyHeight = (
        storyMeasure.scrollHeight
        || storyMeasure.getBoundingClientRect().height
      )
      if (frameHeight <= 0) return

      const nextGeometry = getStoryOverlayGeometry(frameHeight, storyHeight)
      geometryRef.current = nextGeometry
      setGeometry(nextGeometry)
      clearGestureOwnership()
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }

    measure()
    window.addEventListener('resize', measure)

    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    observer.observe(storyMeasure)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [active, clearGestureOwnership, frameRef])

  useEffect(() => () => clearGestureOwnership(), [clearGestureOwnership])

  useEffect(() => {
    if (!active) return undefined

    const frame = frameRef.current
    if (!frame) return undefined

    const isControlTarget = (target) => (
      target instanceof Element
      && Boolean(target.closest('button, a, input, select, textarea'))
    )

    const getScrollMetrics = () => {
      const scroll = scrollRef.current
      return {
        scroll,
        scrollTop: scroll?.scrollTop ?? 0,
        scrollMax: scroll
          ? Math.max(0, scroll.scrollHeight - scroll.clientHeight)
          : 0,
      }
    }

    const canConsume = (direction) => {
      if (!geometryRef.current.hasOverflow) return false
      const { scrollTop, scrollMax } = getScrollMetrics()
      return direction > 0 ? scrollTop < scrollMax - 1 : scrollTop > 1
    }

    const applyDelta = (deltaY) => {
      const { scroll, scrollTop, scrollMax } = getScrollMetrics()
      if (!scroll) return
      scroll.scrollTop = deltaY > 0
        ? Math.min(scrollMax, scrollTop + deltaY)
        : Math.max(0, scrollTop + deltaY)
    }

    const syncScrollLock = () => {
      const wheelLocked = (
        wheelSessionRef.current.active
        && wheelSessionRef.current.owner !== 'page'
      )
      const touchLocked = (
        touchSessionRef.current.active
        && touchSessionRef.current.owner !== 'page'
      )
      setScrollLocked(wheelLocked || touchLocked)
    }

    const claimSession = (sessionRef, direction) => {
      const owner = !geometryRef.current.hasOverflow
        ? 'page'
        : canConsume(direction)
          ? 'story'
          : isModal
            ? 'modal'
            : 'page'
      sessionRef.current = { active: true, direction, owner }
      syncScrollLock()
      return owner
    }

    const resolveSessionOwner = (sessionRef, direction) => {
      const session = sessionRef.current
      if (!session.active || session.direction !== direction) {
        return claimSession(sessionRef, direction)
      }
      return session.owner
    }

    const scheduleWheelRelease = () => {
      if (releaseTimerRef.current) window.clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = window.setTimeout(() => {
        releaseTimerRef.current = null
        wheelSessionRef.current = { active: false, direction: 0, owner: 'page' }
        syncScrollLock()
      }, WHEEL_SETTLE_DELAY_MS)
    }

    const handleWheel = (event) => {
      if (isControlTarget(event.target)) return
      const multiplier = event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? geometryRef.current.frameHeight
          : 1
      const deltaY = event.deltaY * multiplier
      if (Math.abs(deltaY) < GESTURE_THRESHOLD) return

      const owner = resolveSessionOwner(wheelSessionRef, Math.sign(deltaY))
      if (owner === 'story') applyDelta(deltaY)
      if (owner !== 'page') event.preventDefault()
      scheduleWheelRelease()
    }

    const handleTouchStart = (event) => {
      if (isControlTarget(event.target)) return
      touchYRef.current = event.touches[0]?.clientY ?? null
      touchSessionRef.current = { active: false, direction: 0, owner: 'page' }
      syncScrollLock()
    }

    const handleTouchMove = (event) => {
      if (touchYRef.current === null || isControlTarget(event.target)) return
      const currentY = event.touches[0]?.clientY
      if (currentY === undefined) return
      const deltaY = touchYRef.current - currentY
      touchYRef.current = currentY
      if (Math.abs(deltaY) < GESTURE_THRESHOLD) return

      const owner = resolveSessionOwner(touchSessionRef, Math.sign(deltaY))
      if (owner === 'story') applyDelta(deltaY)
      if (owner !== 'page') event.preventDefault()
    }

    const handleTouchEnd = () => {
      touchYRef.current = null
      touchSessionRef.current = { active: false, direction: 0, owner: 'page' }
      syncScrollLock()
    }

    frame.addEventListener('wheel', handleWheel, { passive: false })
    frame.addEventListener('touchstart', handleTouchStart, { passive: true })
    frame.addEventListener('touchmove', handleTouchMove, { passive: false })
    frame.addEventListener('touchend', handleTouchEnd)
    frame.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      frame.removeEventListener('wheel', handleWheel)
      frame.removeEventListener('touchstart', handleTouchStart)
      frame.removeEventListener('touchmove', handleTouchMove)
      frame.removeEventListener('touchend', handleTouchEnd)
      frame.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [active, frameRef, isModal])

  const handleKeyDown = useCallback((event) => {
    if (event.target !== event.currentTarget || !geometryRef.current.hasOverflow) return

    const scroll = scrollRef.current
    if (!scroll) return
    const scrollMax = Math.max(0, scroll.scrollHeight - scroll.clientHeight)
    const atTop = scroll.scrollTop <= 1
    const atBottom = scroll.scrollTop >= scrollMax - 1
    const isDownward = (
      event.key === 'ArrowDown'
      || event.key === 'PageDown'
      || (event.key === ' ' && !event.shiftKey)
    )
    const isUpward = (
      event.key === 'ArrowUp'
      || event.key === 'PageUp'
      || (event.key === ' ' && event.shiftKey)
    )

    if (isDownward && !atBottom) {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 48 : scroll.clientHeight * 0.8
      scroll.scrollTop = Math.min(scrollMax, scroll.scrollTop + step)
      return
    }

    if (isUpward && !atTop) {
      event.preventDefault()
      const step = event.key === 'ArrowUp' ? 48 : scroll.clientHeight * 0.8
      scroll.scrollTop = Math.max(0, scroll.scrollTop - step)
      return
    }

    if (event.key === 'Home' && !atTop) {
      event.preventDefault()
      scroll.scrollTop = 0
      return
    }

    if (isModal && (isDownward || isUpward || event.key === 'Home')) {
      event.preventDefault()
    }
  }, [isModal])

  return {
    height: geometry.frameHeight > 0 ? geometry.displayHeight : '55%',
    scrollMode: geometry.hasOverflow ? 'overflow' : 'fit',
    scrollLocked,
    overlayRef,
    scrollRef,
    storyMeasureRef,
    reset,
    handleKeyDown,
  }
}

export default function ResultPresentation({
  result,
  src,
  titleId,
  descriptionId,
  headingLevel = 3,
  storyOpen = true,
  onStoryOpenChange,
  allowStoryToggle = false,
  useLabeledHideControl = false,
  isModal = false,
  role = 'group',
  className = '',
  children,
}) {
  const shouldReduceMotion = useReducedMotion()
  const isDesktop = useDesktopPresentation()
  const frameRef = useRef(null)
  const effectiveStoryOpen = isDesktop ? storyOpen : true
  const canToggleStory = allowStoryToggle && isDesktop
  const {
    height,
    scrollMode,
    scrollLocked,
    overlayRef,
    scrollRef,
    storyMeasureRef,
    reset,
    handleKeyDown,
  } = useOverflowResultOverlay({
    active: effectiveStoryOpen && isDesktop,
    frameRef,
    isModal,
  })

  useEffect(() => {
    reset()
    if (!storyOpen) onStoryOpenChange?.(true)
  // Reset is keyed to the record rather than callback identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.id, reset])

  useEffect(() => {
    if (!isDesktop && !storyOpen) onStoryOpenChange?.(true)
  }, [isDesktop, onStoryOpenChange, storyOpen])

  const setStoryOpen = (nextOpen) => {
    reset()
    onStoryOpenChange?.(nextOpen)
  }

  return (
    <div
      className={`result-presentation${className ? ` ${className}` : ''}`}
      data-story-layout={isDesktop ? 'overlay' : 'docked'}
      ref={frameRef}
    >
      <ResultMedia result={result} src={src} />

      <AnimatePresence>
        {effectiveStoryOpen && isDesktop && (
          <motion.div
            key="scrim"
            className="result-preview-scrim"
            aria-hidden="true"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={shouldReduceMotion ? {} : { opacity: 1 }}
            exit={shouldReduceMotion ? {} : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {effectiveStoryOpen && (
        <motion.div
          className="result-preview-overlay"
          role={role}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          data-scroll-mode={isDesktop ? scrollMode : 'docked'}
          data-scroll-lock={scrollLocked ? 'true' : 'false'}
          tabIndex={isDesktop && scrollMode === 'overflow' ? 0 : undefined}
          ref={overlayRef}
          onKeyDown={handleKeyDown}
          style={isDesktop ? { height } : undefined}
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={shouldReduceMotion ? {} : { opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div className="result-overlay-backdrop" aria-hidden="true" />

          {canToggleStory && (
            <button
              type="button"
              className={`result-preview-close result-overlay-control${useLabeledHideControl ? ' result-preview-hide-label' : ''}`}
              aria-label="Hide result story"
              onClick={() => setStoryOpen(false)}
            >
              {useLabeledHideControl ? 'Hide Story' : <span aria-hidden="true">&times;</span>}
            </button>
          )}

          <div className="result-overlay-scroll" ref={scrollRef}>
            <div className="result-overlay-story-anchor" ref={storyMeasureRef}>
              <ResultStory
                result={result}
                titleId={titleId}
                descriptionId={descriptionId}
                headingLevel={headingLevel}
                className="result-story--presentation"
              />
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {canToggleStory && !effectiveStoryOpen && (
          <motion.button
            key="show-story"
            type="button"
            className="result-preview-reopen"
            onClick={() => setStoryOpen(true)}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <StoryIcon />
            Show Story
          </motion.button>
        )}
      </AnimatePresence>

      {children}
    </div>
  )
}

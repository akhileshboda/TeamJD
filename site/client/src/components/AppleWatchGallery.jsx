import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useAssets } from '../hooks/useAssets'
import { useJSON } from '../hooks/useJSON'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getResultStory, RESULT_CATEGORY_LABELS } from '../utils/resultsLibrary'
import ResultStory from './ResultStory'
import SectionReveal from './SectionReveal'
import '../styles/AppleWatchGallery.css'

const CATEGORY_ORDER = ['all', 'competition', 'online', 'posing', 'lifestyle', 'training']
const DESKTOP_ICON_SIZE_PX = 70
const MOBILE_ICON_SIZE_PX = 62
const FOCUS_REGION_RATIO = 0.75
const OVERLAY_GESTURE_THRESHOLD = 2
const OVERLAY_SETTLE_DELAY_MS = 120
const OVERLAY_RESTING_RATIO = 0.55
const DESKTOP_MAGNIFICATION = { peak: 1.45, edge: 0.72 }
const MOBILE_MAGNIFICATION = { peak: 1.3, edge: 0.8 }

export function getGalleryIconSize(viewportWidth) {
  return viewportWidth > 0 && viewportWidth <= 480
    ? MOBILE_ICON_SIZE_PX
    : DESKTOP_ICON_SIZE_PX
}

function smoothstep(value) {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped * clamped * (3 - 2 * clamped)
}

export function getGalleryMagnificationScale({
  iconX,
  iconY,
  viewportWidth,
  viewportHeight,
  isMobile = false,
  reducedMotion = false,
}) {
  if (reducedMotion || viewportWidth <= 0 || viewportHeight <= 0) return 1

  const normalizedX = (iconX - viewportWidth / 2) / (viewportWidth / 2)
  const normalizedY = (iconY - viewportHeight / 2) / (viewportHeight / 2)
  const distance = Math.hypot(normalizedX, normalizedY)
  const profile = isMobile ? MOBILE_MAGNIFICATION : DESKTOP_MAGNIFICATION

  if (distance <= FOCUS_REGION_RATIO) {
    const focusProgress = smoothstep(distance / FOCUS_REGION_RATIO)
    return profile.peak + (1 - profile.peak) * focusProgress
  }

  const edgeProgress = smoothstep(
    (distance - FOCUS_REGION_RATIO) / (1 - FOCUS_REGION_RATIO),
  )
  return 1 + (profile.edge - 1) * edgeProgress
}

export function getPanGeometry(canvasSize, viewportSize) {
  const hasViewport = viewportSize.width > 0 && viewportSize.height > 0
  const overflowX = hasViewport ? Math.max(0, canvasSize.width - viewportSize.width) : 0
  const overflowY = hasViewport ? Math.max(0, canvasSize.height - viewportSize.height) : 0

  return {
    overflowX,
    overflowY,
    canPan: overflowX > 1 || overflowY > 1,
    constraints: {
      left: -overflowX,
      right: 0,
      top: -overflowY,
      bottom: 0,
    },
    initial: {
      x: -overflowX / 2,
      y: -overflowY / 2,
    },
  }
}

function honeycombLayout(count, spacing = 96) {
  if (count <= 0) return []

  const cells = [{ q: 0, r: 0, ring: 0 }]
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]

  for (let ring = 1; cells.length < count; ring += 1) {
    let q = -ring
    let r = ring

    for (let side = 0; side < 6; side += 1) {
      for (let step = 0; step < ring && cells.length < count; step += 1) {
        cells.push({ q, r, ring })
        q += dirs[side][0]
        r += dirs[side][1]
      }
    }
  }

  return cells.map(({ q, r, ring }, index) => ({
    x: spacing * (q + r / 2),
    y: spacing * 0.866 * r,
    ring,
    index,
  }))
}

function resolveItemSrc(item, resolveAsset) {
  return item?.src ? resolveAsset(item.src) : ''
}

function displayTitle(item) {
  return getResultStory(item).title
}

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

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 5.75A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.4 17.4 0 0 1-2.4 3.1" />
      <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" />
      <path d="M6.6 6.6C4.1 8.35 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.8 9.8 0 0 0 4.8-1.3" />
      <path d="m3 3 18 18" />
    </svg>
  )
}

export function getStoryOverlayGeometry(frameHeight, storyHeight) {
  const safeFrameHeight = Math.max(0, frameHeight)
  const safeStoryHeight = Math.max(0, storyHeight)
  const minimumHeight = safeFrameHeight * OVERLAY_RESTING_RATIO
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

function useOverflowResultOverlay({ active = true, isModal = false } = {}) {
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

    const overlay = overlayRef.current
    const storyMeasure = storyMeasureRef.current
    const frame = overlay?.closest('.result-preview')
    if (!overlay || !storyMeasure || !frame) return undefined

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
  }, [active, clearGestureOwnership])

  useEffect(() => {
    return () => clearGestureOwnership()
  }, [clearGestureOwnership])

  useEffect(() => {
    if (!active) return undefined

    const overlay = overlayRef.current
    const frame = overlay?.closest('.result-preview')
    if (!overlay || !frame) return undefined

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
      }, OVERLAY_SETTLE_DELAY_MS)
    }

    const handleWheel = (event) => {
      if (isControlTarget(event.target)) return
      const currentGeometry = geometryRef.current
      const multiplier = event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? currentGeometry.frameHeight
          : 1
      const deltaY = event.deltaY * multiplier
      if (Math.abs(deltaY) < OVERLAY_GESTURE_THRESHOLD) return

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
      if (Math.abs(deltaY) < OVERLAY_GESTURE_THRESHOLD) return

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
  }, [active, isModal])

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

function WatchGridItem({
  item,
  src,
  left,
  top,
  sizePx,
  isActive,
  isMobile,
  shouldReduce,
  canvasX,
  canvasY,
  viewportSize,
  index,
  onClick,
}) {
  const magnificationScale = useTransform(
    [canvasX, canvasY],
    ([offsetX, offsetY]) => getGalleryMagnificationScale({
      iconX: left + offsetX,
      iconY: top + offsetY,
      viewportWidth: viewportSize.w,
      viewportHeight: viewportSize.h,
      isMobile,
      reducedMotion: shouldReduce,
    }),
  )
  const magnificationZIndex = useTransform(
    magnificationScale,
    (scale) => Math.round(scale * 100),
  )

  return (
    <motion.div
      className={`watch-grid-item-shell ${isActive ? 'is-active' : ''}`}
      style={{
        left: `${left - sizePx / 2}px`,
        top: `${top - sizePx / 2}px`,
        width: sizePx,
        height: sizePx,
        scale: magnificationScale,
        zIndex: magnificationZIndex,
      }}
    >
      <motion.button
        type="button"
        className={`watch-grid-item ${isActive ? 'active' : ''}`}
        data-category={item.category}
        onClick={() => onClick(item)}
        aria-label={`Open result: ${displayTitle(item)}`}
        aria-pressed={isActive}
        initial={shouldReduce ? false : { opacity: 0, scale: 0.48 }}
        animate={shouldReduce ? {} : { opacity: 1, scale: 1 }}
        exit={shouldReduce ? {} : { opacity: 0, scale: 0.58 }}
        transition={{ duration: 0.34, ease: 'easeOut', delay: Math.min(index * 0.025, 0.25) }}
        whileHover={shouldReduce ? {} : { scale: 1.1 }}
        whileTap={shouldReduce ? {} : { scale: 0.96 }}
      >
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
      </motion.button>
    </motion.div>
  )
}

function ResultPreview({ item, src, open, onClose, onReopen, previewRef }) {
  const shouldReduce = useReducedMotion()
  const {
    height,
    scrollMode,
    scrollLocked,
    overlayRef,
    scrollRef,
    storyMeasureRef,
    reset,
    handleKeyDown,
  } = useOverflowResultOverlay({ active: open })
  if (!item) return null

  const titleId = `result-preview-title-${item.id}`

  const closeDetails = () => {
    reset()
    onClose()
  }

  const reopenDetails = () => {
    reset()
    onReopen()
  }

  return (
    <section
      className="result-preview"
      aria-label={`Selected result: ${displayTitle(item)}`}
      ref={previewRef}
    >
      <div className="result-preview-media">
        <AnimatePresence initial={false}>
          <motion.img
            key={item.id}
            className="result-preview-img"
            src={src}
            alt={item.alt}
            loading="eager"
            decoding="async"
            draggable={false}
            initial={shouldReduce ? false : { opacity: 0, scale: 1.05 }}
            animate={shouldReduce ? {} : { opacity: 1, scale: 1 }}
            exit={shouldReduce ? {} : { opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            className="result-preview-scrim"
            aria-hidden="true"
            initial={shouldReduce ? false : { opacity: 0 }}
            animate={shouldReduce ? {} : { opacity: 1 }}
            exit={shouldReduce ? {} : { opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            className="result-preview-overlay"
            role="group"
            aria-labelledby={titleId}
            data-scroll-mode={scrollMode}
            data-scroll-lock={scrollLocked ? 'true' : 'false'}
            tabIndex={scrollMode === 'overflow' ? 0 : undefined}
            ref={overlayRef}
            onKeyDown={handleKeyDown}
            style={{ height }}
          >
            <div className="result-overlay-backdrop" aria-hidden="true" />

            <button
              type="button"
              className="result-preview-close result-overlay-control"
              aria-label="Dismiss result details"
              onClick={closeDetails}
            >
              &times;
            </button>

            <div className="result-overlay-scroll" ref={scrollRef}>
              <div className="result-overlay-story-anchor" ref={storyMeasureRef}>
                <ResultStory
                  result={item}
                  titleId={titleId}
                  headingLevel={3}
                  className="result-story--overlay"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!open && (
          <motion.button
            key="reopen"
            type="button"
            className="result-preview-reopen"
            onClick={reopenDetails}
            initial={shouldReduce ? false : { opacity: 0, y: 10 }}
            animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
            exit={shouldReduce ? {} : { opacity: 0, y: 10 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <StoryIcon />
            Show Story
          </motion.button>
        )}
      </AnimatePresence>
    </section>
  )
}

function ResultModal({ item, src, open, onClose }) {
  const shouldReduce = useReducedMotion()
  const [detailsOpen, setDetailsOpen] = useState(true)
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
    active: detailsOpen,
    isModal: true,
  })

  useEffect(() => {
    if (item?.id) setDetailsOpen(true)
  }, [item?.id])

  if (!open || !item) return null

  const titleId = `result-modal-title-${item.id}`

  const backdropMotion = shouldReduce
    ? { initial: false, animate: {}, exit: {} }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.24, ease: 'easeOut' },
      }

  const dialogMotion = shouldReduce
    ? { initial: false, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, y: 28, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 18, scale: 0.98 },
        transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      }

  return (
    <motion.div
      className="result-modal-backdrop"
      onClick={onClose}
      {...backdropMotion}
    >
      <motion.section
        className="result-modal-dialog result-preview result-preview--modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        {...dialogMotion}
      >
        <div className="result-preview-media">
          <motion.img
            key={item.id}
            className="result-preview-img"
            src={src}
            alt={item.alt}
            loading="eager"
            decoding="async"
            draggable={false}
            initial={shouldReduce ? false : { opacity: 0, scale: 1.04 }}
            animate={shouldReduce ? {} : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        </div>

        <AnimatePresence>
          {detailsOpen && (
            <motion.div
              key="modal-scrim"
              className="result-preview-scrim"
              aria-hidden="true"
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={shouldReduce ? {} : { opacity: 1 }}
              exit={shouldReduce ? {} : { opacity: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        <button
          type="button"
          className="result-preview-close"
          aria-label="Close result details"
          onClick={onClose}
        >
          &times;
        </button>

        <AnimatePresence>
          {detailsOpen && (
            <motion.div
              key="modal-overlay"
              className="result-preview-overlay"
              role="document"
              aria-labelledby={titleId}
              data-scroll-mode={scrollMode}
              data-scroll-lock={scrollLocked ? 'true' : 'false'}
              tabIndex={scrollMode === 'overflow' ? 0 : undefined}
              ref={overlayRef}
              onKeyDown={handleKeyDown}
              style={{ height }}
            >
              <div className="result-overlay-backdrop" aria-hidden="true" />

              <button
                type="button"
                className="result-preview-hide result-overlay-control"
                aria-label="Hide result details"
                onClick={() => {
                  reset()
                  setDetailsOpen(false)
                }}
              >
                <EyeOffIcon />
                <span>Hide</span>
              </button>

              <div className="result-overlay-scroll" ref={scrollRef}>
                <div className="result-overlay-story-anchor" ref={storyMeasureRef}>
                  <ResultStory
                    result={item}
                    titleId={titleId}
                    headingLevel={3}
                    className="result-story--overlay"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!detailsOpen && (
            <motion.button
              key="modal-reopen"
              type="button"
              className="result-preview-reopen result-preview-reopen--modal"
              aria-label="Show result details"
              onClick={() => {
                reset()
                setDetailsOpen(true)
              }}
              initial={shouldReduce ? false : { opacity: 0, y: 10 }}
              animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
              exit={shouldReduce ? {} : { opacity: 0, y: 10 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
            >
              <EyeIcon />
              Show
            </motion.button>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  )
}

export default function AppleWatchGallery() {
  const { data: results } = useJSON('/content/results-library.json')
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()
  const viewportRef = useRef(null)
  const previewRef = useRef(null)
  const canvasX = useMotionValue(0)
  const canvasY = useMotionValue(0)

  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedItem, setSelectedItem] = useState(null)
  const [overlayOpen, setOverlayOpen] = useState(true)
  const [mobileModalOpen, setMobileModalOpen] = useState(false)
  const [isPhoneResultsLayout, setIsPhoneResultsLayout] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 768px)').matches
      : false
  ))
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })

  const enrichedItems = useMemo(() => {
    return [...(results || [])]
      .sort((left, right) => left.order - right.order)
  }, [results])

  const categories = useMemo(() => {
    const available = new Set(enrichedItems.map((item) => item.category))
    return CATEGORY_ORDER.filter((category) => category === 'all' || available.has(category))
  }, [enrichedItems])

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return enrichedItems
    return enrichedItems.filter((item) => item.category === activeFilter)
  }, [activeFilter, enrichedItems])

  const iconSizePx = getGalleryIconSize(viewportSize.w)

  const canvas = useMemo(() => {
    const spacing = viewportSize.w > 0 && viewportSize.w <= 480 ? 78 : 104
    const rawPositions = honeycombLayout(filteredItems.length, spacing)

    if (rawPositions.length === 0) {
      return { positions: [], width: 0, height: 0 }
    }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    rawPositions.forEach((position) => {
      const half = iconSizePx / 2
      minX = Math.min(minX, position.x - half)
      maxX = Math.max(maxX, position.x + half)
      minY = Math.min(minY, position.y - half)
      maxY = Math.max(maxY, position.y + half)
    })

    const pad = viewportSize.w > 0 && viewportSize.w <= 480 ? 34 : 58
    const clusterWidth = maxX - minX
    const clusterHeight = maxY - minY
    const shouldExplore = filteredItems.length > 8
    const panSlackX = shouldExplore && viewportSize.w ? Math.min(260, Math.max(120, viewportSize.w * 0.16)) : 0
    const panSlackY = shouldExplore && viewportSize.h ? Math.min(200, Math.max(100, viewportSize.h * 0.15)) : 0
    const width = Math.max(clusterWidth + pad * 2, viewportSize.w ? viewportSize.w + panSlackX : clusterWidth + pad * 2)
    const height = Math.max(clusterHeight + pad * 2, viewportSize.h ? viewportSize.h + panSlackY : clusterHeight + pad * 2)
    const offsetX = (width - clusterWidth) / 2 - minX
    const offsetY = (height - clusterHeight) / 2 - minY
    const positions = rawPositions.map((position) => ({
      ...position,
      x: position.x + offsetX,
      y: position.y + offsetY,
    }))

    return { positions, width, height }
  }, [filteredItems.length, iconSizePx, viewportSize.h, viewportSize.w])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return undefined

    const update = () => setViewportSize({ w: el.clientWidth, h: el.clientHeight })
    update()

    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const query = window.matchMedia('(max-width: 768px)')
    const update = () => setIsPhoneResultsLayout(query.matches)
    update()

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    }

    query.addListener(update)
    return () => query.removeListener(update)
  }, [])

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedItem(null)
      return
    }

    if (!selectedItem || !filteredItems.some((item) => item.id === selectedItem.id)) {
      setSelectedItem(filteredItems[0])
    }
  }, [filteredItems, selectedItem])

  // Re-open the overlay whenever the selected result changes.
  useEffect(() => {
    if (selectedItem?.id) setOverlayOpen(true)
  }, [selectedItem?.id])

  useEffect(() => {
    if (!isPhoneResultsLayout) setMobileModalOpen(false)
  }, [isPhoneResultsLayout])

  useEffect(() => {
    if (!isPhoneResultsLayout || !mobileModalOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMobileModalOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPhoneResultsLayout, mobileModalOpen])

  useEffect(() => {
    const el = viewportRef.current
    if (!el || !shouldReduce) return
    el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
    el.scrollTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2)
  }, [activeFilter, canvas.height, canvas.width, shouldReduce])

  const panGeometry = getPanGeometry(
    { width: canvas.width, height: canvas.height },
    { width: viewportSize.w, height: viewportSize.h },
  )
  const canPan = !shouldReduce && panGeometry.canPan

  useEffect(() => {
    if (shouldReduce) return
    canvasX.set(panGeometry.initial.x)
    canvasY.set(panGeometry.initial.y)
  }, [
    activeFilter,
    canvas.height,
    canvas.width,
    canvasX,
    canvasY,
    panGeometry.initial.x,
    panGeometry.initial.y,
    shouldReduce,
  ])

  // The draggable canvas sets `touch-action: none`, which makes trackpad/wheel
  // gestures over the frame stop scrolling the page. Forward wheel deltas to the
  // window so the user is never trapped inside the honeycomb while scrolling.
  useEffect(() => {
    const el = viewportRef.current
    if (!el || !canPan) return undefined
    const handleWheel = (event) => {
      window.scrollBy({ top: event.deltaY, left: 0, behavior: 'instant' })
    }
    el.addEventListener('wheel', handleWheel, { passive: true })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [canPan])

  const handleFilterChange = useCallback((filter) => {
    setActiveFilter(filter)
  }, [])

  const handleOpen = useCallback((item) => {
    setSelectedItem(item)
    setOverlayOpen(true)
    if (isPhoneResultsLayout) {
      setMobileModalOpen(true)
      return
    }

    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches) {
      previewRef.current?.scrollIntoView({
        behavior: shouldReduce ? 'auto' : 'smooth',
        block: 'nearest',
      })
    }
  }, [isPhoneResultsLayout, shouldReduce])

  const previewSrc = selectedItem ? resolveItemSrc(selectedItem, resolveAsset) : ''

  return (
    <>
      <section
        className="section home-section results-gallery-section"
        aria-labelledby="results-heading"
      >
        <div className="container">
          <SectionReveal>
            <div className="results-header">
              <span className="eyebrow">Real Results</span>
              <h2 id="results-heading">
                Clients<br />Who Showed Up.
              </h2>
              <p>
                Browse the proof in motion. Tap a client to inspect the result, the story,
                and the kind of coaching behind it.
              </p>
            </div>
          </SectionReveal>

          <div className="results-filter-bar" aria-label="Filter results by service">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`results-filter-pill ${activeFilter === category ? 'active' : ''}`}
                onClick={() => handleFilterChange(category)}
                aria-pressed={activeFilter === category}
              >
                {category === 'all' ? 'All Results' : RESULT_CATEGORY_LABELS[category] || category}
              </button>
            ))}
          </div>

          <div className="results-gallery-grid">
            <div className="results-browser">
              <div
                className={`watch-grid-viewport ${shouldReduce ? 'watch-grid-viewport--scroll' : ''} ${canPan ? 'watch-grid-viewport--pannable' : ''}`}
                ref={viewportRef}
              >
                {filteredItems.length > 0 ? (
                  <motion.div
                    key={activeFilter}
                    className="watch-grid-canvas"
                    style={shouldReduce ? { width: canvas.width, height: canvas.height } : { width: canvas.width, height: canvas.height, x: canvasX, y: canvasY }}
                    drag={canPan}
                    dragConstraints={panGeometry.constraints}
                    dragElastic={0.08}
                    dragMomentum={false}
                    initial={shouldReduce ? false : { opacity: 0, scale: 0.98 }}
                    animate={shouldReduce ? {} : { opacity: 1, scale: 1 }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                  >
                    <AnimatePresence>
                      {filteredItems.map((item, index) => {
                        const position = canvas.positions[index]

                        return (
                          <WatchGridItem
                            key={item.id}
                            item={item}
                            src={resolveItemSrc(item, resolveAsset)}
                            left={position.x}
                            top={position.y}
                            sizePx={iconSizePx}
                            isActive={selectedItem?.id === item.id}
                            isMobile={isPhoneResultsLayout}
                            shouldReduce={shouldReduce}
                            canvasX={canvasX}
                            canvasY={canvasY}
                            viewportSize={viewportSize}
                            index={index}
                            onClick={handleOpen}
                          />
                        )
                      })}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <p className="watch-grid-empty">No results in this category yet.</p>
                )}
              </div>
            </div>

            {selectedItem && !isPhoneResultsLayout && (
              <ResultPreview
                key={selectedItem.id}
                item={selectedItem}
                src={previewSrc}
                open={overlayOpen}
                onClose={() => setOverlayOpen(false)}
                onReopen={() => setOverlayOpen(true)}
                previewRef={previewRef}
              />
            )}
          </div>

          <div className="results-cta-wrap">
            <Link to="/results" className="btn btn-outline">
              View All Results &rarr;
            </Link>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selectedItem && isPhoneResultsLayout && mobileModalOpen && (
          <ResultModal
            key={selectedItem.id}
            item={selectedItem}
            src={previewSrc}
            open={mobileModalOpen}
            onClose={() => setMobileModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

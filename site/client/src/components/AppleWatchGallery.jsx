import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useAssets } from '../hooks/useAssets'
import { useJSON } from '../hooks/useJSON'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { getResultStory, RESULT_CATEGORY_LABELS } from '../utils/resultsLibrary'
import ResultPresentation from './ResultPresentation'
import SectionReveal from './SectionReveal'
import '../styles/AppleWatchGallery.css'

const CATEGORY_ORDER = ['all', 'competition', 'online', 'posing', 'lifestyle', 'training']
const DESKTOP_ICON_SIZE_PX = 70
const MOBILE_ICON_SIZE_PX = 62
const FOCUS_REGION_RATIO = 0.75
const DESKTOP_MAGNIFICATION = { peak: 1.45, edge: 0.72 }
const MOBILE_MAGNIFICATION = { peak: 1.3, edge: 0.8 }
const FINE_POINTER_QUERY = '(pointer: fine)'
const HOVER_QUERY = '(hover: hover)'
const COARSE_POINTER_QUERY = '(any-pointer: coarse)'
const RESULT_MODAL_FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function canUseEnhancedGalleryDrag({
  brands = [],
  finePointer = false,
  hover = false,
  coarsePointer = false,
  pointerEvents = false,
  resizeObserver = false,
} = {}) {
  const isChromium = brands.some((entry) => {
    const brand = typeof entry === 'string' ? entry : entry?.brand
    return typeof brand === 'string' && brand.toLowerCase() === 'chromium'
  })

  return (
    isChromium
    && finePointer
    && hover
    && !coarsePointer
    && pointerEvents
    && resizeObserver
  )
}

function readEnhancedGallerySupport({
  finePointerQuery,
  hoverQuery,
  coarsePointerQuery,
} = {}) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false

  const fine = finePointerQuery || window.matchMedia(FINE_POINTER_QUERY)
  const canHover = hoverQuery || window.matchMedia(HOVER_QUERY)
  const coarse = coarsePointerQuery || window.matchMedia(COARSE_POINTER_QUERY)

  return canUseEnhancedGalleryDrag({
    brands: navigator.userAgentData?.brands,
    finePointer: fine.matches,
    hover: canHover.matches,
    coarsePointer: coarse.matches,
    pointerEvents: typeof window.PointerEvent === 'function',
    resizeObserver: typeof ResizeObserver !== 'undefined',
  })
}

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

export function centerGalleryViewport(viewport) {
  if (!viewport) return
  viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2)
  viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2)
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

function StaticWatchGridItem({
  item,
  src,
  left,
  top,
  sizePx,
  isActive,
  onClick,
}) {
  return (
    <div
      className={`watch-grid-item-shell ${isActive ? 'is-active' : ''}`}
      data-gallery-renderer="native"
      style={{
        left: `${left - sizePx / 2}px`,
        top: `${top - sizePx / 2}px`,
        width: sizePx,
        height: sizePx,
      }}
    >
      <button
        type="button"
        className={`watch-grid-item ${isActive ? 'active' : ''}`}
        data-category={item.category}
        onClick={() => onClick(item)}
        aria-label={`Open result: ${displayTitle(item)}`}
        aria-pressed={isActive}
      >
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
      </button>
    </div>
  )
}

function MotionWatchGridItem({
  item,
  src,
  left,
  top,
  sizePx,
  isActive,
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
      reducedMotion: false,
    }),
  )
  const magnificationZIndex = useTransform(
    magnificationScale,
    (scale) => Math.round(scale * 100),
  )

  return (
    <motion.div
      className={`watch-grid-item-shell ${isActive ? 'is-active' : ''}`}
      data-gallery-renderer="enhanced"
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
        initial={{ opacity: 0, scale: 0.48 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.58 }}
        transition={{ duration: 0.34, ease: 'easeOut', delay: Math.min(index * 0.025, 0.25) }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.96 }}
      >
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
      </motion.button>
    </motion.div>
  )
}

function WatchGridItem({ enhanced, ...props }) {
  return enhanced
    ? <MotionWatchGridItem {...props} />
    : <StaticWatchGridItem {...props} />
}

function ResultPreview({ item, src, open, onClose, onReopen, previewRef }) {
  if (!item) return null

  const titleId = `result-preview-title-${item.id}`

  return (
    <section
      className="result-preview"
      aria-label={`Selected result: ${displayTitle(item)}`}
      ref={previewRef}
    >
      <ResultPresentation
        result={item}
        src={src}
        titleId={titleId}
        storyLayout="bounded"
        storyOpen={open}
        onStoryOpenChange={(nextOpen) => {
          if (nextOpen) onReopen()
          else onClose()
        }}
        allowStoryToggle
      />
    </section>
  )
}

function ResultModal({ item, src, open, onClose }) {
  const shouldReduce = useReducedMotion()
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const storyScroller = dialogRef.current?.querySelector('.result-overlay-scroll')
    if (storyScroller) storyScroller.scrollTop = 0
  }, [item?.id, open])

  useEffect(() => {
    if (!open) return undefined

    const handleTabKey = (event) => {
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll(RESULT_MODAL_FOCUSABLE) || [],
      )
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleTabKey)
    return () => window.removeEventListener('keydown', handleTabKey)
  }, [open])

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

  return createPortal(
    <motion.div
      className="result-modal-backdrop"
      onClick={onClose}
      {...backdropMotion}
    >
      <motion.section
        ref={dialogRef}
        className="result-modal-dialog result-preview result-preview--modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        {...dialogMotion}
      >
        <ResultPresentation
          result={item}
          src={src}
          titleId={titleId}
          role="document"
          isModal
          storyLayout="bounded"
          storyAction={(
            <button
              type="button"
              className="result-modal-close result-preview-close"
              aria-label="Close result details"
              onClick={onClose}
              autoFocus
            >
              &times;
            </button>
          )}
        />
      </motion.section>
    </motion.div>,
    document.body,
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
  const [galleryHintDismissed, setGalleryHintDismissed] = useState(false)
  const [isPhoneResultsLayout, setIsPhoneResultsLayout] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 768px)').matches
      : false
  ))
  const [isDesktopResultsLayout, setIsDesktopResultsLayout] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1025px)').matches
      : false
  ))
  const [enhancedGalleryDrag, setEnhancedGalleryDrag] = useState(
    () => readEnhancedGallerySupport(),
  )
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })
  const useNativeGalleryScroll = (
    isPhoneResultsLayout
    || shouldReduce
    || !enhancedGalleryDrag
  )

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
    if (typeof window === 'undefined') return undefined

    const query = window.matchMedia('(min-width: 1025px)')
    const update = () => setIsDesktopResultsLayout(query.matches)
    update()

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    }

    query.addListener(update)
    return () => query.removeListener(update)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setEnhancedGalleryDrag(false)
      return undefined
    }

    const finePointerQuery = window.matchMedia(FINE_POINTER_QUERY)
    const hoverQuery = window.matchMedia(HOVER_QUERY)
    const coarsePointerQuery = window.matchMedia(COARSE_POINTER_QUERY)
    const queries = [finePointerQuery, hoverQuery, coarsePointerQuery]
    const update = () => {
      setEnhancedGalleryDrag(readEnhancedGallerySupport({
        finePointerQuery,
        hoverQuery,
        coarsePointerQuery,
      }))
    }

    update()
    queries.forEach((query) => {
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', update)
      } else {
        query.addListener(update)
      }
    })

    return () => {
      queries.forEach((query) => {
        if (typeof query.removeEventListener === 'function') {
          query.removeEventListener('change', update)
        } else {
          query.removeListener(update)
        }
      })
    }
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (
      !viewport
      || !useNativeGalleryScroll
      || typeof IntersectionObserver === 'undefined'
    ) return undefined

    const candidates = new Map()
    let focusedShell = null

    const updateFocusedShell = (rootBounds) => {
      const centerX = rootBounds
        ? rootBounds.left + rootBounds.width / 2
        : viewport.getBoundingClientRect().left + viewport.clientWidth / 2
      const centerY = rootBounds
        ? rootBounds.top + rootBounds.height / 2
        : viewport.getBoundingClientRect().top + viewport.clientHeight / 2

      let nextFocusedShell = null
      let closestDistance = Number.POSITIVE_INFINITY

      candidates.forEach((entry, shell) => {
        const rect = entry.boundingClientRect
        const distance = Math.hypot(
          rect.left + rect.width / 2 - centerX,
          rect.top + rect.height / 2 - centerY,
        )
        if (distance < closestDistance) {
          closestDistance = distance
          nextFocusedShell = shell
        }
      })

      if (focusedShell === nextFocusedShell) return
      focusedShell?.classList.remove('is-native-focus')
      nextFocusedShell?.classList.add('is-native-focus')
      focusedShell = nextFocusedShell
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) candidates.set(entry.target, entry)
        else candidates.delete(entry.target)
      })
      updateFocusedShell(entries[0]?.rootBounds)
    }, {
      root: viewport,
      rootMargin: '-34% -34% -34% -34%',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    })

    const shells = viewport.querySelectorAll('.watch-grid-item-shell')
    shells.forEach((shell) => observer.observe(shell))

    return () => {
      observer.disconnect()
      focusedShell?.classList.remove('is-native-focus')
      candidates.clear()
    }
  }, [activeFilter, filteredItems.length, useNativeGalleryScroll])

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
    const viewport = viewportRef.current
    if (!viewport || !useNativeGalleryScroll) return undefined

    centerGalleryViewport(viewport)
    const frameId = window.requestAnimationFrame(() => centerGalleryViewport(viewport))
    return () => window.cancelAnimationFrame(frameId)
  }, [activeFilter, canvas.height, canvas.width, useNativeGalleryScroll])

  const panGeometry = getPanGeometry(
    { width: canvas.width, height: canvas.height },
    { width: viewportSize.w, height: viewportSize.h },
  )
  const canPan = !useNativeGalleryScroll && panGeometry.canPan
  const showGalleryHint = (
    isDesktopResultsLayout
    && panGeometry.canPan
    && !galleryHintDismissed
  )

  useEffect(() => {
    if (useNativeGalleryScroll) return
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
    useNativeGalleryScroll,
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

  const dismissGalleryHint = useCallback(() => {
    setGalleryHintDismissed(true)
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
  const galleryItems = filteredItems.map((item, index) => {
    const position = canvas.positions[index]

    return (
      <WatchGridItem
        key={item.id}
        enhanced={!useNativeGalleryScroll}
        item={item}
        src={resolveItemSrc(item, resolveAsset)}
        left={position.x}
        top={position.y}
        sizePx={iconSizePx}
        isActive={selectedItem?.id === item.id}
        canvasX={canvasX}
        canvasY={canvasY}
        viewportSize={viewportSize}
        index={index}
        onClick={handleOpen}
      />
    )
  })

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
                className={`watch-grid-viewport ${useNativeGalleryScroll ? 'watch-grid-viewport--scroll' : ''} ${canPan ? 'watch-grid-viewport--pannable' : ''}`}
                ref={viewportRef}
                role="region"
                aria-label="Client results gallery"
                aria-describedby={showGalleryHint ? 'watch-grid-interaction-hint' : undefined}
                onPointerDown={dismissGalleryHint}
                onWheel={dismissGalleryHint}
                onKeyDown={dismissGalleryHint}
                onFocusCapture={dismissGalleryHint}
              >
                {filteredItems.length > 0 ? (
                  useNativeGalleryScroll ? (
                    <div
                      key={activeFilter}
                      className="watch-grid-canvas"
                      data-gallery-renderer="native"
                      style={{ width: canvas.width, height: canvas.height }}
                    >
                      {galleryItems}
                    </div>
                  ) : (
                    <motion.div
                      key={activeFilter}
                      className="watch-grid-canvas"
                      data-gallery-renderer="enhanced"
                      style={{ width: canvas.width, height: canvas.height, x: canvasX, y: canvasY }}
                      drag={canPan}
                      dragConstraints={panGeometry.constraints}
                      dragElastic={0.08}
                      dragMomentum={false}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.24, ease: 'easeOut' }}
                    >
                      <AnimatePresence>{galleryItems}</AnimatePresence>
                    </motion.div>
                  )
                ) : (
                  <p className="watch-grid-empty">No results in this category yet.</p>
                )}
              </div>
              {useNativeGalleryScroll && (
                <div className="watch-grid-edge-overlay" aria-hidden="true" />
              )}
              {isDesktopResultsLayout && (
                <div className="watch-grid-affordance-positioner">
                  <AnimatePresence>
                    {showGalleryHint && (
                      <motion.div
                        id="watch-grid-interaction-hint"
                        className="watch-grid-affordance"
                        role="note"
                        initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                        animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
                        exit={shouldReduce ? {} : { opacity: 0, y: 6 }}
                        transition={{ duration: shouldReduce ? 0 : 0.18, ease: 'easeOut' }}
                      >
                        <span className="watch-grid-affordance-icon" aria-hidden="true">
                          &harr;
                        </span>
                        <span>{useNativeGalleryScroll ? 'Scroll to explore' : 'Drag to explore'}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
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

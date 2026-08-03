import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'motion/react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import ResultMedia from './ResultMedia'
import ResultStory, { ResultStoryBadge } from './ResultStory'
import '../styles/ResultPresentation.css'

const DESKTOP_PRESENTATION_QUERY = '(min-width: 1025px)'
const GESTURE_THRESHOLD = 2
const WHEEL_BURST_IDLE_MS = 160
const WHEEL_SETTLE_POLL_MS = 32
const RESTING_RATIO = 0.55
const BOUNDED_STORY_RATIO = 0.512
const BOUNDED_STORY_MIN_PX = 15.2 * 16
const BOUNDED_STORY_MAX_PX = 21.6 * 16
const STORY_SPRING = {
  type: 'spring',
  stiffness: 500,
  damping: 50,
  mass: 0.7,
  restDelta: 0.5,
  restSpeed: 10,
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

export function getBoundedStoryOverlayHeight(frameHeight) {
  const safeFrameHeight = Math.max(0, frameHeight)
  return Math.min(
    safeFrameHeight,
    Math.max(
      BOUNDED_STORY_MIN_PX,
      Math.min(BOUNDED_STORY_MAX_PX, safeFrameHeight * BOUNDED_STORY_RATIO),
    ),
  )
}

export function getProgressiveStoryOverlayGeometry({
  frameHeight,
  storyHeight,
  currentHeight,
}) {
  const roundHeight = (value) => Math.round(value * 100) / 100
  const safeFrameHeight = Math.max(0, frameHeight)
  const safeStoryHeight = Math.max(0, storyHeight)
  const restingHeight = roundHeight(getBoundedStoryOverlayHeight(safeFrameHeight))
  const maximumHeight = roundHeight(Math.min(
    safeFrameHeight,
    Math.max(restingHeight, safeStoryHeight),
  ))
  const requestedHeight = currentHeight ?? restingHeight
  const displayHeight = roundHeight(Math.min(
    maximumHeight,
    Math.max(restingHeight, requestedHeight),
  ))
  const canExpand = displayHeight < maximumHeight - 1
  const hasOverflow = !canExpand && safeStoryHeight > displayHeight + 1

  return {
    frameHeight: safeFrameHeight,
    storyHeight: safeStoryHeight,
    restingHeight,
    maximumHeight,
    minimumHeight: restingHeight,
    displayHeight,
    canExpand,
    hasOverflow,
    progressive: true,
  }
}

function useOverflowResultOverlay({
  active,
  gesturesActive,
  frameRef,
  isModal,
  bounded,
  boundedDesktop,
  shouldReduceMotion,
}) {
  const [geometry, setGeometry] = useState(() => getStoryOverlayGeometry(0, 0))
  const [revealSettled, setRevealSettled] = useState(true)
  const overlayRef = useRef(null)
  const scrollRef = useRef(null)
  const storyMeasureRef = useRef(null)
  const geometryRef = useRef(geometry)
  const visualHeight = useMotionValue(0)
  const smoothScrollPosition = useMotionValue(0)
  const heightAnimationRef = useRef(null)
  const scrollAnimationRef = useRef(null)
  const heightAnimationIdRef = useRef(0)
  const scrollAnimationIdRef = useRef(0)
  const revealSettledRef = useRef(true)
  const scrollSettledRef = useRef(true)
  const scrollTargetRef = useRef(0)
  const pendingScrollDeltaRef = useRef(0)
  const flushPendingScrollRef = useRef(() => {})
  const wheelBurstRef = useRef({ active: false, direction: 0, owner: 'page' })
  const wheelBurstEndTimerRef = useRef(null)
  const touchYRef = useRef(null)
  const touchSessionRef = useRef({ active: false, direction: 0, owner: 'page' })

  const setRevealSettlement = useCallback((settled) => {
    revealSettledRef.current = settled
    setRevealSettled(settled)
  }, [])

  const getScrollMax = useCallback(() => {
    const current = geometryRef.current
    if (current.progressive) {
      return Math.max(0, current.storyHeight - current.maximumHeight)
    }
    const scroll = scrollRef.current
    return scroll ? Math.max(0, scroll.scrollHeight - scroll.clientHeight) : 0
  }, [])

  const stopHeightAnimation = useCallback(() => {
    heightAnimationIdRef.current += 1
    heightAnimationRef.current?.stop()
    heightAnimationRef.current = null
  }, [])

  const stopScrollAnimation = useCallback(() => {
    scrollAnimationIdRef.current += 1
    scrollAnimationRef.current?.stop()
    scrollAnimationRef.current = null
  }, [])

  const syncScrollPosition = useCallback((value = 0) => {
    stopScrollAnimation()
    const nextValue = Math.min(getScrollMax(), Math.max(0, value))
    scrollTargetRef.current = nextValue
    scrollSettledRef.current = true
    smoothScrollPosition.set(nextValue)
    if (scrollRef.current) scrollRef.current.scrollTop = nextValue
  }, [getScrollMax, smoothScrollPosition, stopScrollAnimation])

  const animateScrollTo = useCallback((target, { immediate = false } = {}) => {
    const scroll = scrollRef.current
    if (!scroll) return 0

    const nextTarget = Math.min(getScrollMax(), Math.max(0, target))
    scrollTargetRef.current = nextTarget
    stopScrollAnimation()

    if (immediate || shouldReduceMotion) {
      scrollSettledRef.current = true
      smoothScrollPosition.set(nextTarget)
      scroll.scrollTop = nextTarget
      return nextTarget
    }

    const currentPosition = scrollSettledRef.current
      ? scroll.scrollTop
      : smoothScrollPosition.get()
    if (scrollSettledRef.current && Math.abs(smoothScrollPosition.get() - currentPosition) > 1) {
      smoothScrollPosition.set(currentPosition)
    }
    if (Math.abs(nextTarget - currentPosition) <= 1) {
      scrollSettledRef.current = true
      scroll.scrollTop = nextTarget
      return nextTarget
    }

    scrollSettledRef.current = false
    const animationId = ++scrollAnimationIdRef.current
    let completedSynchronously = false
    const scrollAnimation = animate(smoothScrollPosition, nextTarget, {
      ...STORY_SPRING,
      onComplete: () => {
        if (scrollAnimationIdRef.current !== animationId) return
        completedSynchronously = true
        scrollAnimationRef.current = null
        scrollSettledRef.current = true
        smoothScrollPosition.set(nextTarget)
        if (scrollRef.current) scrollRef.current.scrollTop = nextTarget
      },
    })
    scrollAnimationRef.current = completedSynchronously ? null : scrollAnimation
    return nextTarget
  }, [getScrollMax, shouldReduceMotion, smoothScrollPosition, stopScrollAnimation])

  const applySmoothScrollDelta = useCallback((delta) => {
    const currentTarget = scrollSettledRef.current
      ? scrollRef.current?.scrollTop ?? scrollTargetRef.current
      : scrollTargetRef.current
    return animateScrollTo(currentTarget + delta)
  }, [animateScrollTo])

  const setVisualHeight = useCallback((value) => {
    visualHeight.set(value)
    if (boundedDesktop && overlayRef.current) {
      overlayRef.current.style.height = `${value}px`
    }
  }, [boundedDesktop, visualHeight])

  const finishReveal = useCallback((targetHeight) => {
    stopHeightAnimation()
    setVisualHeight(targetHeight)
    setRevealSettlement(true)
    flushPendingScrollRef.current()
  }, [setRevealSettlement, setVisualHeight, stopHeightAnimation])

  const animateHeightTo = useCallback((targetHeight, { immediate = false } = {}) => {
    stopHeightAnimation()
    if (immediate || shouldReduceMotion) {
      finishReveal(targetHeight)
      return
    }

    if (Math.abs(targetHeight - visualHeight.get()) <= 1) {
      finishReveal(targetHeight)
      return
    }

    setRevealSettlement(false)
    const animationId = ++heightAnimationIdRef.current
    let completedSynchronously = false
    const heightAnimation = animate(visualHeight, targetHeight, {
      ...STORY_SPRING,
      onComplete: () => {
        if (heightAnimationIdRef.current !== animationId) return
        completedSynchronously = true
        heightAnimationRef.current = null
        setVisualHeight(targetHeight)
        setRevealSettlement(true)
        flushPendingScrollRef.current()
      },
    })
    heightAnimationRef.current = completedSynchronously ? null : heightAnimation
  }, [
    finishReveal,
    setRevealSettlement,
    setVisualHeight,
    shouldReduceMotion,
    stopHeightAnimation,
    visualHeight,
  ])

  const clearGestureOwnership = useCallback(() => {
    if (wheelBurstEndTimerRef.current) {
      window.clearTimeout(wheelBurstEndTimerRef.current)
      wheelBurstEndTimerRef.current = null
    }
    wheelBurstRef.current = { active: false, direction: 0, owner: 'page' }
    touchSessionRef.current = { active: false, direction: 0, owner: 'page' }
    touchYRef.current = null
  }, [])

  const reset = useCallback(() => {
    clearGestureOwnership()
    pendingScrollDeltaRef.current = 0
    syncScrollPosition(0)

    const current = geometryRef.current
    if (current.progressive) {
      const nextGeometry = getProgressiveStoryOverlayGeometry({
        frameHeight: current.frameHeight,
        storyHeight: current.storyHeight,
        currentHeight: current.restingHeight,
      })
      geometryRef.current = nextGeometry
      setGeometry(nextGeometry)
      animateHeightTo(nextGeometry.restingHeight, { immediate: true })
    } else {
      stopHeightAnimation()
    }
  }, [
    animateHeightTo,
    clearGestureOwnership,
    stopHeightAnimation,
    syncScrollPosition,
  ])

  const expandBy = useCallback((delta, { smooth = true } = {}) => {
    const current = geometryRef.current
    if (!current.progressive || !current.canExpand || delta <= 0) return 0

    const requestedGrowth = Math.min(delta, current.maximumHeight - current.displayHeight)
    if (requestedGrowth <= 0) return 0

    const nextGeometry = getProgressiveStoryOverlayGeometry({
      frameHeight: current.frameHeight,
      storyHeight: current.storyHeight,
      currentHeight: current.displayHeight + requestedGrowth,
    })
    const growth = nextGeometry.displayHeight - current.displayHeight
    geometryRef.current = nextGeometry
    setGeometry(nextGeometry)
    animateHeightTo(nextGeometry.displayHeight, { immediate: !smooth })
    return growth
  }, [animateHeightTo])

  flushPendingScrollRef.current = () => {
    const pendingDelta = pendingScrollDeltaRef.current
    pendingScrollDeltaRef.current = 0
    if (pendingDelta <= GESTURE_THRESHOLD || !geometryRef.current.hasOverflow) return
    applySmoothScrollDelta(pendingDelta)
  }

  useLayoutEffect(() => visualHeight.on('change', (latest) => {
    if (boundedDesktop && overlayRef.current) {
      overlayRef.current.style.height = `${latest}px`
    }
  }), [boundedDesktop, visualHeight])

  useEffect(() => smoothScrollPosition.on('change', (latest) => {
    if (scrollRef.current) scrollRef.current.scrollTop = latest
  }), [smoothScrollPosition])

  useEffect(() => {
    if (!shouldReduceMotion) return
    const current = geometryRef.current
    if (current.progressive) finishReveal(current.displayHeight)
    syncScrollPosition(scrollTargetRef.current)
  }, [finishReveal, shouldReduceMotion, syncScrollPosition])

  useLayoutEffect(() => {
    if (!active) {
      clearGestureOwnership()
      pendingScrollDeltaRef.current = 0
      stopHeightAnimation()
      stopScrollAnimation()
      setRevealSettlement(true)
      return undefined
    }

    const frame = frameRef.current
    const storyMeasure = storyMeasureRef.current
    const overlay = overlayRef.current
    const scroll = scrollRef.current
    if (!frame || !storyMeasure || !overlay || !scroll) return undefined

    const measure = () => {
      const frameHeight = frame.clientHeight || frame.getBoundingClientRect().height
      const storyHeight = (
        storyMeasure.scrollHeight
        || storyMeasure.getBoundingClientRect().height
      )
      if (frameHeight <= 0) return

      let nextGeometry
      if (boundedDesktop) {
        const previous = geometryRef.current
        const wasResting = (
          !previous.progressive
          || previous.displayHeight <= previous.restingHeight + 1
        )
        nextGeometry = getProgressiveStoryOverlayGeometry({
          frameHeight,
          storyHeight,
          currentHeight: wasResting ? undefined : previous.displayHeight,
        })
      } else if (bounded) {
        const displayHeight = overlay.clientHeight || overlay.getBoundingClientRect().height
        const availableStoryHeight = scroll.clientHeight || displayHeight
        const scrollHeight = scroll.scrollHeight || storyHeight

        nextGeometry = {
          frameHeight,
          storyHeight: scrollHeight,
          minimumHeight: displayHeight,
          displayHeight,
          canExpand: false,
          hasOverflow: scrollHeight > availableStoryHeight + 1,
          progressive: false,
        }
      } else {
        nextGeometry = {
          ...getStoryOverlayGeometry(frameHeight, storyHeight),
          canExpand: false,
          progressive: false,
        }
      }

      const current = geometryRef.current
      const geometryUnchanged = (
        current.frameHeight === nextGeometry.frameHeight
        && current.storyHeight === nextGeometry.storyHeight
        && current.restingHeight === nextGeometry.restingHeight
        && current.maximumHeight === nextGeometry.maximumHeight
        && current.minimumHeight === nextGeometry.minimumHeight
        && current.displayHeight === nextGeometry.displayHeight
        && current.canExpand === nextGeometry.canExpand
        && current.hasOverflow === nextGeometry.hasOverflow
      )
      if (geometryUnchanged) return

      geometryRef.current = nextGeometry
      setGeometry(nextGeometry)
      pendingScrollDeltaRef.current = 0
      clearGestureOwnership()
      if (boundedDesktop) {
        animateHeightTo(nextGeometry.displayHeight, { immediate: true })
        syncScrollPosition(scrollRef.current?.scrollTop ?? 0)
      } else {
        stopHeightAnimation()
        syncScrollPosition(0)
      }
    }

    measure()
    window.addEventListener('resize', measure)

    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    if (!boundedDesktop) {
      observer.observe(overlay)
      observer.observe(scroll)
      observer.observe(storyMeasure)
    }

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [
    active,
    animateHeightTo,
    bounded,
    boundedDesktop,
    clearGestureOwnership,
    frameRef,
    setRevealSettlement,
    stopHeightAnimation,
    stopScrollAnimation,
    syncScrollPosition,
  ])

  useEffect(() => () => {
    clearGestureOwnership()
    pendingScrollDeltaRef.current = 0
    stopHeightAnimation()
    stopScrollAnimation()
  }, [clearGestureOwnership, stopHeightAnimation, stopScrollAnimation])

  useEffect(() => {
    if (!gesturesActive) return undefined

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
        scrollTarget: scrollSettledRef.current
          ? scroll?.scrollTop ?? scrollTargetRef.current
          : scrollTargetRef.current,
        scrollMax: getScrollMax(),
      }
    }

    const canConsume = (direction, smooth) => {
      if (!geometryRef.current.hasOverflow || !revealSettledRef.current) return false
      const { scrollTop, scrollTarget, scrollMax } = getScrollMetrics()
      const position = smooth ? scrollTarget : scrollTop
      const isMoving = smooth && !scrollSettledRef.current
      return direction > 0
        ? position < scrollMax - 1 || isMoving
        : position > 1 || isMoving
    }

    const applyDelta = (deltaY, smooth) => {
      const { scroll, scrollTop } = getScrollMetrics()
      if (!scroll) return
      if (smooth) {
        applySmoothScrollDelta(deltaY)
      } else {
        animateScrollTo(scrollTop + deltaY, { immediate: true })
      }
    }

    const claimSession = (sessionRef, direction, smooth) => {
      const owner = direction > 0 && (
        geometryRef.current.canExpand
        || !revealSettledRef.current
      )
        ? 'reveal'
        : geometryRef.current.hasOverflow && canConsume(direction, smooth)
          ? 'story'
          : isModal
            ? 'modal'
            : 'page'
      sessionRef.current = { active: true, direction, owner }
      return owner
    }

    const resolveSessionOwner = (sessionRef, direction, smooth) => {
      const session = sessionRef.current
      if (
        !session.active
        || session.direction !== direction
        || (
          session.owner === 'reveal'
          && !geometryRef.current.canExpand
          && revealSettledRef.current
        )
        || (session.owner === 'story' && !canConsume(direction, smooth))
      ) {
        return claimSession(sessionRef, direction, smooth)
      }
      return session.owner
    }

    const consumeDelta = (sessionRef, deltaY, { smooth }) => {
      let owner = resolveSessionOwner(sessionRef, Math.sign(deltaY), smooth)
      let consumed = false

      if (owner === 'reveal' && deltaY > 0) {
        const growth = geometryRef.current.canExpand
          ? expandBy(deltaY, { smooth })
          : 0
        consumed = growth > 0
        const remainder = deltaY - growth

        if (smooth && !revealSettledRef.current) {
          pendingScrollDeltaRef.current += Math.max(0, remainder)
          consumed = true
        } else if (remainder > GESTURE_THRESHOLD && !geometryRef.current.canExpand) {
          if (geometryRef.current.hasOverflow && canConsume(1, smooth)) {
            applyDelta(remainder, smooth)
            owner = 'story'
          } else {
            owner = isModal ? 'modal' : 'page'
          }
          sessionRef.current = { active: true, direction: 1, owner }
        }
      } else if (owner === 'story') {
        applyDelta(deltaY, smooth)
        consumed = true
      }

      return consumed || owner !== 'page'
    }

    const canPreviewOwn = (direction, smooth) => (
      direction > 0 && (
        geometryRef.current.canExpand
        || !revealSettledRef.current
      )
      || geometryRef.current.hasOverflow && canConsume(direction, smooth)
      || isModal
    )

    const endWheelBurstWhenSettled = () => {
      wheelBurstEndTimerRef.current = null
      const burst = wheelBurstRef.current
      if (!burst.active) return

      if (
        burst.owner === 'preview'
        && (!revealSettledRef.current || !scrollSettledRef.current)
      ) {
        wheelBurstEndTimerRef.current = window.setTimeout(
          endWheelBurstWhenSettled,
          WHEEL_SETTLE_POLL_MS,
        )
        return
      }

      wheelBurstRef.current = { active: false, direction: 0, owner: 'page' }
    }

    const scheduleWheelBurstEnd = () => {
      if (wheelBurstEndTimerRef.current) {
        window.clearTimeout(wheelBurstEndTimerRef.current)
      }
      wheelBurstEndTimerRef.current = window.setTimeout(
        endWheelBurstWhenSettled,
        WHEEL_BURST_IDLE_MS,
      )
    }

    const handleWheel = (event) => {
      const multiplier = event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? geometryRef.current.frameHeight
          : 1
      const deltaY = event.deltaY * multiplier
      const direction = Math.sign(deltaY)
      const burst = wheelBurstRef.current

      if (Math.abs(deltaY) < GESTURE_THRESHOLD) {
        if (burst.active && burst.owner === 'preview') {
          event.preventDefault()
          scheduleWheelBurstEnd()
        }
        return
      }

      if (!burst.active) {
        wheelBurstRef.current = {
          active: true,
          direction,
          owner: canPreviewOwn(direction, true) ? 'preview' : 'page',
        }
      } else if (
        burst.owner === 'page'
        && burst.direction !== direction
        && canPreviewOwn(direction, true)
      ) {
        wheelBurstRef.current = { active: true, direction, owner: 'preview' }
      } else {
        wheelBurstRef.current.direction = direction
      }

      if (wheelBurstRef.current.owner === 'preview') {
        event.preventDefault()
        const wheelEventSession = {
          current: { active: false, direction: 0, owner: 'page' },
        }
        consumeDelta(wheelEventSession, deltaY, { smooth: true })
      }

      scheduleWheelBurstEnd()
    }

    const handleTouchStart = (event) => {
      if (isControlTarget(event.target)) return
      pendingScrollDeltaRef.current = 0
      stopHeightAnimation()
      if (geometryRef.current.progressive) {
        setVisualHeight(geometryRef.current.displayHeight)
        setRevealSettlement(true)
      }
      syncScrollPosition(scrollRef.current?.scrollTop ?? 0)
      touchYRef.current = event.touches[0]?.clientY ?? null
      touchSessionRef.current = { active: false, direction: 0, owner: 'page' }
    }

    const handleTouchMove = (event) => {
      if (touchYRef.current === null || isControlTarget(event.target)) return
      const currentY = event.touches[0]?.clientY
      if (currentY === undefined) return
      const deltaY = touchYRef.current - currentY
      touchYRef.current = currentY
      if (Math.abs(deltaY) < GESTURE_THRESHOLD) return

      if (consumeDelta(touchSessionRef, deltaY, { smooth: false })) event.preventDefault()
    }

    const handleTouchEnd = () => {
      touchYRef.current = null
      touchSessionRef.current = { active: false, direction: 0, owner: 'page' }
    }

    frame.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    frame.addEventListener('touchstart', handleTouchStart, { passive: true })
    frame.addEventListener('touchmove', handleTouchMove, { passive: false })
    frame.addEventListener('touchend', handleTouchEnd)
    frame.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      if (wheelBurstEndTimerRef.current) {
        window.clearTimeout(wheelBurstEndTimerRef.current)
        wheelBurstEndTimerRef.current = null
      }
      wheelBurstRef.current = { active: false, direction: 0, owner: 'page' }
      frame.removeEventListener('wheel', handleWheel, true)
      frame.removeEventListener('touchstart', handleTouchStart)
      frame.removeEventListener('touchmove', handleTouchMove)
      frame.removeEventListener('touchend', handleTouchEnd)
      frame.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [
    animateScrollTo,
    applySmoothScrollDelta,
    expandBy,
    frameRef,
    gesturesActive,
    getScrollMax,
    isModal,
    setRevealSettlement,
    setVisualHeight,
    stopHeightAnimation,
    syncScrollPosition,
  ])

  const handleKeyDown = useCallback((event) => {
    if (event.target !== event.currentTarget) return

    const scroll = scrollRef.current
    if (!scroll) return
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

    if (isDownward && (
      geometryRef.current.canExpand
      || !revealSettledRef.current
    )) {
      const step = event.key === 'ArrowDown' ? 48 : scroll.clientHeight * 0.8
      const growth = geometryRef.current.canExpand
        ? expandBy(step, { smooth: true })
        : 0
      const remainder = step - growth
      event.preventDefault()
      if (!revealSettledRef.current) {
        pendingScrollDeltaRef.current += Math.max(0, remainder)
      } else if (remainder > GESTURE_THRESHOLD && geometryRef.current.hasOverflow) {
        applySmoothScrollDelta(remainder)
      }
      return
    }

    if (!geometryRef.current.hasOverflow || !revealSettledRef.current) return

    const scrollMax = getScrollMax()
    const scrollTarget = scrollSettledRef.current
      ? scroll.scrollTop
      : scrollTargetRef.current
    const atTop = scrollTarget <= 1 && scrollSettledRef.current
    const atBottom = scrollTarget >= scrollMax - 1 && scrollSettledRef.current

    if (isDownward && !atBottom) {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 48 : scroll.clientHeight * 0.8
      applySmoothScrollDelta(step)
      return
    }

    if (isUpward && !atTop) {
      event.preventDefault()
      const step = event.key === 'ArrowUp' ? 48 : scroll.clientHeight * 0.8
      applySmoothScrollDelta(-step)
      return
    }

    if (event.key === 'Home' && !atTop) {
      event.preventDefault()
      animateScrollTo(0)
      return
    }

    if (isModal && (isDownward || isUpward || event.key === 'Home')) {
      event.preventDefault()
    }
  }, [
    animateScrollTo,
    applySmoothScrollDelta,
    expandBy,
    getScrollMax,
    isModal,
  ])

  const revealInProgress = Boolean(geometry.progressive && !revealSettled)
  return {
    height: boundedDesktop
      ? geometry.frameHeight > 0
        ? visualHeight
        : 'min(100%, clamp(15.2rem, 51.2%, 21.6rem))'
      : geometry.frameHeight > 0
        ? geometry.displayHeight
        : '55%',
    scrollMode: geometry.canExpand || revealInProgress
      ? 'reveal'
      : geometry.hasOverflow
        ? 'overflow'
        : 'fit',
    canExpand: Boolean(geometry.canExpand || revealInProgress),
    revealState: geometry.progressive
      ? geometry.canExpand || revealInProgress
        ? geometry.displayHeight <= geometry.restingHeight + 1
          ? 'compact'
          : 'expanding'
        : 'revealed'
      : undefined,
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
  storyLayout = 'adaptive',
  storyAction = null,
  role = 'group',
  className = '',
  children,
}) {
  const shouldReduceMotion = useReducedMotion()
  const isDesktop = useDesktopPresentation()
  const frameRef = useRef(null)
  const previousDesktopRef = useRef(isDesktop)
  const usesBoundedStory = storyLayout === 'bounded'
  const effectiveStoryOpen = isDesktop ? storyOpen : true
  const canToggleStory = allowStoryToggle && isDesktop
  const scrollsWholeStory = usesBoundedStory && isDesktop && !isModal
  const {
    height,
    scrollMode,
    canExpand,
    revealState,
    overlayRef,
    scrollRef,
    storyMeasureRef,
    reset,
    handleKeyDown,
  } = useOverflowResultOverlay({
    active: effectiveStoryOpen && (isDesktop || usesBoundedStory),
    gesturesActive: effectiveStoryOpen && isDesktop,
    frameRef,
    isModal,
    bounded: usesBoundedStory,
    boundedDesktop: scrollsWholeStory,
    shouldReduceMotion,
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

  useEffect(() => {
    const enteredDesktop = isDesktop && !previousDesktopRef.current
    previousDesktopRef.current = isDesktop
    if (usesBoundedStory && enteredDesktop) reset()
  }, [isDesktop, reset, usesBoundedStory])

  const setStoryOpen = (nextOpen) => {
    reset()
    onStoryOpenChange?.(nextOpen)
  }

  const boundedHeader = usesBoundedStory ? (
    <div className="result-overlay-header">
      <ResultStoryBadge result={result} />
      <div className="result-overlay-header-action">
        {canToggleStory && (
          <button
            type="button"
            className={`result-preview-close${useLabeledHideControl ? ' result-preview-hide-label' : ''}`}
            aria-label="Hide result story"
            onClick={() => setStoryOpen(false)}
          >
            {useLabeledHideControl ? 'Hide Story' : <span aria-hidden="true">&times;</span>}
          </button>
        )}
        {!canToggleStory && storyAction}
      </div>
    </div>
  ) : null

  return (
    <div
      className={`result-presentation${usesBoundedStory ? ' result-presentation--bounded-story' : ''}${className ? ` ${className}` : ''}`}
      data-story-layout={isDesktop ? 'overlay' : 'docked'}
      data-story-frame={usesBoundedStory ? 'bounded' : 'adaptive'}
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
          data-scroll-mode={isDesktop || usesBoundedStory ? scrollMode : 'docked'}
          data-scroll-scope={scrollsWholeStory ? 'whole-story' : undefined}
          data-reveal-state={scrollsWholeStory ? revealState : undefined}
          tabIndex={isDesktop && (canExpand || scrollMode === 'overflow') ? 0 : undefined}
          ref={overlayRef}
          onKeyDown={handleKeyDown}
          style={isDesktop && !scrollsWholeStory ? { height } : undefined}
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={shouldReduceMotion ? {} : { opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div className="result-overlay-backdrop" aria-hidden="true" />

          {usesBoundedStory && !scrollsWholeStory && boundedHeader}

          {!usesBoundedStory && canToggleStory && (
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
              {scrollsWholeStory && boundedHeader}
              <ResultStory
                result={result}
                titleId={titleId}
                descriptionId={descriptionId}
                headingLevel={headingLevel}
                className="result-story--presentation"
                showBadge={!usesBoundedStory}
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

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import '../styles/SiteBackground.css'

const MOBILE_QUERY = '(max-width: 768px)'

function getInitialMobileState() {
  if (typeof window === 'undefined') return true
  return window.matchMedia(MOBILE_QUERY).matches
}

function getSaveDataEnabled() {
  if (typeof navigator === 'undefined') return false
  return Boolean(navigator.connection?.saveData)
}

// Brand cyan as RGB — no salmon in the background layer.
const CYAN_R = 22
const CYAN_G = 201
const CYAN_B = 221

// Pointer interaction tuning (desktop only).
const MOUSE_ANGLE = 6      // max degrees the beams swing toward the cursor (x)
const MOUSE_ORIGIN = 0.015 // max apex shift as a fraction of viewport width
const POINTER_EASE = 0.05  // per-frame easing toward the pointer target (glide)

// Beam definitions: origin as fraction of viewport width/height,
// base half-angle (degrees), peak alpha, and how much scroll shifts the angle.
const BEAMS = [
  {
    // Left wing spotlight — originates beyond top-left edge, sweeps right
    ox: -0.04, oy: -0.02,
    angleDeg: 28,          // angle from vertical (clockwise)
    spread: 20,            // cone half-angle in degrees
    reach: 1.6,            // gradient radius as multiple of viewport height
    peakAlpha: 0.065,
    driftAmp: 1.5,         // ±degrees of slow angular drift
    driftPeriod: 14,       // seconds per full drift cycle
    driftPhase: 0,
    scrollShift: 6,        // degrees added at scroll progress = 1
    mouseFactor: 1.0,      // how strongly this beam tracks the cursor (parallax depth)
  },
  {
    // Right wing spotlight — originates beyond top-right edge, sweeps left
    ox: 1.04, oy: -0.02,
    angleDeg: -28,
    spread: 18,
    reach: 1.5,
    peakAlpha: 0.045,
    driftAmp: 1.5,
    driftPeriod: 16,
    driftPhase: Math.PI,   // offset so they don't pulse in sync
    scrollShift: -6,
    mouseFactor: 0.65,
  },
]

const DEG = Math.PI / 180

function drawBeam(ctx, beam, W, H, t, scrollProgress, pointer) {
  // Apex with mouse parallax (horizontal) and a gentle scroll-driven descent.
  const ox = beam.ox * W + pointer.x * MOUSE_ORIGIN * W * beam.mouseFactor
  const oy = beam.oy * H + scrollProgress * H * 0.04

  // Base angle + slow drift + scroll shift + cursor tracking.
  const drift = beam.driftAmp * Math.sin(2 * Math.PI * t / beam.driftPeriod + beam.driftPhase)
  const scrollDelta = beam.scrollShift * scrollProgress
  // Same-sign cursor swing on both beams → bright convergence tracks the cursor.
  const mouseDelta = pointer.x * MOUSE_ANGLE * beam.mouseFactor
  const angleDeg = beam.angleDeg + drift + scrollDelta + mouseDelta
  const angleRad = angleDeg * DEG

  const spreadRad = beam.spread * DEG
  const leftRad  = angleRad - spreadRad
  const rightRad = angleRad + spreadRad
  const reach = beam.reach * H

  // Triangle vertices: apex at origin, base on the far reach
  const lx = ox + Math.sin(leftRad)  * reach
  const ly = oy + Math.cos(leftRad)  * reach
  const rx = ox + Math.sin(rightRad) * reach
  const ry = oy + Math.cos(rightRad) * reach

  // Clip to cone triangle
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.lineTo(lx, ly)
  ctx.lineTo(rx, ry)
  ctx.closePath()
  ctx.clip()

  // Radial gradient from apex outward — tight at source, zero at reach
  const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, reach)
  const { peakAlpha } = beam
  // Intensity breathes very gently over time (±8%)
  const breathe = 1 + 0.08 * Math.sin(2 * Math.PI * t / (beam.driftPeriod * 1.3) + beam.driftPhase)
  // Cursor nearer the top of the viewport lifts intensity slightly.
  const lift = 1 + (-pointer.y) * 0.12
  const a0 = Math.min(peakAlpha * breathe * lift, 0.09)
  grad.addColorStop(0,    `rgba(${CYAN_R}, ${CYAN_G}, ${CYAN_B}, ${a0})`)
  grad.addColorStop(0.35, `rgba(${CYAN_R}, ${CYAN_G}, ${CYAN_B}, ${a0 * 0.45})`)
  grad.addColorStop(0.7,  `rgba(${CYAN_R}, ${CYAN_G}, ${CYAN_B}, ${a0 * 0.12})`)
  grad.addColorStop(1,    `rgba(${CYAN_R}, ${CYAN_G}, ${CYAN_B}, 0)`)

  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

export default function SiteBackground() {
  const shouldReduce = useReducedMotion()
  const [isMobile, setIsMobile] = useState(getInitialMobileState)
  const [saveData, setSaveData] = useState(getSaveDataEnabled)
  const canvasRef = useRef(null)

  // Match mobile breakpoint, same pattern as Hero.jsx
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const query = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(query.matches)
    update()
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    }
    query.addListener(update)
    return () => query.removeListener(update)
  }, [])

  // Track Save-Data, same pattern as Hero.jsx
  useEffect(() => {
    if (typeof navigator === 'undefined') return undefined
    const connection = navigator.connection
    if (!connection) return undefined
    const update = () => setSaveData(Boolean(connection.saveData))
    update()
    if (typeof connection.addEventListener === 'function') {
      connection.addEventListener('change', update)
      return () => connection.removeEventListener('change', update)
    }
    return undefined
  }, [])

  const disabled = shouldReduce || saveData

  // Desktop canvas RAF loop
  useEffect(() => {
    if (disabled || isMobile) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    let W = 0, H = 0, dpr = 1
    let rafId = 0
    let running = false
    let tabVisible = true
    const scrollRef = { progress: 0, rawY: 0 }
    // tx/ty = pointer target (-1..1, 0 = centre); x/y = smoothed value the draw loop reads.
    const pointer = { tx: 0, ty: 0, x: 0, y: 0 }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      W = window.innerWidth
      H = window.innerHeight
      canvas.width  = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.width  = `${W}px`
      canvas.style.height = `${H}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const onScroll = () => {
      scrollRef.rawY = window.scrollY
      // Normalize over the full document scroll range
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      scrollRef.progress = Math.min(scrollRef.rawY / maxScroll, 1)
    }

    const onMouseMove = (e) => {
      pointer.tx = (e.clientX / W) * 2 - 1
      pointer.ty = (e.clientY / H) * 2 - 1
    }
    // Glide back to rest when the cursor leaves the window or focus is lost.
    const onPointerRest = () => {
      pointer.tx = 0
      pointer.ty = 0
    }

    const draw = (now) => {
      const t = now * 0.001 // seconds
      // Ease the smoothed pointer toward its target so the beams glide, not snap.
      pointer.x += (pointer.tx - pointer.x) * POINTER_EASE
      pointer.y += (pointer.ty - pointer.y) * POINTER_EASE
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'source-over'
      for (const beam of BEAMS) {
        drawBeam(ctx, beam, W, H, t, scrollRef.progress, pointer)
      }
      rafId = requestAnimationFrame(draw)
    }

    const start = () => {
      if (running || !tabVisible) return
      running = true
      rafId = requestAnimationFrame(draw)
    }
    const stop = () => {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    }

    const onVisibility = () => {
      tabVisible = document.visibilityState !== 'hidden'
      if (tabVisible) start()
      else stop()
    }

    resize()
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('blur', onPointerRest)
    document.addEventListener('mouseleave', onPointerRest)
    document.addEventListener('visibilitychange', onVisibility)

    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(resize, 150)
    }
    window.addEventListener('resize', onResize)

    start()

    return () => {
      stop()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('blur', onPointerRest)
      document.removeEventListener('mouseleave', onPointerRest)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearTimeout(resizeTimer)
    }
  }, [disabled, isMobile])

  if (disabled) return null
  if (isMobile) return <div className="site-bg site-bg--css" aria-hidden="true" />
  return <canvas ref={canvasRef} className="site-bg site-bg--canvas" aria-hidden="true" />
}

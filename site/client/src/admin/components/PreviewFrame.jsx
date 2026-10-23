import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import JourneyIcon from '../../components/JourneyIcon'
import { PREVIEW_MESSAGE, PREVIEW_READY } from '../../hooks/useContent'

const DEVICES = {
  phone: { label: 'Phone', width: 390 },
  desktop: { label: 'Desktop', width: 1280 },
}
const DEVICE_KEY = 'jd-admin-preview-device'
const MIN_PAGE_HEIGHT = 480

function withPreviewFlag(path) {
  return `${path}${path.includes('?') ? '&' : '?'}cmsPreview=1`
}

function initialDevice() {
  try {
    const saved = localStorage.getItem(DEVICE_KEY)
    if (DEVICES[saved]) return saved
  } catch {
    // Storage can be blocked; fall back to a size that suits this screen.
  }
  return window.matchMedia?.('(min-width: 1400px)').matches ? 'desktop' : 'phone'
}

// The page is shown at the device's width, scaled down to fit the panel, and as
// tall as the panel: text stays readable and the panel is never half empty, and
// Jake scrolls inside it (the preview also scrolls to what he is editing).
function fitToStage(device, stage) {
  const { width } = DEVICES[device]
  const scale = Math.min(1, stage.width / width)
  return { width, height: Math.max(MIN_PAGE_HEIGHT, Math.round(stage.height / scale)), scale }
}

// The real public page in an iframe, scaled to fit, with the editor's draft
// posted into it (see hooks/useContent.js). `collections` maps a public
// collection name to the list it should show; `section` names the part of the
// page being edited, which the page scrolls to.
export default function PreviewFrame({ path, collections, section, title = 'Preview', note }) {
  const [device, setDevice] = useState(initialDevice)
  const [stage, setStage] = useState({ width: 390, height: 800 })
  const [expanded, setExpanded] = useState(false)
  const stageRef = useRef(null)
  const frameRef = useRef(null)
  const expandRef = useRef(null)
  const latest = useRef({ collections, section })
  const view = fitToStage(device, stage)

  latest.current = { collections, section }

  useLayoutEffect(() => {
    const element = stageRef.current
    if (!element) return undefined
    const measure = () => setStage({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [])

  const post = (reveal = false) => {
    const target = frameRef.current?.contentWindow
    if (target && latest.current.collections) {
      target.postMessage({ type: PREVIEW_MESSAGE, ...latest.current, reveal }, window.location.origin)
    }
  }

  useEffect(() => post(), [collections, section])

  // On phones the preview sits behind an Edit / Preview switch. When it comes
  // into view, ask the page to scroll to the section again: it could not while
  // hidden.
  useEffect(() => {
    const element = stageRef.current
    if (!element || typeof IntersectionObserver !== 'function') return undefined
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && post(true))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin === window.location.origin && event.data?.type === PREVIEW_READY
        && event.source === frameRef.current?.contentWindow) post(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (!expanded) return undefined
    const onKey = (event) => event.key === 'Escape' && setExpanded(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expanded])

  const chooseDevice = (key) => {
    setDevice(key)
    try {
      localStorage.setItem(DEVICE_KEY, key)
    } catch {
      // Not remembered; nothing else depends on it.
    }
  }

  const toggleExpanded = () => {
    setExpanded(!expanded)
    requestAnimationFrame(() => expandRef.current?.focus())
  }

  return (
    <section className={`jd-preview${expanded ? ' is-expanded' : ''}`} aria-label={expanded ? 'Live preview, full screen' : 'Live preview'}>
      <div className="jd-preview-head">
        <div className="jd-preview-heading">
          <p className="jd-preview-title">{title}</p>
          {note && <p className="jd-preview-note">{note}</p>}
        </div>
        <div className="jd-preview-tools">
          <div className="jd-segmented" role="group" aria-label="Preview size">
            {Object.entries(DEVICES).map(([key, info]) => (
              <button key={key} type="button" aria-pressed={device === key} onClick={() => chooseDevice(key)}>
                {info.label}
              </button>
            ))}
          </div>
          <button ref={expandRef} type="button" className="jd-admin-icon-button" onClick={toggleExpanded}
            aria-label={expanded ? 'Exit full screen' : 'Show the preview full screen'} title={expanded ? 'Exit full screen' : 'Full screen'}>
            <JourneyIcon name={expanded ? 'minimize' : 'maximize'} size={18} />
          </button>
        </div>
      </div>
      <div className="jd-preview-stage" ref={stageRef}>
        {path ? (
          <div className="jd-preview-device" style={{ width: Math.round(view.width * view.scale), height: Math.round(view.height * view.scale) }}>
            <iframe
              ref={frameRef}
              key={`${device}:${path}`}
              title={`${title}, ${DEVICES[device].label.toLowerCase()} size`}
              src={withPreviewFlag(path)}
              width={view.width}
              height={view.height}
              style={{ transform: `scale(${view.scale})` }}
              onLoad={() => post(true)}
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}

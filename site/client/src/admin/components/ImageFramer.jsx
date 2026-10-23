import { useId, useRef } from 'react'

const MAX_ZOOM = 3
const NUDGE = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }
const clampPercent = (value) => Math.min(100, Math.max(0, Math.round(value)))
const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(1, Math.round(value * 100) / 100))

export const DEFAULT_FRAMING = { focus: { x: 50, y: 50 }, zoom: 1 }

// The same CSS the public site uses (hooks/useAssets.js framedImageStyle), so
// what Jake sees here is how the photo is cropped on the page.
function framedStyle({ focus, zoom }) {
  const position = `${focus.x}% ${focus.y}%`
  return { objectPosition: position, transform: `scale(${zoom})`, transformOrigin: position }
}

// Crop a photo to its frame by dragging it and zooming in. The frame shows the
// spot's shape; any photo works, whatever its own shape. Keyboard: arrow keys
// move it, + and - zoom.
export default function ImageFramer({ src, value, onChange, aspect = '3 / 4', label = 'Photo' }) {
  const framing = { ...DEFAULT_FRAMING, ...value, focus: { ...DEFAULT_FRAMING.focus, ...value?.focus } }
  const frameRef = useRef(null)
  const drag = useRef(null)
  const hintId = useId()
  const changed = framing.zoom !== 1 || framing.focus.x !== 50 || framing.focus.y !== 50

  const set = (next) => onChange({ ...framing, ...next })

  const startDrag = (event) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, focus: framing.focus }
  }

  // Dragging the photo right shows more of its left side, so the kept-in-view
  // point moves the other way, by the share of the frame dragged.
  const moveDrag = (event) => {
    if (!drag.current) return
    const box = frameRef.current.getBoundingClientRect()
    const dx = ((event.clientX - drag.current.x) / box.width) * 100 / framing.zoom
    const dy = ((event.clientY - drag.current.y) / box.height) * 100 / framing.zoom
    set({ focus: { x: clampPercent(drag.current.focus.x - dx), y: clampPercent(drag.current.focus.y - dy) } })
  }

  const endDrag = () => {
    drag.current = null
  }

  const onKeyDown = (event) => {
    const step = NUDGE[event.key]
    if (step) {
      event.preventDefault()
      set({ focus: { x: clampPercent(framing.focus.x + step[0]), y: clampPercent(framing.focus.y + step[1]) } })
    } else if (event.key === '+' || event.key === '=' || event.key === '-') {
      event.preventDefault()
      set({ zoom: clampZoom(framing.zoom + (event.key === '-' ? -0.1 : 0.1)) })
    }
  }

  return (
    <div className="jd-framer">
      <div
        ref={frameRef}
        className="jd-framer-frame"
        style={{ aspectRatio: aspect }}
        role="group"
        tabIndex={0}
        aria-label={`${label}: crop`}
        aria-describedby={hintId}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <img src={src} alt="" draggable={false} style={framedStyle(framing)} />
      </div>
      <p id={hintId} className="jd-field-hint">
        Drag the photo to choose what stays in view. On a keyboard, use the arrow keys, and + or − to zoom.
      </p>
      <div className="jd-framer-controls">
        <label className="jd-framer-zoom">
          <span className="jd-field-label">Zoom</span>
          <input
            type="range"
            min="1"
            max={MAX_ZOOM}
            step="0.05"
            value={framing.zoom}
            onChange={(event) => set({ zoom: clampZoom(Number(event.target.value)) })}
            aria-valuetext={`${Math.round(framing.zoom * 100)}%`}
          />
        </label>
        <button type="button" className="jd-admin-button jd-admin-button--sm jd-admin-button--quiet" disabled={!changed}
          onClick={() => onChange(DEFAULT_FRAMING)}>
          Reset
        </button>
      </div>
    </div>
  )
}

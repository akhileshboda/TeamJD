import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PREVIEW_MESSAGE, PREVIEW_READY } from '../../hooks/useContent'

const DEVICES = {
  phone: { label: 'Phone', width: 390, height: 844 },
  desktop: { label: 'Desktop', width: 1280, height: 860 },
}

function withPreviewFlag(path) {
  return `${path}${path.includes('?') ? '&' : '?'}cmsPreview=1`
}

// The real public page in an iframe, scaled to fit, with the editor's draft
// posted into it (see hooks/useContent.js). `collections` maps a public
// collection name to the list it should show.
export default function PreviewFrame({ path, collections, title = 'Preview', note }) {
  const [device, setDevice] = useState('phone')
  const [scale, setScale] = useState(1)
  const stageRef = useRef(null)
  const frameRef = useRef(null)
  const latest = useRef(collections)
  const size = DEVICES[device]

  latest.current = collections

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const fit = () => setScale(Math.min(1, stage.clientWidth / size.width))
    fit()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null
    observer?.observe(stage)
    return () => observer?.disconnect()
  }, [size.width])

  const post = () => {
    const target = frameRef.current?.contentWindow
    if (target && latest.current) {
      target.postMessage({ type: PREVIEW_MESSAGE, collections: latest.current }, window.location.origin)
    }
  }

  useEffect(post, [collections])

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin === window.location.origin && event.data?.type === PREVIEW_READY
        && event.source === frameRef.current?.contentWindow) post()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <section className="jd-preview" aria-label="Live preview">
      <div className="jd-preview-head">
        <p className="jd-preview-title">{title}</p>
        <div className="jd-segmented" role="group" aria-label="Preview size">
          {Object.entries(DEVICES).map(([key, info]) => (
            <button key={key} type="button" aria-pressed={device === key} onClick={() => setDevice(key)}>
              {info.label}
            </button>
          ))}
        </div>
      </div>
      {note && <p className="jd-preview-note">{note}</p>}
      <div className="jd-preview-stage" ref={stageRef} style={{ height: Math.round(size.height * scale) }}>
        {path ? (
          <iframe
            ref={frameRef}
            key={`${device}:${path}`}
            title={`${title}, ${size.label.toLowerCase()} size`}
            src={withPreviewFlag(path)}
            width={size.width}
            height={size.height}
            style={{ transform: `scale(${scale})` }}
            onLoad={post}
          />
        ) : null}
      </div>
    </section>
  )
}

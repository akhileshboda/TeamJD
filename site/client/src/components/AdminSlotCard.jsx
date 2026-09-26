import { useId, useRef, useState } from 'react'
import { adminRequest, uploadMedia } from '../utils/adminApi'

const ACCEPT = {
  image: 'image/jpeg,image/png,image/webp,image/avif',
  video: 'video/mp4,video/quicktime,video/webm,.m4v',
}

function Preview({ slot, version }) {
  const src = version ? (version.kind === 'video' ? version.posterUrl : version.url) : slot.defaultUrl
  if (version?.kind === 'video') {
    return <video className="admin-slot-preview" src={version.url} poster={src} muted controls preload="none" />
  }
  if (!src) return <div className="admin-slot-preview admin-slot-preview--empty">Empty spot</div>
  return <img className="admin-slot-preview" src={src} alt="" loading="lazy" decoding="async" />
}

function progressLabel(progress) {
  if (!progress) return ''
  if (progress.phase === 'processing') return 'Optimising for the web…'
  return `Uploading… ${Math.round(progress.fraction * 100)}%`
}

export default function AdminSlotCard({ slot, onChange }) {
  const inputRef = useRef(null)
  const altId = useId()
  const [progress, setProgress] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [alt, setAlt] = useState(slot.current?.alt ?? '')
  const [showHistory, setShowHistory] = useState(false)
  const { current, history } = slot
  const isImage = slot.kind === 'image'
  const looksSmall = isImage && current?.width && slot.minWidth && current.width < slot.minWidth

  async function run(action, successMessage) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const entry = await action()
      onChange(slot.id, entry)
      setAlt(entry.current?.alt ?? '')
      setNotice(successMessage)
    } catch (caught) {
      setError(caught.message)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    run(async () => {
      const job = await uploadMedia(slot.id, file, { onProgress: setProgress })
      return job.entry
    }, isImage ? 'Your photo is live. Add a short description below.' : 'Your video is live.')
  }

  const post = (path, json) => adminRequest(`/api/admin/slots/${slot.id}/${path}`, { method: 'POST', json })

  return (
    <article className="admin-slot" aria-busy={busy}>
      <div className="admin-slot-media">
        <Preview slot={slot} version={current} />
        <span className={`admin-slot-badge${current ? ' is-custom' : ''}`}>{current ? 'Your upload' : 'Original'}</span>
      </div>

      <div className="admin-slot-body">
        <h3>{slot.label}</h3>
        <p className="admin-slot-hint">{slot.hint}</p>

        <div className="admin-slot-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => inputRef.current?.click()}>
            {isImage ? 'Replace photo' : 'Replace video'}
          </button>
          <input ref={inputRef} type="file" accept={ACCEPT[slot.kind]} hidden onChange={handleFile} />
          {current && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => run(() => post('reset'), 'The original is back. Your upload is kept in the history.')}
            >
              Use original
            </button>
          )}
        </div>

        {progress && (
          <div className="admin-slot-progress" role="status">
            <span style={{ '--progress': progress.phase === 'processing' ? 1 : progress.fraction }} />
            {progressLabel(progress)}
          </div>
        )}
        {error && <p className="admin-slot-error" role="alert">{error}</p>}
        {notice && !error && <p className="admin-slot-notice" role="status">{notice}</p>}
        {looksSmall && (
          <p className="admin-slot-warning">
            This photo is {current.width}px wide, smaller than recommended, so it may look soft on big screens.
          </p>
        )}

        {isImage && current && (
          <form
            className="admin-slot-alt"
            onSubmit={(event) => {
              event.preventDefault()
              run(
                () => adminRequest(`/api/admin/slots/${slot.id}/alt`, { method: 'PUT', json: { alt } }),
                'Description saved.',
              )
            }}
          >
            <label htmlFor={altId}>Describe the photo for screen readers and Google</label>
            <div>
              <input
                id={altId}
                value={alt}
                maxLength={300}
                placeholder="e.g. Jake coaching a client through a posing routine"
                onChange={(event) => setAlt(event.target.value)}
              />
              <button type="submit" className="btn btn-secondary" disabled={busy || alt === (current.alt ?? '')}>
                Save
              </button>
            </div>
          </form>
        )}

        {history.length > 0 && (
          <div className="admin-slot-history">
            <button type="button" className="admin-link" aria-expanded={showHistory} onClick={() => setShowHistory((open) => !open)}>
              {showHistory ? 'Hide' : 'Show'} earlier versions ({history.length})
            </button>
            {showHistory && (
              <ul>
                {history.map((version) => (
                  <li key={version.assetKey}>
                    <img src={version.kind === 'video' ? version.posterUrl : version.url} alt="" loading="lazy" />
                    <span>{new Date(version.uploadedAt).toLocaleDateString()}</span>
                    <button
                      type="button"
                      className="admin-link"
                      disabled={busy}
                      onClick={() => run(() => post('restore', { assetKey: version.assetKey }), 'Earlier version restored.')}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

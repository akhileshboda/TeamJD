import { useEffect, useId, useMemo, useRef, useState } from 'react'
import JourneyIcon from '../../components/JourneyIcon'
import { listMedia } from '../api'
import MediaUploader from './MediaUploader'

export function MediaThumb({ asset, size = 'md' }) {
  if (!asset) return <span className={`jd-thumb jd-thumb--${size} is-empty`}><JourneyIcon name="image" size={18} /></span>
  return (
    <span className={`jd-thumb jd-thumb--${size}`}>
      <img src={asset.kind === 'video' ? asset.posterUrl : asset.url} alt="" loading="lazy" />
      {asset.kind === 'video' && <span className="jd-thumb-badge">Video</span>}
    </span>
  )
}

// Choose a photo or video from the library, or upload a new one (which is then
// selected). Resolves with the chosen asset through onPick.
export default function MediaPicker({ kind, title, currentId, onPick, onClose }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(currentId || null)
  const titleId = useId()
  const closeRef = useRef(null)

  useEffect(() => {
    listMedia()
      .then((body) => setItems(body.items.filter((asset) => asset.kind === kind)))
      .catch((failure) => setError(failure.message))
  }, [kind])

  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus()
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (items || []).filter((asset) => !needle || `${asset.originalName} ${asset.alt}`.toLowerCase().includes(needle))
  }, [items, query])

  const chosen = items?.find((asset) => asset.id === selected)

  return (
    <div className="jd-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="jd-dialog jd-picker" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="jd-picker-head">
          <h2 id={titleId} className="jd-dialog-title">{title}</h2>
          <button ref={closeRef} type="button" className="jd-admin-icon-button" aria-label="Close" onClick={onClose}>
            <JourneyIcon name="close" size={20} />
          </button>
        </div>

        <MediaUploader
          kinds={[kind]}
          multiple={false}
          compact
          onUploaded={(asset) => {
            setItems((current) => [{ ...asset, usage: [] }, ...(current || [])])
            setSelected(asset.id)
          }}
        />

        <label className="jd-search jd-picker-search">
          <JourneyIcon name="search" size={16} />
          <span className="visually-hidden">Search the library</span>
          <input className="jd-input" type="search" placeholder="Search by file name or description" value={query}
            spellCheck={false} onChange={(event) => setQuery(event.target.value)} />
        </label>

        {error && <p className="jd-admin-error" role="alert">{error}</p>}
        {!items && !error && <div className="jd-skeleton jd-skeleton--picker" role="status" aria-label="Loading library" />}
        {items && visible.length === 0 && (
          <p className="jd-panel-empty jd-picker-empty">
            {items.length ? 'Nothing matches that search.' : `No ${kind === 'video' ? 'videos' : 'photos'} in your library yet. Upload one above.`}
          </p>
        )}

        <div className="jd-picker-grid" role="listbox" aria-label="Library">
          {visible.map((asset) => (
            <button
              key={asset.id}
              type="button"
              role="option"
              aria-selected={selected === asset.id}
              className={`jd-picker-tile${selected === asset.id ? ' is-selected' : ''}`}
              onClick={() => setSelected(asset.id)}
              onDoubleClick={() => onPick(asset)}
            >
              <MediaThumb asset={asset} size="fill" />
              <span className="jd-picker-name">{asset.alt || asset.originalName}</span>
            </button>
          ))}
        </div>

        <div className="jd-dialog-actions">
          <button type="button" className="jd-admin-button" onClick={onClose}>Cancel</button>
          <button type="button" className="jd-admin-button jd-admin-button--primary" disabled={!chosen} onClick={() => onPick(chosen)}>
            {kind === 'video' ? 'Use this video' : 'Use this photo'}
          </button>
        </div>
      </div>
    </div>
  )
}

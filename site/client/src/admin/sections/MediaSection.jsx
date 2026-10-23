import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import JourneyIcon from '../../components/JourneyIcon'
import { deleteMedia, listMedia, updateMedia } from '../api'
import { adminLinkFor } from '../links'
import { TextField } from '../components/fields'
import MediaUploader from '../components/MediaUploader'
import { MediaThumb } from '../components/MediaPicker'
import { useToast } from '../components/Toasts'
import { ConfirmDialog, timeAgo } from '../components/ui'

const FILTERS = [
  { value: '', label: 'Everything' },
  { value: 'image', label: 'Photos' },
  { value: 'video', label: 'Videos' },
  { value: 'unused', label: 'Not used anywhere' },
]

function sizeLabel(bytes) {
  if (!bytes) return ''
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

function AssetDetail({ asset, onChanged, onDeleted, onClose }) {
  const [alt, setAlt] = useState(asset.alt)
  const toast = useToast()
  const notify = (message) => toast({ ...message, scope: 'media' })
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const headingRef = useRef(null)

  // On phones this is a sheet over the grid: move focus into it, and let Escape
  // close it (unless the delete confirmation is the thing being dismissed).
  useEffect(() => {
    headingRef.current?.focus()
  }, [asset.id])

  useEffect(() => {
    if (confirming) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirming, onClose])

  useEffect(() => {
    setAlt(asset.alt)
  }, [asset.id, asset.alt])

  const saveAlt = async () => {
    setBusy(true)
    try {
      onChanged(await updateMedia(asset.id, alt))
      notify({ tone: 'notice', text: 'Description saved.' })
    } catch (error) {
      notify({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteMedia(asset.id)
      onDeleted(asset.id)
    } catch (error) {
      notify({ tone: 'error', text: error.message })
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <aside className="jd-asset-detail" aria-label="File details">
      <div className="jd-asset-detail-head">
        <h2 ref={headingRef} className="jd-panel-title" tabIndex={-1}>{asset.originalName}</h2>
        <button type="button" className="jd-admin-icon-button" aria-label="Close details" onClick={onClose}>
          <JourneyIcon name="close" size={18} />
        </button>
      </div>
      <div className="jd-asset-preview">
        {asset.kind === 'video'
          ? <video src={asset.url} poster={asset.posterUrl} controls muted playsInline preload="metadata" />
          : <img src={asset.url} alt={asset.alt} />}
      </div>
      <dl className="jd-asset-facts">
        <div><dt>Size</dt><dd>{asset.width} × {asset.height} px · {sizeLabel(asset.bytes)}</dd></div>
        {asset.duration ? <div><dt>Length</dt><dd>{asset.duration} seconds</dd></div> : null}
        <div><dt>Added</dt><dd>{timeAgo(asset.uploadedAt)}{asset.uploadedBy ? ` by ${asset.uploadedBy}` : ''}</dd></div>
        {asset.backup === 'failed' && <div><dt>Backup</dt><dd>The Dropbox copy failed. The file is still safe online.</dd></div>}
      </dl>
      {asset.kind === 'image' && (
        <div className="jd-asset-alt">
          <TextField label="Description" hint="Filled in for you when you choose this photo for a page."
            value={alt} maxLength={300} onChange={setAlt} />
          <button type="button" className="jd-admin-button jd-admin-button--sm" disabled={busy || alt === asset.alt} onClick={saveAlt}>
            Save description
          </button>
        </div>
      )}
      <div className="jd-asset-usage">
        <h3>Used in</h3>
        {asset.usage.length ? (
          <ul>
            {asset.usage.map((use) => (
              <li key={`${use.collection}:${use.id}`}><Link to={adminLinkFor(use.collection, use.id)}>{use.title}</Link></li>
            ))}
          </ul>
        ) : <p className="jd-panel-empty">Not used anywhere yet.</p>}
      </div>
      <button
        type="button"
        className="jd-admin-button jd-admin-button--danger"
        disabled={busy || asset.usage.length > 0}
        title={asset.usage.length ? 'Choose something else in the places above first' : undefined}
        onClick={() => setConfirming(true)}
      >
        <JourneyIcon name="trash" size={16} />
        Delete file
      </button>
      {asset.usage.length > 0 && <p className="jd-field-hint">To delete it, first choose something else in the places it is used.</p>}
      {confirming && (
        <ConfirmDialog title="Delete this file?" confirmLabel="Delete file" tone="danger" busy={busy}
          onConfirm={remove} onCancel={() => setConfirming(false)}>
          <p>It is removed from your library for good. This cannot be undone.</p>
        </ConfirmDialog>
      )}
    </aside>
  )
}

export default function MediaSection() {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const filter = params.get('show') || ''
  const selectedId = params.get('file')

  const load = useCallback(() => listMedia().then((body) => setItems(body.items)).catch((failure) => setError(failure.message)), [])
  useEffect(() => {
    load()
  }, [load])

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const closeDetail = () => {
    const id = params.get('file')
    setParam('file', '')
    requestAnimationFrame(() => document.querySelector(`[data-asset="${CSS.escape(id || '')}"]`)?.focus())
  }

  const visible = useMemo(() => (items || []).filter((asset) => {
    if (filter === 'unused') return asset.usage.length === 0
    return !filter || asset.kind === filter
  }), [items, filter])
  const selected = items?.find((asset) => asset.id === selectedId) || null

  return (
    <div className="jd-media-page">
      <div className="jd-list-head">
        <div>
          <h1 className="jd-page-title">Media library</h1>
          <p className="jd-page-lede">Every photo and video you have uploaded. Choose them for your pages and results.</p>
        </div>
      </div>

      <MediaUploader onUploaded={(asset) => setItems((current) => [{ ...asset, usage: [] }, ...(current || [])])} />

      <div className="jd-segmented jd-media-filter" role="group" aria-label="Show">
        {FILTERS.map((option) => (
          <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setParam('show', option.value)}>
            {option.label}
          </button>
        ))}
      </div>

      {error && <p className="jd-admin-error" role="alert">{error}</p>}
      {!items && !error && <div className="jd-skeleton jd-skeleton--list" role="status" aria-label="Loading library" />}
      {items && visible.length === 0 && (
        <div className="jd-empty jd-empty--inline">
          <p>{items.length ? 'Nothing here with this filter.' : 'Your library is empty. Upload your first photos above.'}</p>
        </div>
      )}

      <div className={`jd-media-layout${selected ? ' has-detail' : ''}`}>
        <ul className="jd-media-grid">
          {visible.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                data-asset={asset.id}
                className={`jd-media-tile${selected?.id === asset.id ? ' is-selected' : ''}`}
                aria-pressed={selected?.id === asset.id}
                onClick={() => setParam('file', asset.id)}
              >
                <MediaThumb asset={asset} size="fill" />
                <span className="jd-media-tile-name">{asset.alt || asset.originalName}</span>
                <span className="jd-media-tile-use">{asset.usage.length ? `Used in ${asset.usage.length}` : 'Not used'}</span>
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <AssetDetail
            asset={selected}
            onClose={closeDetail}
            onChanged={(updated) => setItems((current) => current.map((asset) => (asset.id === updated.id ? updated : asset)))}
            onDeleted={(id) => {
              setItems((current) => current.filter((asset) => asset.id !== id))
              setParam('file', '')
            }}
          />
        )}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Route, Routes, useParams } from 'react-router-dom'
import JourneyIcon from '../../components/JourneyIcon'
import { applyAction, bulkAction, getPlacements, savePlacement } from '../api'
import { TextField } from '../components/fields'
import MediaPicker, { MediaThumb } from '../components/MediaPicker'
import PreviewFrame from '../components/PreviewFrame'
import { StatusChip } from '../components/ui'

export function pageKeyOf(slot) {
  return slot.pagePath === '/' ? 'home' : slot.pagePath.split('/').pop()
}

function groupByPage(slots) {
  const pages = []
  for (const slot of slots) {
    const key = pageKeyOf(slot)
    let page = pages.find((item) => item.key === key)
    if (!page) {
      page = { key, name: slot.page, path: slot.pagePath, slots: [] }
      pages.push(page)
    }
    page.slots.push(slot)
  }
  return pages
}

// What a spot shows if its draft went live: the chosen file, or the built-in one.
function spotPreview(slot) {
  const asset = slot.record?.draft.assetId ? slot.draftAsset : null
  return asset ? { kind: asset.kind, url: asset.url, posterUrl: asset.posterUrl, alt: slot.record.draft.alt } : null
}

function spotStatus(slot) {
  if (!slot.record) return null
  return slot.record.status
}

function PageList({ pages }) {
  return (
    <div>
      <div className="jd-list-head">
        <div>
          <h1 className="jd-page-title">Pages</h1>
          <p className="jd-page-lede">Choose the photos and videos shown on each page. Changes stay as drafts until you publish them.</p>
        </div>
      </div>
      <ul className="jd-page-cards">
        {pages.map((page) => {
          const changed = page.slots.filter((slot) => ['changed', 'draft'].includes(spotStatus(slot))).length
          const custom = page.slots.filter((slot) => slot.liveAsset).length
          const cover = page.slots.find((slot) => slot.kind === 'image')
          return (
            <li key={page.key}>
              <Link to={page.key} className="jd-page-card">
                <span className="jd-page-card-image">
                  {cover && <img src={cover.liveAsset?.url || cover.builtInUrl} alt="" loading="lazy" />}
                </span>
                <span className="jd-page-card-body">
                  <strong>{page.name}</strong>
                  <span>{page.slots.length} spots · {custom ? `${custom} with your photos` : 'all built-in'}</span>
                  {changed > 0 && <span className="jd-chip jd-chip--pending">{changed} not live</span>}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Spot({ slot, onChange, busy }) {
  const [picking, setPicking] = useState(false)
  const [alt, setAlt] = useState(slot.record?.draft.alt || '')
  const altTimer = useRef(null)
  const draft = slot.record?.draft || { assetId: null, alt: '' }
  const showing = draft.assetId ? slot.draftAsset : null
  const status = spotStatus(slot)
  const small = showing?.kind === 'image' && slot.minWidth && showing.width < slot.minWidth

  useEffect(() => {
    setAlt(slot.record?.draft.alt || '')
  }, [slot.record?.draft.alt])

  const saveAlt = (value) => {
    setAlt(value)
    clearTimeout(altTimer.current)
    altTimer.current = setTimeout(() => onChange(slot, { ...draft, alt: value }), 700)
  }

  return (
    <li className="jd-spot" id={slot.id}>
      <div className="jd-spot-media">
        {showing ? <MediaThumb asset={showing} size="fill" /> : (
          <span className="jd-thumb jd-thumb--fill">
            {slot.builtInUrl ? <img src={slot.builtInUrl} alt="" loading="lazy" /> : <JourneyIcon name="image" size={18} />}
            {slot.kind === 'video' && <span className="jd-thumb-badge">Video</span>}
          </span>
        )}
      </div>
      <div className="jd-spot-body">
        <div className="jd-spot-title">
          <strong>{slot.label}</strong>
          {!draft.assetId && (!status || status === 'published')
            ? <span className="jd-chip jd-chip--muted">Built-in</span>
            : <StatusChip status={status} />}
        </div>
        <p className="jd-field-hint">{slot.hint}</p>
        {small && <p className="jd-spot-warning">This photo is {showing.width} px wide; at least {slot.minWidth} px looks sharper.</p>}
        {showing?.kind === 'image' && (
          <TextField label="Description" value={alt} maxLength={300} onChange={saveAlt}
            hint="What the photo shows, for people using screen readers." />
        )}
        <div className="jd-spot-actions">
          <button type="button" className="jd-admin-button jd-admin-button--sm" disabled={busy} onClick={() => setPicking(true)}>
            {slot.kind === 'video' ? 'Choose video' : 'Choose photo'}
          </button>
          {draft.assetId && (
            <button type="button" className="jd-admin-button jd-admin-button--sm jd-admin-button--quiet" disabled={busy}
              onClick={() => onChange(slot, { assetId: null, alt: '' })}>
              Use the built-in {slot.kind === 'video' ? 'video' : 'photo'}
            </button>
          )}
          {status === 'changed' && (
            <button type="button" className="jd-admin-button jd-admin-button--sm jd-admin-button--quiet" disabled={busy}
              onClick={() => onChange(slot, null, 'discard')}>
              Undo change
            </button>
          )}
        </div>
      </div>
      {picking && (
        <MediaPicker
          kind={slot.kind}
          title={`${slot.kind === 'video' ? 'Choose a video' : 'Choose a photo'}: ${slot.label}`}
          currentId={draft.assetId}
          onClose={() => setPicking(false)}
          onPick={(asset) => {
            setPicking(false)
            onChange(slot, { assetId: asset.id, alt: draft.assetId === asset.id ? draft.alt : asset.alt })
          }}
        />
      )}
    </li>
  )
}

function PageSpots({ pages, reload, setSlot }) {
  const { pageKey } = useParams()
  const page = pages.find((item) => item.key === pageKey)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)
  const [mobileView, setMobileView] = useState('edit')

  const previewSlots = useMemo(() => {
    if (!page) return null
    const map = {}
    for (const slot of pages.flatMap((item) => item.slots)) {
      const shown = slot.record?.draft.assetId ? spotPreview(slot) : null
      if (shown) map[slot.id] = shown
    }
    return { slots: map }
  }, [page, pages])

  if (!page) {
    return (
      <div className="jd-empty">
        <h1>Page not found</h1>
        <Link className="jd-admin-button" to="/admin/pages">Back to Pages</Link>
      </div>
    )
  }

  const pending = page.slots.filter((slot) => ['changed', 'draft'].includes(spotStatus(slot)))

  const change = async (slot, draft, action) => {
    setBusy(true)
    setBanner(null)
    try {
      if (action === 'discard') {
        await applyAction('placements', slot.id, 'discard')
      } else {
        const saved = await savePlacement(slot.id, { ...draft, rev: slot.record?.rev ?? 0 })
        setSlot(slot.id, saved)
      }
      await reload()
    } catch (error) {
      setBanner({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const publishPage = async () => {
    setBusy(true)
    try {
      const outcome = await bulkAction('placements', 'publish', pending.map((slot) => slot.id))
      const label = (id) => page.slots.find((slot) => slot.id === id)?.label || id
      const problems = outcome.failed.map((item) => `${label(item.id)}: ${Object.values(item.fields || {}).join(' ') || item.error}`)
      setBanner(outcome.failed.length
        ? { tone: 'error', text: `Published ${outcome.done.length}. Not published yet: ${problems.join('; ')}` }
        : { tone: 'notice', text: `Published ${outcome.done.length}. They are live on the ${page.name} page now.` })
      await reload()
    } catch (error) {
      setBanner({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="jd-editor jd-page-spots">
      <div className="jd-editor-head">
        <Link className="jd-back" to="/admin/pages"><JourneyIcon name="arrowLeft" size={16} />Pages</Link>
        <div className="jd-editor-title-row">
          <h1 className="jd-page-title">{page.name}</h1>
        </div>
      </div>
      {banner && <div className={banner.tone === 'error' ? 'jd-admin-error' : 'jd-admin-notice'} role={banner.tone === 'error' ? 'alert' : 'status'}>{banner.text}</div>}

      <div className="jd-segmented jd-editor-switch" role="group" aria-label="Show">
        <button type="button" aria-pressed={mobileView === 'edit'} onClick={() => setMobileView('edit')}>Spots</button>
        <button type="button" aria-pressed={mobileView === 'preview'} onClick={() => setMobileView('preview')}>Preview</button>
      </div>

      <div className={`jd-editor-body is-showing-${mobileView}`}>
        <ul className="jd-editor-form jd-spots">
          {page.slots.map((slot) => <Spot key={slot.id} slot={slot} onChange={change} busy={busy} />)}
        </ul>
        <div className="jd-editor-preview">
          <PreviewFrame path={page.path} collections={previewSlots} title="Live preview" note={`The ${page.name} page with your changes.`} />
        </div>
      </div>

      <div className="jd-publish-bar" role="region" aria-label="Publishing">
        <p className="jd-publish-bar-status">
          <span className={`jd-dot jd-dot--${pending.length ? 'pending' : 'live'}`} aria-hidden="true" />
          <strong>{pending.length ? `${pending.length} ${pending.length === 1 ? 'change' : 'changes'} on this page not live yet.` : 'Everything on this page is live.'}</strong>
        </p>
        <div className="jd-publish-bar-actions">
          <button type="button" className="jd-admin-button jd-admin-button--primary" disabled={busy || !pending.length} onClick={publishPage}>
            {busy ? 'Working…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PagesSection() {
  const [slots, setSlots] = useState(null)
  const [error, setError] = useState('')

  const reload = useCallback(() => getPlacements()
    .then((body) => {
      setSlots(body.slots)
      setError('')
    })
    .catch((failure) => setError(failure.message)), [])

  useEffect(() => {
    reload()
  }, [reload])

  // Show a saved draft straight away; the reload that follows fills in assets.
  const setSlot = (slotId, saved) => setSlots((current) => current.map((slot) => (slot.id === slotId
    ? { ...slot, record: { ...slot.record, rev: saved.rev, draft: saved.draft, status: saved.status } }
    : slot)))

  const pages = useMemo(() => groupByPage(slots || []), [slots])

  if (error) return <p className="jd-admin-error" role="alert">{error}</p>
  if (!slots) return <div className="jd-skeleton jd-skeleton--list" role="status" aria-label="Loading pages" />

  return (
    <Routes>
      <Route index element={<PageList pages={pages} />} />
      <Route path=":pageKey" element={<PageSpots pages={pages} reload={reload} setSlot={setSlot} />} />
    </Routes>
  )
}

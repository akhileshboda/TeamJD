import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Route, Routes, useParams } from 'react-router-dom'
import JourneyIcon from '../../components/JourneyIcon'
import { applyAction, bulkAction, getPlacements, savePlacement } from '../api'
import { TextField } from '../components/fields'
import ImageFramer, { DEFAULT_FRAMING } from '../components/ImageFramer'
import MediaPicker, { MediaThumb } from '../components/MediaPicker'
import PreviewFrame from '../components/PreviewFrame'
import { useToast } from '../components/Toasts'
import { Chip } from '../components/ui'

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
  if (!asset) return null
  const { alt, focus, zoom } = slot.record.draft
  return { kind: asset.kind, url: asset.url, posterUrl: asset.posterUrl, alt, focus, zoom }
}

// The parts of a spot Jake adjusts in place (description and crop); they save
// after a pause rather than on every keystroke or drag.
function adjustable(draft) {
  return { alt: draft?.alt || '', focus: draft?.focus || DEFAULT_FRAMING.focus, zoom: draft?.zoom || 1 }
}

function spotStatus(slot) {
  if (!slot.record) return null
  return slot.record.status
}

// A page always shows an image, so a page image is never offline: a draft one
// (just chosen) or a changed one is simply an unpublished change.
const isUnpublished = (slot) => ['changed', 'draft'].includes(spotStatus(slot))

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
          const changed = page.slots.filter(isUnpublished).length
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
                  <span>{page.slots.length} images · {custom ? `${custom} replaced` : 'all built-in'}</span>
                  {changed > 0 && <span className="jd-chip jd-chip--pending">{changed} unpublished</span>}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SpotThumb({ slot, showing, framing }) {
  const style = { aspectRatio: slot.aspect || '4 / 3' }
  if (showing?.kind === 'image') {
    const position = `${framing.focus.x}% ${framing.focus.y}%`
    return (
      <span className="jd-thumb jd-thumb--spot" style={style}>
        <img src={showing.url} alt="" loading="lazy"
          style={{ objectPosition: position, transform: `scale(${framing.zoom})`, transformOrigin: position }} />
      </span>
    )
  }
  if (showing) return <MediaThumb asset={showing} size="fill" />
  return (
    <span className="jd-thumb jd-thumb--spot" style={style}>
      {slot.builtInUrl ? <img src={slot.builtInUrl} alt="" loading="lazy" /> : <JourneyIcon name="image" size={18} />}
      {slot.kind === 'video' && <span className="jd-thumb-badge">Video</span>}
    </span>
  )
}

function Spot({ slot, onChange, scheduleSave, cancelPending, onFocusSpot, onPreview, busy }) {
  const [picking, setPicking] = useState(false)
  const [cropping, setCropping] = useState(false)
  const draft = slot.record?.draft || { assetId: null, alt: '' }
  const [local, setLocal] = useState(() => adjustable(draft))
  // Edits made here that the server has not confirmed yet. While any are
  // outstanding, a reload must not replace what Jake is typing or dragging.
  const versions = useRef({ made: 0, saved: 0 })
  const showing = draft.assetId ? slot.draftAsset : null
  const status = spotStatus(slot)
  const small = showing?.kind === 'image' && slot.minWidth && showing.width < slot.minWidth
  const serverKey = JSON.stringify(adjustable(draft))

  useEffect(() => {
    if (versions.current.made === versions.current.saved) setLocal(JSON.parse(serverKey))
  }, [serverKey])

  const adjust = (patch) => {
    const next = { ...local, ...patch }
    setLocal(next)
    onPreview(slot.id, next)
    const version = ++versions.current.made
    scheduleSave(slot, { ...draft, ...next }, () => {
      versions.current.saved = Math.max(versions.current.saved, version)
    })
  }

  // Choosing a photo replaces the whole spot, so a save still waiting would put
  // the old photo back.
  const replace = (next) => {
    cancelPending(slot.id)
    versions.current.saved = versions.current.made
    onPreview(slot.id, null)
    setCropping(false)
    onChange(slot, next)
  }

  return (
    <li className="jd-spot" id={slot.id} onFocusCapture={() => onFocusSpot(slot.id)}>
      <div className="jd-spot-media">
        <SpotThumb slot={slot} showing={showing} framing={local} />
      </div>
      <div className="jd-spot-body">
        <div className="jd-spot-title">
          <strong>{slot.label}</strong>
          {isUnpublished(slot)
            ? <Chip kind="changes" />
            : <span className="jd-chip jd-chip--muted">{draft.assetId ? `Your ${slot.kind === 'video' ? 'video' : 'photo'}` : 'Built-in'}</span>}
        </div>
        <p className="jd-field-hint">{slot.kind === 'video' ? slot.hint : 'Any photo works. Choose one, then drag it to choose what stays in view.'}</p>
        {small && <p className="jd-spot-warning">This photo is {showing.width} px wide, so it may look soft on large screens. {slot.minWidth} px or wider looks sharpest.</p>}
        <div className="jd-spot-actions">
          <button type="button" className="jd-admin-button jd-admin-button--sm" disabled={busy} onClick={() => setPicking(true)}>
            {slot.kind === 'video' ? 'Choose video' : 'Choose photo'}
          </button>
          {showing?.kind === 'image' && (
            <button type="button" className="jd-admin-button jd-admin-button--sm" aria-expanded={cropping}
              onClick={() => setCropping(!cropping)}>
              {cropping ? 'Done cropping' : 'Adjust crop'}
            </button>
          )}
          {draft.assetId && (
            <button type="button" className="jd-admin-button jd-admin-button--sm jd-admin-button--quiet" disabled={busy}
              onClick={() => replace({ assetId: null, alt: '' })}>
              Use the built-in {slot.kind === 'video' ? 'video' : 'photo'}
            </button>
          )}
          {status === 'changed' && (
            <button type="button" className="jd-admin-button jd-admin-button--sm jd-admin-button--quiet" disabled={busy}
              onClick={() => { cancelPending(slot.id); versions.current.saved = versions.current.made; onChange(slot, null, 'discard') }}>
              Discard changes
            </button>
          )}
        </div>
        {cropping && showing?.kind === 'image' && (
          <ImageFramer src={showing.url} aspect={slot.aspect} label={slot.label}
            value={{ focus: local.focus, zoom: local.zoom }} onChange={(framing) => adjust(framing)} />
        )}
        {showing?.kind === 'image' && (
          <TextField label="Description" required value={local.alt} maxLength={300} onChange={(alt) => adjust({ alt })}
            hint="What the photo shows, for people using screen readers." />
        )}
      </div>
      {picking && (
        <MediaPicker
          kind={slot.kind}
          title={`${slot.kind === 'video' ? 'Choose a video' : 'Choose a photo'}: ${slot.label}`}
          currentId={draft.assetId}
          onClose={() => setPicking(false)}
          onPick={(asset) => {
            setPicking(false)
            replace(draft.assetId === asset.id ? { ...draft, ...local } : { assetId: asset.id, alt: asset.alt })
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
  const toast = useToast()
  const notify = (message) => toast({ ...message, scope: `pages:${pageKey}` })
  const [mobileView, setMobileView] = useState('edit')
  // Saves run one at a time and each sends the newest rev the server gave back,
  // so quick edits to a spot never trip the "changed in another tab" check.
  const revs = useRef({})
  const queue = useRef(Promise.resolve())
  const pendingSaves = useRef(new Map())
  const [section, setSection] = useState(null)
  const saved = useRef(new Set())
  const bodyRef = useRef(null)
  const showMobileView = (view) => {
    setMobileView(view)
    requestAnimationFrame(() => bodyRef.current?.scrollIntoView({ block: 'start' }))
  }

  useEffect(() => {
    for (const slot of pages.flatMap((item) => item.slots)) {
      revs.current[slot.id] = Math.max(revs.current[slot.id] ?? 0, slot.record?.rev ?? 0)
    }
  }, [pages])

  useEffect(() => () => {
    for (const { timer } of pendingSaves.current.values()) clearTimeout(timer)
  }, [])

  // Descriptions and crops being edited show in the preview straight away, ahead
  // of their (delayed) save.
  const [localEdits, setLocalEdits] = useState({})
  const previewEdit = useCallback((slotId, edit) => {
    setLocalEdits((current) => ({ ...current, [slotId]: edit }))
  }, [])

  const previewSlots = useMemo(() => {
    if (!page) return null
    const map = {}
    for (const slot of pages.flatMap((item) => item.slots)) {
      const shown = slot.record?.draft.assetId ? spotPreview(slot) : null
      if (shown) map[slot.id] = { ...shown, ...localEdits[slot.id] }
    }
    return { slots: map }
  }, [page, pages, localEdits])

  if (!page) {
    return (
      <div className="jd-empty">
        <h1>Page not found</h1>
        <Link className="jd-admin-button" to="/admin/pages">Back to Pages</Link>
      </div>
    )
  }

  const pending = page.slots.filter(isUnpublished)

  const change = (slot, draft, action) => {
    queue.current = queue.current.then(async () => {
      setBusy(true)
      try {
        if (action === 'discard') {
          await applyAction('placements', slot.id, 'discard')
        } else {
          const record = await savePlacement(slot.id, { ...draft, rev: revs.current[slot.id] ?? 0 })
          revs.current[slot.id] = record.rev
          saved.current.add(slot.id)
          setSlot(slot.id, record)
        }
        await reload()
      } catch (error) {
        notify({ tone: 'error', text: error.message })
      } finally {
        setBusy(false)
      }
    })
    return queue.current
  }

  const cancelPending = (id) => {
    clearTimeout(pendingSaves.current.get(id)?.timer)
    pendingSaves.current.delete(id)
  }
  // `onSettled` tells the spot its edit reached the server (or failed), so it
  // may take the server's values again.
  const scheduleSave = (slot, draft, onSettled) => {
    cancelPending(slot.id)
    const run = () => {
      pendingSaves.current.delete(slot.id)
      return change(slot, draft).finally(onSettled)
    }
    pendingSaves.current.set(slot.id, { timer: setTimeout(run, 600), run })
  }
  const flushPending = () => Promise.all([...pendingSaves.current.values()].map(({ timer, run }) => {
    clearTimeout(timer)
    return run()
  }))

  const publishPage = async () => {
    await flushPending()
    await queue.current
    // Spots saved since this render (the flush above) count as pending too.
    const ids = page.slots.map((slot) => slot.id)
      .filter((id) => saved.current.has(id) || pending.some((slot) => slot.id === id))
    saved.current.clear()
    setBusy(true)
    try {
      const outcome = await bulkAction('placements', 'publish', ids)
      const label = (id) => page.slots.find((slot) => slot.id === id)?.label || id
      const problems = outcome.failed.map((item) => `${label(item.id)}: ${Object.values(item.fields || {}).join(' ') || item.error}`)
      notify(outcome.failed.length
        ? { tone: 'error', text: `Published ${outcome.done.length}. Not published yet: ${problems.join('; ')}` }
        : { tone: 'notice', text: `Changes published. They are live on the ${page.name} page now.` })
      await reload()
    } catch (error) {
      notify({ tone: 'error', text: error.message })
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
      {/* Before the preview so keyboard users reach Publish first. On phones it
          is fixed to the bottom of the screen. */}
      <div className="jd-publish-bar" role="region" aria-label="Publishing">
        <div className="jd-publish-bar-status">
          <span className={`jd-dot jd-dot--${pending.length ? 'pending' : 'live'}`} aria-hidden="true" />
          <p className="jd-publish-bar-text">
            <strong>{pending.length ? `${pending.length} unpublished ${pending.length === 1 ? 'change' : 'changes'} on this page.` : 'Everything on this page is live.'}</strong>
            <span className="jd-publish-bar-where">Shows on the {page.name} page. Changes save as you go and go live when you publish them.</span>
          </p>
        </div>
        <div className="jd-publish-bar-actions">
          <button type="button" className="jd-admin-button jd-admin-button--primary" disabled={busy || !pending.length} onClick={publishPage}>
            {busy ? 'Working…' : 'Publish changes'}
          </button>
        </div>
      </div>

      <div className="jd-segmented jd-editor-switch" role="group" aria-label="Show">
        <button type="button" aria-pressed={mobileView === 'edit'} onClick={() => showMobileView('edit')}>Images</button>
        <button type="button" aria-pressed={mobileView === 'preview'} onClick={() => showMobileView('preview')}>Preview</button>
      </div>

      <div ref={bodyRef} className={`jd-editor-body is-showing-${mobileView}`}>
        <ul className="jd-editor-form jd-spots">
          {page.slots.map((slot) => (
            <Spot key={slot.id} slot={slot} onChange={change} scheduleSave={scheduleSave} cancelPending={cancelPending}
              onFocusSpot={setSection} onPreview={previewEdit} busy={busy} />
          ))}
        </ul>
        <div className="jd-editor-preview">
          <PreviewFrame path={page.path} collections={previewSlots} section={section} title="Live preview" note={`The ${page.name} page with your changes.`} />
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

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import JourneyIcon from '../../components/JourneyIcon'
import { applyAction, deleteItem, getItem, previewItem, saveDraft, SIGNED_IN_EVENT } from '../api'
import { focusFirstError, PreviewSectionContext } from './fields'
import PreviewFrame from './PreviewFrame'
import { useToast } from './Toasts'
import { ConfirmDialog, hasUnpublishedChanges, isLive, LiveSwitch, StatusChips, timeAgo } from './ui'

const SAVE_DELAY_MS = 800
const PREVIEW_DELAY_MS = 200

const STATE_TEXT = {
  published: 'Live.',
  changed: 'Live, with unpublished changes.',
  draft: 'Offline.',
  hidden: 'Offline.',
}

// "a", "a and b", "a, b and c"
function listPlaces(places) {
  return places.length > 1 ? `${places.slice(0, -1).join(', ')} and ${places.at(-1)}` : places[0]
}

// Where the item appears on the site, said for its current state. The switch
// sentence only applies to items that can be taken offline.
function whereText(places, live, canHide) {
  if (!places?.length) return ''
  if (live || !canHide) return `Shows on ${listPlaces(places)}.`
  return `Switch on Live to show it on ${listPlaces(places)}.`
}

// One record of a collection: a form on the left, the real page on the right.
// Every change autosaves. The Live switch puts the item on the site or takes it
// offline; while it is live, edits wait as unpublished changes until Publish
// changes.
// `siteLocation(draft)` lists the places on the site the item shows.
export default function RecordEditor({
  collection,
  id,
  backTo,
  backLabel,
  noun,
  titleOf,
  previewPath,
  previewNote,
  siteLocation,
  renderFields,
  renderAside,
  canHide = true,
  canDelete = true,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const notify = useCallback((message) => toast({ ...message, scope: `editor:${collection}:${id}` }), [toast, collection, id])
  const [record, setRecord] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saveState, setSaveState] = useState('saved')
  // The list's switch can send Jake here with the fields it found missing.
  const [errors, setErrors] = useState(() => location.state?.fieldErrors || {})
  const [preview, setPreview] = useState(null)
  const [confirm, setConfirm] = useState(null)
  // The action running (publish, unpublish, discard, delete), or ''.
  const [busy, setBusy] = useState('')
  const [mobileView, setMobileView] = useState('edit')
  const [section, setSection] = useState(null)

  const revRef = useRef(0)
  const draftRef = useRef(null)
  const dirty = useRef(false)
  const saving = useRef(null)
  const saveTimer = useRef(null)
  const previewTimer = useRef(null)
  const formRef = useRef(null)
  const bodyRef = useRef(null)

  // A conflict (changed in another tab) can only be fixed by reloading.
  const notifyFailure = useCallback((error) => notify({
    tone: 'error',
    text: error.message,
    action: error.status === 409 ? { label: 'Reload', onClick: () => window.location.reload() } : undefined,
  }), [notify])

  const refreshPreview = useCallback((nextDraft) => {
    clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => {
      previewItem(collection, id, nextDraft).then(setPreview).catch(() => {})
    }, PREVIEW_DELAY_MS)
  }, [collection, id])

  useEffect(() => {
    let cancelled = false
    getItem(collection, id)
      .then((loaded) => {
        if (cancelled) return
        revRef.current = loaded.rev
        draftRef.current = loaded.draft
        setRecord(loaded)
        setDraft(loaded.draft)
        refreshPreview(loaded.draft)
        requestAnimationFrame(() => focusFirstError(formRef.current))
      })
      .catch((error) => !cancelled && setLoadError(error.message))
    return () => {
      cancelled = true
      clearTimeout(saveTimer.current)
      clearTimeout(previewTimer.current)
    }
  }, [collection, id, refreshPreview])

  // Saves the latest draft. A save requested while one is running waits for it,
  // then sends whatever is newest, so edits are never lost or sent out of order.
  // The local draft is kept as typed; the server only supplies rev and status.
  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current)
    if (saving.current) await saving.current.catch(() => {})
    if (!dirty.current) return
    dirty.current = false
    setSaveState('saving')
    saving.current = saveDraft(collection, id, draftRef.current, revRef.current)
    try {
      const saved = await saving.current
      revRef.current = saved.rev
      setRecord((current) => ({ ...saved, usage: current?.usage || [] }))
      setSaveState(dirty.current ? 'unsaved' : 'saved')
    } catch (error) {
      dirty.current = true
      // A conflict needs a reload; anything else retries on the next edit.
      setSaveState(error.status === 409 ? 'conflict' : 'error')
      notifyFailure(error)
      throw error
    } finally {
      saving.current = null
    }
  }, [collection, id, notifyFailure])

  useEffect(() => {
    if (saveState !== 'unsaved') return undefined
    saveTimer.current = setTimeout(() => flush().catch(() => {}), SAVE_DELAY_MS)
    return () => clearTimeout(saveTimer.current)
  }, [saveState, draft, flush])

  // Leaving the editor (Back, the sidebar) inside the autosave delay, or while a
  // save is running, still sends the newest draft.
  useEffect(() => () => {
    if (dirty.current) flush().catch(() => {})
  }, [flush])

  // After signing in again, retry a save the expired session refused.
  useEffect(() => {
    const retry = () => dirty.current && setSaveState((state) => (state === 'conflict' ? state : 'unsaved'))
    window.addEventListener(SIGNED_IN_EVENT, retry)
    return () => window.removeEventListener(SIGNED_IN_EVENT, retry)
  }, [])

  useEffect(() => {
    if (saveState === 'saved') return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saveState])

  const update = useCallback((patch) => {
    setDraft((current) => {
      const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch }
      draftRef.current = next
      dirty.current = true
      refreshPreview(next)
      return next
    })
    setSaveState((state) => (state === 'conflict' ? state : 'unsaved'))
  }, [refreshPreview])

  // Publishing can be refused for missing fields: show the form (phones may be
  // on the preview) and put the cursor in the first field to fix.
  const showFieldErrors = (fields) => {
    setErrors(fields)
    setMobileView('edit')
    requestAnimationFrame(() => focusFirstError(formRef.current))
  }

  // Phones switch between the form and the preview; bring the switched-to pane
  // to the top so the preview gets the whole screen.
  const showMobileView = (view) => {
    setMobileView(view)
    requestAnimationFrame(() => bodyRef.current?.scrollIntoView({ block: 'start' }))
  }

  const run = async (action) => {
    const wasLive = Boolean(record.published)
    setBusy(action)
    try {
      await flush()
      const updated = await applyAction(collection, id, action, revRef.current)
      revRef.current = updated.rev
      draftRef.current = updated.draft
      setRecord((current) => ({ ...updated, usage: current?.usage || [] }))
      setDraft(updated.draft)
      setErrors({})
      refreshPreview(updated.draft)
      const messages = {
        publish: wasLive ? 'Changes published. They are live now.' : 'Live now.',
        unpublish: 'Offline now. Your edits are kept, and going live again publishes them.',
        discard: 'Changes discarded. This is what is live.',
      }
      notify({ tone: 'notice', text: messages[action] })
    } catch (error) {
      if (error.fields) showFieldErrors(error.fields)
      notifyFailure(error)
    } finally {
      setBusy('')
      setConfirm(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    try {
      clearTimeout(saveTimer.current)
      await deleteItem(collection, id)
      navigate(backTo, { replace: true })
    } catch (error) {
      notify({ tone: 'error', text: error.message })
      setBusy('')
      setConfirm(null)
    }
  }

  if (loadError) {
    return (
      <div className="jd-empty">
        <h1>Could not open this {noun}</h1>
        <p>{loadError}</p>
        <Link className="jd-admin-button" to={backTo}>Back to {backLabel}</Link>
      </div>
    )
  }
  if (!record || !draft) return <div className="jd-skeleton jd-skeleton--editor" role="status" aria-label="Loading" />

  const status = saveState === 'saved' ? record.status : (record.published ? 'changed' : record.status)
  const live = isLive(status)
  const working = Boolean(busy)
  const saveText = {
    saving: 'Saving…',
    unsaved: 'Saving…',
    error: 'Not saved. It will try again when you make a change.',
    conflict: 'Not saved',
    saved: `Saved ${timeAgo(record.updatedAt)}`,
  }[saveState]
  // Items that cannot be taken offline (services) are always live, so they only
  // ever need Publish changes.
  const changesWaiting = hasUnpublishedChanges(status)
  const showPublish = canHide ? changesWaiting : true
  const path = previewPath?.(draft, record)

  return (
    <div className="jd-editor">
      <div className="jd-editor-head">
        <Link className="jd-back" to={backTo}>
          <JourneyIcon name="arrowLeft" size={16} />
          {backLabel}
        </Link>
        <div className="jd-editor-title-row">
          <h1 className="jd-page-title">{titleOf(draft)}</h1>
          <StatusChips status={status} />
        </div>
      </div>

      {/* Before the preview in the page order, so keyboard users reach it without
          tabbing through the whole site in the preview. On phones it is fixed to
          the bottom of the screen. */}
      <div className="jd-publish-bar" role="region" aria-label="Publishing">
        <div className="jd-publish-bar-status">
          {canHide
            ? <LiveSwitch on={live} busy={working} onChange={(on) => run(on ? 'publish' : 'unpublish')} />
            : <span className={`jd-dot jd-dot--${status === 'published' ? 'live' : 'pending'}`} aria-hidden="true" />}
          <p className="jd-publish-bar-text">
            <strong>{STATE_TEXT[status]}</strong>
            <span className="jd-publish-bar-where">{whereText(siteLocation?.(draft), live, canHide)}</span>
            <span className="jd-publish-bar-save">{saveText}</span>
          </p>
        </div>
        <div className="jd-publish-bar-actions">
          {changesWaiting && (
            <button type="button" className="jd-admin-button jd-admin-button--quiet" disabled={working} onClick={() => setConfirm('discard')}>
              <span>Discard<span className="jd-publish-bar-long"> changes</span></span>
            </button>
          )}
          {showPublish && (
            <button
              type="button"
              className="jd-admin-button jd-admin-button--primary"
              disabled={working || !changesWaiting}
              onClick={() => run('publish')}
            >
              {busy === 'publish' ? 'Publishing…' : 'Publish changes'}
            </button>
          )}
        </div>
      </div>

      <div className="jd-segmented jd-editor-switch" role="group" aria-label="Show">
        <button type="button" aria-pressed={mobileView === 'edit'} onClick={() => showMobileView('edit')}>Edit</button>
        <button type="button" aria-pressed={mobileView === 'preview'} onClick={() => showMobileView('preview')}>Preview</button>
      </div>

      <div ref={bodyRef} className={`jd-editor-body is-showing-${mobileView}`}>
        <div className="jd-editor-form" ref={formRef}>
          <PreviewSectionContext.Provider value={setSection}>
            {renderFields({ draft, update, errors, record })}
          </PreviewSectionContext.Provider>
          {renderAside?.({ draft, record })}
          {canDelete && (
            <div className="jd-danger-zone">
              <button type="button" className="jd-admin-button jd-admin-button--danger" disabled={working} onClick={() => setConfirm('delete')}>
                <JourneyIcon name="trash" size={16} />
                Delete {noun}
              </button>
            </div>
          )}
        </div>
        <div className="jd-editor-preview">
          <PreviewFrame
            path={path}
            collections={preview}
            section={section}
            title="Live preview"
            note={path ? previewNote : previewNote || 'This is not shown anywhere on the site yet.'}
          />
        </div>
      </div>

      {confirm === 'discard' && (
        <ConfirmDialog title="Discard your changes?" confirmLabel="Discard changes" tone="danger" busy={working}
          onConfirm={() => run('discard')} onCancel={() => setConfirm(null)}>
          <p>This goes back to the version that is live on the site now. Your unpublished edits are lost.</p>
        </ConfirmDialog>
      )}
      {confirm === 'delete' && (
        <ConfirmDialog title={`Delete this ${noun}?`} confirmLabel={`Delete ${noun}`} tone="danger" busy={working}
          onConfirm={remove} onCancel={() => setConfirm(null)}>
          <p>It is removed from the site and from your dashboard. This cannot be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}

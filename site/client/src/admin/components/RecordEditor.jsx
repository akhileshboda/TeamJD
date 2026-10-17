import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import JourneyIcon from '../../components/JourneyIcon'
import { applyAction, deleteItem, getItem, previewItem, saveDraft, SIGNED_IN_EVENT } from '../api'
import PreviewFrame from './PreviewFrame'
import { ConfirmDialog, StatusChip, timeAgo } from './ui'

const SAVE_DELAY_MS = 800
const PREVIEW_DELAY_MS = 350

// One record of a collection: a form on the left, the real page on the right.
// Every change autosaves as a draft; nothing reaches the site until Publish.
export default function RecordEditor({
  collection,
  id,
  backTo,
  backLabel,
  noun,
  titleOf,
  previewPath,
  previewNote,
  renderFields,
  renderAside,
  canHide = true,
  canDelete = true,
}) {
  const navigate = useNavigate()
  const [record, setRecord] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saveState, setSaveState] = useState('saved')
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [preview, setPreview] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [mobileView, setMobileView] = useState('edit')

  const revRef = useRef(0)
  const draftRef = useRef(null)
  const dirty = useRef(false)
  const saving = useRef(null)
  const saveTimer = useRef(null)
  const previewTimer = useRef(null)
  const formRef = useRef(null)

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
      setBanner({ tone: 'error', text: error.message, reload: error.status === 409 })
      throw error
    } finally {
      saving.current = null
    }
  }, [collection, id])

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
    requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
  }

  const run = async (action) => {
    setBusy(true)
    setBanner(null)
    try {
      await flush()
      const updated = await applyAction(collection, id, action, revRef.current)
      revRef.current = updated.rev
      draftRef.current = updated.draft
      setRecord((current) => ({ ...updated, usage: current?.usage || [] }))
      setDraft(updated.draft)
      setErrors({})
      refreshPreview(updated.draft)
      const messages = { publish: 'Published. It is live on the site now.', unpublish: 'Hidden from the site.', discard: 'Changes discarded.' }
      setBanner({ tone: 'notice', text: messages[action] })
    } catch (error) {
      if (error.fields) showFieldErrors(error.fields)
      setBanner({ tone: 'error', text: error.message, reload: error.status === 409 })
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      clearTimeout(saveTimer.current)
      await deleteItem(collection, id)
      navigate(backTo, { replace: true })
    } catch (error) {
      setBanner({ tone: 'error', text: error.message })
      setBusy(false)
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
  const isLive = Boolean(record.published)
  const hasChanges = status === 'changed' || status === 'draft' || status === 'hidden'
  const saveText = {
    saving: 'Saving…',
    unsaved: 'Saving…',
    error: 'Not saved. It will try again when you make a change.',
    conflict: 'Not saved',
    saved: `Saved ${timeAgo(record.updatedAt)}`,
  }[saveState]
  const liveText = status === 'published'
    ? 'Everything here is live.'
    : isLive ? 'Your changes are not live yet.' : 'Not on the site yet.'
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
          <StatusChip status={status} />
        </div>
      </div>

      {banner && (
        <div className={banner.tone === 'error' ? 'jd-admin-error' : 'jd-admin-notice'} role={banner.tone === 'error' ? 'alert' : 'status'}>
          {banner.text}
          {banner.reload && (
            <button type="button" className="jd-link-button jd-banner-action" onClick={() => window.location.reload()}>
              Reload
            </button>
          )}
        </div>
      )}

      <div className="jd-segmented jd-editor-switch" role="group" aria-label="Show">
        <button type="button" aria-pressed={mobileView === 'edit'} onClick={() => setMobileView('edit')}>Edit</button>
        <button type="button" aria-pressed={mobileView === 'preview'} onClick={() => setMobileView('preview')}>Preview</button>
      </div>

      {/* Before the preview in the page order, so keyboard users reach Publish
          without tabbing through the whole site in the preview. It is fixed to the
          bottom of the screen, so this does not move it visually. */}
      <div className="jd-publish-bar" role="region" aria-label="Publishing">
        <p className="jd-publish-bar-status">
          <span className={`jd-dot jd-dot--${status === 'published' ? 'live' : 'pending'}`} aria-hidden="true" />
          <span>
            <strong>{liveText}</strong>
            <span className="jd-publish-bar-save">{saveText}</span>
          </span>
        </p>
        <div className="jd-publish-bar-actions">
          {isLive && status === 'changed' && (
            <button type="button" className="jd-admin-button jd-admin-button--quiet" disabled={busy} onClick={() => setConfirm('discard')}>
              Discard changes
            </button>
          )}
          <button
            type="button"
            className="jd-admin-button jd-admin-button--primary"
            disabled={busy || !hasChanges}
            onClick={() => run('publish')}
          >
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      <div className={`jd-editor-body is-showing-${mobileView}`}>
        <div className="jd-editor-form" ref={formRef}>
          {renderFields({ draft, update, errors, record })}
          {renderAside?.({ draft, record })}
          <div className="jd-danger-zone">
            {canHide && isLive && (
              <button type="button" className="jd-admin-button" disabled={busy} onClick={() => setConfirm('unpublish')}>
                <JourneyIcon name="eyeOff" size={16} />
                Hide from site
              </button>
            )}
            {canDelete && (
              <button type="button" className="jd-admin-button jd-admin-button--danger" disabled={busy} onClick={() => setConfirm('delete')}>
                <JourneyIcon name="trash" size={16} />
                Delete {noun}
              </button>
            )}
          </div>
        </div>
        <div className="jd-editor-preview">
          <PreviewFrame
            path={path}
            collections={preview}
            title="Live preview"
            note={path ? previewNote : previewNote || 'This is not shown anywhere on the site yet.'}
          />
        </div>
      </div>

      {confirm === 'discard' && (
        <ConfirmDialog title="Discard your changes?" confirmLabel="Discard changes" tone="danger" busy={busy}
          onConfirm={() => run('discard')} onCancel={() => setConfirm(null)}>
          <p>This goes back to the version that is live on the site now. Your unpublished edits are lost.</p>
        </ConfirmDialog>
      )}
      {confirm === 'unpublish' && (
        <ConfirmDialog title={`Hide this ${noun}?`} confirmLabel="Hide from site" busy={busy}
          onConfirm={() => run('unpublish')} onCancel={() => setConfirm(null)}>
          <p>It comes off the site straight away. It stays here, and you can publish it again at any time.</p>
        </ConfirmDialog>
      )}
      {confirm === 'delete' && (
        <ConfirmDialog title={`Delete this ${noun}?`} confirmLabel={`Delete ${noun}`} tone="danger" busy={busy}
          onConfirm={remove} onCancel={() => setConfirm(null)}>
          <p>It is removed from the site and from your dashboard. This cannot be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}

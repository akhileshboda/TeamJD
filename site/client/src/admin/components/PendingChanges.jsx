import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CONTENT_CHANGED_EVENT, getPending, publishAll } from '../api'
import { adminLinkFor } from '../links'
import { useToast } from './Toasts'

// Top-bar counter of unpublished changes, with a panel to review them and
// publish them all at once. Offline items are not listed: they go live only by
// switching them on (see the server's pending()).
export default function PendingChanges() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const panelId = useId()
  const toast = useToast()

  const refresh = useCallback(() => getPending().then(setItems).catch(() => {}), [])

  useEffect(() => {
    refresh()
    window.addEventListener(CONTENT_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(CONTENT_CHANGED_EVENT, refresh)
  }, [refresh])

  const close = useCallback((returnFocus) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }, [])

  // Focus moves into the panel; Escape or a click outside closes it.
  useEffect(() => {
    if (!open) return undefined
    panelRef.current?.focus()
    const onKey = (event) => event.key === 'Escape' && close(true)
    const onPointer = (event) => !rootRef.current?.contains(event.target) && close(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, close])

  const publish = async () => {
    setBusy(true)
    try {
      const outcome = await publishAll()
      const failed = outcome.failed.length
      toast({
        scope: 'pending',
        ...(failed
          ? { tone: 'error', text: `Published ${outcome.done.length}. ${failed} need${failed === 1 ? 's' : ''} fixing first: open ${failed === 1 ? 'it' : 'them'} to see what is missing.` }
          : { tone: 'notice', text: `Published ${outcome.done.length}. Everything is up to date.` }),
      })
    } catch (error) {
      toast({ scope: 'pending', tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  if (!items.length) return null

  return (
    <div className="jd-pending" ref={rootRef}>
      <button ref={buttonRef} type="button" className="jd-pending-button has-changes"
        aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => (open ? close(false) : setOpen(true))}>
        <span className="jd-dot jd-dot--pending" aria-hidden="true" />
        {items.length} unpublished
      </button>
      {open && (
        <div ref={panelRef} id={panelId} className="jd-pending-panel" role="dialog" aria-label="Unpublished changes" tabIndex={-1}>
          <p className="jd-pending-title">Unpublished changes</p>
          <p className="jd-pending-note">Saved, but the site does not show them until they are published.</p>
          <ul className="jd-pending-list">
            {items.map((item) => (
              <li key={`${item.collection}:${item.id}`}>
                <Link to={adminLinkFor(item.collection, item.id)} onClick={() => close(false)}>
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
          <button type="button" className="jd-admin-button jd-admin-button--primary jd-pending-publish" disabled={busy} onClick={publish}>
            {busy ? 'Publishing…' : `Publish all ${items.length}`}
          </button>
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CONTENT_CHANGED_EVENT, getPending, publishAll } from '../api'
import { StatusChip } from './ui'

const SECTION_PATHS = { results: 'results', testimonials: 'testimonials' }

// Top-bar counter of saved-but-not-live changes, with a panel to review them and
// publish everything at once.
export default function PendingChanges() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const refresh = useCallback(() => getPending().then(setItems).catch(() => {}), [])

  useEffect(() => {
    refresh()
    window.addEventListener(CONTENT_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(CONTENT_CHANGED_EVENT, refresh)
  }, [refresh])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const publish = async () => {
    setBusy(true)
    try {
      const outcome = await publishAll()
      const failed = outcome.failed.length
      setMessage(failed
        ? { tone: 'error', text: `Published ${outcome.done.length}. ${failed} need${failed === 1 ? 's' : ''} fixing first: open ${failed === 1 ? 'it' : 'them'} to see what is missing.` }
        : { tone: 'notice', text: `Published ${outcome.done.length}. Everything is live.` })
    } catch (error) {
      setMessage({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  if (!items.length && !message) return null

  return (
    <div className="jd-pending">
      <button type="button" className={`jd-pending-button${items.length ? ' has-changes' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="jd-dot jd-dot--pending" aria-hidden="true" />
        {items.length ? `${items.length} not live` : 'All live'}
      </button>
      {open && (
        <div className="jd-pending-panel" role="dialog" aria-label="Changes not live yet">
          <p className="jd-pending-title">Saved but not on the site yet</p>
          {message && <p className={message.tone === 'error' ? 'jd-admin-error' : 'jd-admin-notice'} role="status">{message.text}</p>}
          {items.length > 0 && (
            <>
              <ul className="jd-pending-list">
                {items.map((item) => (
                  <li key={`${item.collection}:${item.id}`}>
                    <Link to={`/admin/${SECTION_PATHS[item.collection] || item.collection}/${item.id}`} onClick={() => setOpen(false)}>
                      {item.title}
                    </Link>
                    <StatusChip status={item.status} />
                  </li>
                ))}
              </ul>
              <button type="button" className="jd-admin-button jd-admin-button--primary jd-pending-publish" disabled={busy} onClick={publish}>
                {busy ? 'Publishing…' : `Publish all ${items.length}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

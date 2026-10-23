import { useEffect, useId, useRef } from 'react'

// Small shared pieces of the dashboard UI.

// The dashboard's two words for an item, used the same way everywhere:
//   Live / Offline         whether it is on the site (the Live switch).
//   Unpublished changes    edits saved on a live item that the site does not
//                          show yet (Publish changes / Discard changes).
// The server's statuses map onto them: published and changed are live, draft
// and hidden are offline, changed has unpublished changes.
export const isLive = (status) => status === 'published' || status === 'changed'
export const hasUnpublishedChanges = (status) => status === 'changed'

export const STATUS_HELP = [
  { chip: 'live', text: 'On the site. Switch it off to take it offline.' },
  { chip: 'offline', text: 'Not on the site. Switch it on when it is ready to go live.' },
  { chip: 'changes', text: 'Live, but your latest edits are not on the site yet. Open it and press Publish changes.' },
]

const CHIPS = {
  live: { label: 'Live', tone: 'live' },
  offline: { label: 'Offline', tone: 'muted' },
  changes: { label: 'Unpublished changes', tone: 'pending' },
}

export function Chip({ kind }) {
  const { label, tone } = CHIPS[kind]
  return <span className={`jd-chip jd-chip--${tone}`}>{label}</span>
}

// Live or Offline, plus Unpublished changes when there are some.
export function StatusChips({ status }) {
  return (
    <>
      <Chip kind={isLive(status) ? 'live' : 'offline'} />
      {hasUnpublishedChanges(status) && <Chip kind="changes" />}
    </>
  )
}

// The Live switch: whether an item is on the public site. A button rather
// than a checkbox, so a refused switch-on (missing fields) simply stays off.
// While busy it ignores presses but keeps focus, unlike a disabled button.
export function LiveSwitch({ on, busy = false, label = 'Live', hideLabel = false, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={busy || undefined}
      className={`jd-site-switch${on ? ' is-on' : ''}${busy ? ' is-busy' : ''}`}
      onClick={() => !busy && onChange(!on)}
    >
      <span className="jd-site-switch-track" aria-hidden="true" />
      <span className={hideLabel ? 'visually-hidden' : 'jd-site-switch-label'}>{label}</span>
    </button>
  )
}

const relative = new Intl.RelativeTimeFormat('en-AU', { numeric: 'auto' })
const dateOnly = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return ''
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const minutes = Math.round(seconds / 60)
  const hours = Math.round(minutes / 60)
  const days = Math.round(hours / 24)
  if (Math.abs(seconds) < 60) return 'just now'
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  if (Math.abs(days) < 7) return relative.format(days, 'day')
  return dateOnly.format(new Date(iso))
}

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

// Keeps keyboard focus inside an open modal: focus starts on `initialRef`, Tab
// wraps around inside `containerRef`, Escape closes, and focus goes back to
// where it was. onClose sits in a ref so a parent re-render never refocuses.
export function useModalFocus(containerRef, initialRef, onClose) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement
    initialRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        closeRef.current()
        return
      }
      const container = containerRef.current
      if (event.key !== 'Tab' || !container) return
      const focusable = [...container.querySelectorAll(FOCUSABLE)]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const outside = !container.contains(document.activeElement)
      if (event.shiftKey && (outside || document.activeElement === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (outside || document.activeElement === last)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [containerRef, initialRef])
}

// A modal confirmation. Focus starts on the safe choice; Escape cancels.
export function ConfirmDialog({ title, children, confirmLabel, tone = 'primary', busy = false, onConfirm, onCancel }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const titleId = useId()
  useModalFocus(dialogRef, cancelRef, onCancel)

  return (
    <div className="jd-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div ref={dialogRef} className="jd-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="jd-dialog-title">{title}</h2>
        <div className="jd-dialog-body">{children}</div>
        <div className="jd-dialog-actions">
          <button ref={cancelRef} type="button" className="jd-admin-button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`jd-admin-button jd-admin-button--${tone}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

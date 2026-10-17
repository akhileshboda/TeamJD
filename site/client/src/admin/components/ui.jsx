import { useEffect, useId, useRef } from 'react'

// Small shared pieces of the dashboard UI.

export const STATUS = {
  published: { label: 'Live', tone: 'live' },
  changed: { label: 'Changes not live', tone: 'pending' },
  draft: { label: 'Draft', tone: 'pending' },
  hidden: { label: 'Hidden', tone: 'muted' },
}

export function StatusChip({ status }) {
  const info = STATUS[status] || STATUS.draft
  return <span className={`jd-chip jd-chip--${info.tone}`}>{info.label}</span>
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

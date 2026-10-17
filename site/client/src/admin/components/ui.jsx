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

// A modal confirmation. Focus starts on the safe choice; Escape cancels.
export function ConfirmDialog({ title, children, confirmLabel, tone = 'primary', busy = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const previous = document.activeElement
    cancelRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onCancel])

  return (
    <div className="jd-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="jd-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
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

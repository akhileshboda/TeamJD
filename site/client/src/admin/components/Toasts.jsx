import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import JourneyIcon from '../../components/JourneyIcon'

const NOTICE_MS = 5000
const MAX_SHOWN = 3

const ToastContext = createContext(null)

// Messages after an action, shown in a corner so the page never shifts under
// Jake. Confirmations fade after a few seconds; errors stay until closed, so
// their link (Open it, Reload) can still be used. A toast with a `scope`
// replaces the earlier one from the same place, so a success clears its error.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((toast) => toast.id !== id)), [])
  const notify = useCallback((toast) => {
    nextId.current += 1
    const next = { ...toast, id: nextId.current }
    setToasts((list) => [...list.filter((shown) => !toast.scope || shown.scope !== toast.scope), next].slice(-MAX_SHOWN))
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="jd-toasts" aria-live="polite">
        {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  )
}

// notify({ tone: 'notice' | 'error', text, scope?, action?: { label, to, state } | { label, onClick } })
export function useToast() {
  const notify = useContext(ToastContext)
  if (!notify) throw new Error('useToast needs a ToastProvider above it.')
  return notify
}

// A confirmation waits while the pointer or focus is on it, so it never
// vanishes mid-read.
function Toast({ toast, onDismiss }) {
  const [held, setHeld] = useState(false)
  const isError = toast.tone === 'error'

  useEffect(() => {
    if (isError || held) return undefined
    const timer = setTimeout(() => onDismiss(toast.id), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [isError, held, toast.id, onDismiss])

  const close = () => onDismiss(toast.id)
  const { action } = toast

  return (
    <div
      className={`jd-toast jd-toast--${isError ? 'error' : 'notice'}`}
      role={isError ? 'alert' : 'status'}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <JourneyIcon name={isError ? 'alert' : 'check'} size={18} className="jd-toast-icon" />
      <p className="jd-toast-text">
        {toast.text}
        {action?.to && <Link className="jd-toast-action" to={action.to} state={action.state} onClick={close}>{action.label}</Link>}
        {action?.onClick && (
          <button type="button" className="jd-toast-action" onClick={() => { close(); action.onClick() }}>{action.label}</button>
        )}
      </p>
      <button type="button" className="jd-toast-close" aria-label="Close message" onClick={close}>
        <JourneyIcon name="close" size={16} />
      </button>
    </div>
  )
}

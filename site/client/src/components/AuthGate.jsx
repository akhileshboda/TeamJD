import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

// Gates the site during staging. In local dev (`npm run dev`) the overlay never
// renders. In a production build it asks the server whether the gate is on and,
// if so, shows a frosted login over the (faintly visible) site until the visitor
// signs in. Credentials are validated server-side — never shipped to the browser.
export default function AuthGate({ children }) {
  const isDev = import.meta.env.DEV
  const shouldReduce = useReducedMotion()

  // 'loading' → checking status · 'gated' → show login · 'open' → no overlay
  const [gateState, setGateState] = useState(isDev ? 'open' : 'loading')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isDev) return undefined

    let cancelled = false
    fetch('/api/auth/status', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setGateState(data.enabled && !data.authed ? 'gated' : 'open')
      })
      .catch(() => {
        // Fail closed: if we can't confirm, show the login.
        if (!cancelled) setGateState('gated')
      })

    return () => {
      cancelled = true
    }
  }, [isDev])

  useEffect(() => {
    if (isDev) return undefined
    document.body.style.overflow = gateState === 'open' ? '' : 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [gateState, isDev])

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password })
      })

      if (res.ok) {
        // Animate the overlay out, then reload so the now-authenticated session
        // refetches the asset manifest and previously-gated media.
        setGateState('open')
        window.setTimeout(() => window.location.reload(), 480)
        return
      }

      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Incorrect username or password')
      setPassword('')
      setSubmitting(false)
    } catch (_) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  const overlayMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.35, ease: 'easeOut' }
  }

  const cardMotion = shouldReduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.25 }
      }
    : {
        initial: { opacity: 0, scale: 0.96, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: 6 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
      }

  return (
    <>
      {children}

      {!isDev && (
        <AnimatePresence>
          {gateState !== 'open' && (
            <motion.div
              className="auth-gate-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Sign in to view this site"
              {...overlayMotion}
            >
              <motion.div className="auth-gate-card" {...cardMotion}>
                <img
                  className="auth-gate-logo"
                  src="/api/assets/logo"
                  alt="Team JD Jake Dedert"
                  decoding="async"
                />

                {gateState === 'loading' ? (
                  <p className="auth-gate-checking">Checking access…</p>
                ) : (
                  <>
                    <p className="auth-gate-caption">Private preview · please sign in</p>

                    <form className="auth-gate-form" onSubmit={handleSubmit}>
                      <label className="auth-gate-field">
                        <span>Username</span>
                        <input
                          type="text"
                          name="username"
                          autoComplete="username"
                          autoCapitalize="none"
                          autoCorrect="off"
                          autoFocus
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          disabled={submitting}
                        />
                      </label>

                      <label className="auth-gate-field">
                        <span>Password</span>
                        <input
                          type="password"
                          name="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={submitting}
                        />
                      </label>

                      {error && (
                        <p className="auth-gate-error" role="alert">
                          {error}
                        </p>
                      )}

                      <button
                        type="submit"
                        className="btn btn-primary auth-gate-submit"
                        disabled={submitting}
                      >
                        {submitting ? 'Signing in…' : 'Sign in'}
                      </button>
                    </form>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </>
  )
}

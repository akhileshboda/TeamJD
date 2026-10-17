import { useEffect, useId, useRef, useState } from 'react'
import { requestCode, verifyCode } from './api'

// The sign-in page, or with `dialog` the same form over the dashboard when a
// session runs out mid-edit (the dashboard behind it is made inert).
export default function SignIn({ notice, onSignedIn, dialog = false, initialEmail = '' }) {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(notice || '')
  const codeRef = useRef(null)
  const emailRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    if (dialog) emailRef.current?.focus()
  }, [dialog])

  const sendCode = async (event) => {
    event?.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter the email address you use for Team JD.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await requestCode(email)
      setMessage(step === 'code' ? `New code sent. Use the newest email from Team JD.` : '')
      setStep('code')
      setCode('')
      requestAnimationFrame(() => codeRef.current?.focus())
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  const signIn = async (event) => {
    event.preventDefault()
    if (code.length !== 6) {
      setError('Enter all 6 digits from the email.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await verifyCode(email, code)
      onSignedIn(result.email)
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  const panel = (
    <div className="jd-signin-panel">
      <img className="jd-signin-logo" src="/api/assets/logo" alt="Team JD" width="132" height="42" />
      <h1 id={titleId}>Sign in to your dashboard</h1>

      {message && <p className="jd-admin-notice" role="status">{message}</p>}

      {step === 'email' ? (
        <form onSubmit={sendCode} noValidate>
          <p className="jd-signin-lede">We will email you a 6-digit code. No password needed.</p>
          <label className="jd-field">
            <span className="jd-field-label">Email</span>
            <input
              ref={emailRef}
              className="jd-input"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              autoCapitalize="none"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? 'jd-signin-error' : undefined}
            />
          </label>
          {error && <p id="jd-signin-error" className="jd-field-error" role="alert">{error}</p>}
          <button className="jd-admin-button jd-admin-button--primary jd-signin-submit" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
        </form>
      ) : (
        <form onSubmit={signIn} noValidate>
          <p className="jd-signin-lede">
            If <strong>{email}</strong> can sign in, a code is on its way. It expires in 10 minutes.
          </p>
          <label className="jd-field">
            <span className="jd-field-label">6-digit code</span>
            <input
              ref={codeRef}
              className="jd-input jd-input--code"
              name="code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              spellCheck={false}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? 'jd-signin-error' : undefined}
            />
          </label>
          {error && <p id="jd-signin-error" className="jd-field-error" role="alert">{error}</p>}
          <button className="jd-admin-button jd-admin-button--primary jd-signin-submit" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="jd-signin-alt">
            <button type="button" className="jd-link-button" onClick={sendCode} disabled={busy}>Send a new code</button>
            <button type="button" className="jd-link-button" onClick={() => { setStep('email'); setError('') }} disabled={busy}>
              Use a different email
            </button>
          </div>
        </form>
      )}
    </div>
  )

  if (dialog) {
    return (
      <div className="jd-dialog-backdrop">
        <div className="jd-signin" role="dialog" aria-modal="true" aria-labelledby={titleId}>{panel}</div>
      </div>
    )
  }
  return <main className="jd-signin">{panel}</main>
}

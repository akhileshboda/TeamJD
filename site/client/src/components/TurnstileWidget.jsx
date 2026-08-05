import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const SCRIPT_ID = 'teamjd-turnstile-script'
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)

  const existing = document.getElementById(SCRIPT_ID)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(window.turnstile), { once: true })
      existing.addEventListener('error', reject, { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.addEventListener('load', () => resolve(window.turnstile), { once: true })
    script.addEventListener('error', reject, { once: true })
    document.head.appendChild(script)
  })
}

const TurnstileWidget = forwardRef(function TurnstileWidget({ onToken, onStatus }, ref) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const [state, setState] = useState('loading')

  useImperativeHandle(ref, () => ({
    reset() {
      onToken('')
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.reset(widgetIdRef.current)
      }
    },
  }), [onToken])

  useEffect(() => {
    let cancelled = false

    async function initialise() {
      try {
        const response = await fetch('/api/enquiries/config', {
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) throw new Error('Configuration request failed')
        const config = await response.json()
        if (!config.available || !config.turnstileSiteKey) {
          setState('unavailable')
          onStatus('The enquiry form is temporarily unavailable.')
          return
        }

        const turnstile = await loadTurnstile()
        if (cancelled || !containerRef.current) return

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: config.turnstileSiteKey,
          action: 'general-enquiry',
          theme: 'dark',
          size: 'flexible',
          callback(token) {
            onToken(token)
            onStatus('')
            setState('ready')
          },
          'expired-callback'() {
            onToken('')
            onStatus('The security check expired. Complete it again before sending.')
          },
          'error-callback'() {
            onToken('')
            onStatus('The security check could not load. Refresh the page and try again.')
          },
        })
        setState('ready')
      } catch (_error) {
        if (cancelled) return
        setState('unavailable')
        onStatus('The security check could not load. Refresh the page and try again.')
      }
    }

    initialise()
    return () => {
      cancelled = true
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
  }, [onStatus, onToken])

  return (
    <div className="contact-turnstile" data-state={state}>
      <div ref={containerRef} />
      {state === 'loading' && <span className="contact-turnstile-note">Loading security check…</span>}
      {state === 'unavailable' && (
        <span className="contact-turnstile-note">Security check unavailable</span>
      )}
    </div>
  )
})

export default TurnstileWidget

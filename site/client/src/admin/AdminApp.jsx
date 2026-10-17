import { Suspense, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { getSession, SIGNED_IN_EVENT, SIGNED_OUT_EVENT, signOut } from './api'
import AdminShell from './AdminShell'
import NotFoundPage from './pages/NotFoundPage'
import SignIn from './SignIn'
import { SECTIONS } from './sections'
import './admin.css'

function Loading({ label = 'Loading…' }) {
  return (
    <div className="jd-admin-loading" role="status">
      <span className="jd-admin-spinner" aria-hidden="true" />
      {label}
    </div>
  )
}

export default function AdminApp() {
  usePageMeta({ title: 'Dashboard', noindex: true })
  const [session, setSession] = useState({ status: 'checking' })

  useEffect(() => {
    let cancelled = false
    getSession()
      .then((result) => {
        if (!cancelled) setSession(result.signedIn ? { status: 'in', email: result.email } : { status: 'out' })
      })
      .catch((error) => {
        if (!cancelled) setSession({ status: 'out', error: error.message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // An expired session keeps the dashboard mounted under a sign-in dialog, so
  // an open editor keeps what was typed and saves it once signed in again.
  useEffect(() => {
    const onSignedOut = () => setSession((current) => (current.status === 'in' ? { ...current, expired: true } : current))
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
  }, [])

  // The browser's own scrollbars and form controls match the dark dashboard.
  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.colorScheme
    root.style.colorScheme = 'dark'
    return () => {
      root.style.colorScheme = previous
    }
  }, [])

  const signedInAgain = (email) => {
    setSession({ status: 'in', email })
    window.dispatchEvent(new Event(SIGNED_IN_EVENT))
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } finally {
      setSession({ status: 'out' })
    }
  }

  if (session.status === 'checking') {
    return (
      <div className="jd-admin jd-admin--bare">
        <Loading />
      </div>
    )
  }

  if (session.status === 'out') {
    return (
      <div className="jd-admin jd-admin--bare">
        <SignIn
          notice={session.error}
          onSignedIn={(email) => setSession({ status: 'in', email })}
        />
      </div>
    )
  }

  return (
    <div className="jd-admin">
      <AdminShell email={session.email} onSignOut={handleSignOut} inert={session.expired}>
        <Suspense fallback={<Loading />}>
          <Routes>
            {SECTIONS.map((section) => {
              const element = <section.element />
              return section.path
                ? <Route key={section.id} path={`${section.path}/*`} element={element} />
                : <Route key={section.id} index element={element} />
            })}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AdminShell>
      {session.expired && (
        <SignIn
          dialog
          initialEmail={session.email}
          notice="You were signed out. Sign in again to carry on; your unsaved changes are kept."
          onSignedIn={signedInAgain}
        />
      )}
    </div>
  )
}

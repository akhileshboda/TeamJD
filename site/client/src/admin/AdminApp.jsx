import { Suspense, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { getSession, SIGNED_OUT_EVENT, signOut } from './api'
import AdminShell from './AdminShell'
import ComingNext from './pages/ComingNext'
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

  useEffect(() => {
    const onSignedOut = () => setSession({ status: 'out', expired: true })
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
  }, [])

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
          notice={session.expired ? 'You were signed out. Sign in again to carry on.' : session.error}
          onSignedIn={(email) => setSession({ status: 'in', email })}
        />
      </div>
    )
  }

  return (
    <div className="jd-admin">
      <AdminShell email={session.email} onSignOut={handleSignOut}>
        <Suspense fallback={<Loading />}>
          <Routes>
            {SECTIONS.map((section) => {
              const Page = section.element || ComingNext
              const element = <Page section={section} />
              return section.path
                ? <Route key={section.id} path={`${section.path}/*`} element={element} />
                : <Route key={section.id} index element={element} />
            })}
            <Route path="*" element={<ComingNext section={null} />} />
          </Routes>
        </Suspense>
      </AdminShell>
    </div>
  )
}

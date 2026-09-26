import { useEffect, useMemo, useState } from 'react'
import AdminSlotCard from '../components/AdminSlotCard'
import { usePageMeta } from '../hooks/usePageMeta'
import { adminRequest } from '../utils/adminApi'
import '../styles/admin.css'

export default function Admin() {
  usePageMeta({ title: 'Media manager', noindex: true })
  const [slots, setSlots] = useState(null)
  const [email, setEmail] = useState('')
  const [storage, setStorage] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [activePage, setActivePage] = useState('')

  useEffect(() => {
    Promise.all([adminRequest('/api/admin/slots'), adminRequest('/api/admin/me')])
      .then(([data, me]) => {
        setSlots(data.slots)
        setStorage(data.storage)
        setEmail(me.email)
        setActivePage(data.slots[0]?.page ?? '')
      })
      .catch((error) => setLoadError(error.message))
  }, [])

  const pages = useMemo(() => [...new Set((slots ?? []).map((slot) => slot.page))], [slots])

  const handleChange = (slotId, entry) => {
    setSlots((current) => current.map((slot) => (slot.id === slotId ? { ...slot, ...entry } : slot)))
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div>
            <p className="eyebrow">Team JD</p>
            <h1>Media manager</h1>
          </div>
          <div className="admin-header-meta">
            {email && <span>Signed in as {email}</span>}
            <a href="/" target="_blank" rel="noopener noreferrer">View site ↗</a>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <p className="admin-intro">
          Replace any photo or video on your site. Pick a page, choose a spot and upload. Photos are
          resized and compressed for you, and your change shows on the site within a few minutes.
          Nothing is lost: earlier versions stay in each spot&apos;s history.
        </p>

        {loadError && <p className="admin-slot-error" role="alert">{loadError}</p>}
        {storage && (!storage.r2 || !storage.dropbox) && (
          <p className="admin-slot-warning" role="alert">
            Uploads are switched off because media storage is not configured on this server.
          </p>
        )}
        {!slots && !loadError && <p role="status">Loading your media…</p>}

        {slots && (
          <>
            <nav className="admin-tabs" aria-label="Site pages">
              {pages.map((page) => (
                <button
                  key={page}
                  type="button"
                  aria-pressed={page === activePage}
                  onClick={() => setActivePage(page)}
                >
                  {page}
                </button>
              ))}
            </nav>

            <section className="admin-grid" aria-label={`${activePage} media`}>
              {slots
                .filter((slot) => slot.page === activePage)
                .map((slot) => (
                  <AdminSlotCard key={slot.id} slot={slot} onChange={handleChange} />
                ))}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

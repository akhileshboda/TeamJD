import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import JourneyIcon from '../components/JourneyIcon'
import PendingChanges from './components/PendingChanges'
import { groupedSections, sectionForPath } from './sections'

function SidebarNav({ onNavigate }) {
  return (
    <nav className="jd-admin-nav" aria-label="Dashboard">
      {groupedSections().map((group) => (
        <div className="jd-admin-nav-group" key={group.name || 'top'}>
          {group.name && <p className="jd-admin-nav-heading">{group.name}</p>}
          <ul>
            {group.sections.map((section) => (
              <li key={section.id}>
                <NavLink
                  to={section.path ? `/admin/${section.path}` : '/admin'}
                  end={!section.path}
                  className="jd-admin-nav-link"
                  onClick={onNavigate}
                >
                  <JourneyIcon name={section.icon} size={18} />
                  <span>{section.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <a className="jd-admin-brand" href="/admin">
      <img src="/api/assets/logo" alt="" width="88" height="28" onError={(event) => { event.currentTarget.style.display = 'none' }} />
      <span>Dashboard</span>
    </a>
  )
}

export default function AdminShell({ email, onSignOut, children }) {
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [narrow, setNarrow] = useState(() => window.matchMedia?.('(max-width: 899px)').matches ?? false)
  const menuButtonRef = useRef(null)
  const sidebarRef = useRef(null)
  const section = sectionForPath(pathname)

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 899px)')
    if (!query) return undefined
    const onChange = () => setNarrow(query.matches)
    query.addEventListener?.('change', onChange)
    return () => query.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    if (!drawerOpen) return undefined
    sidebarRef.current?.querySelector('a')?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className={`jd-admin-shell${drawerOpen ? ' is-drawer-open' : ''}`}>
      <a className="jd-admin-skip" href="#jd-admin-main">Skip to content</a>

      {/* On phones the closed drawer is off-screen, so keep it out of the tab order. */}
      <aside ref={sidebarRef} className="jd-admin-sidebar" aria-label="Dashboard navigation" inert={narrow && !drawerOpen ? '' : undefined}>
        <Brand />
        <SidebarNav onNavigate={() => setDrawerOpen(false)} />
        <div className="jd-admin-account">
          <p className="jd-admin-account-email" title={email}>{email}</p>
          <button type="button" className="jd-admin-account-signout" onClick={onSignOut}>
            <JourneyIcon name="logOut" size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <button
        type="button"
        className="jd-admin-scrim"
        aria-label="Close menu"
        tabIndex={drawerOpen ? 0 : -1}
        onClick={() => setDrawerOpen(false)}
      />

      <div className="jd-admin-frame">
        <header className="jd-admin-topbar">
          <button
            ref={menuButtonRef}
            type="button"
            className="jd-admin-icon-button jd-admin-menu-button"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <JourneyIcon name="menu" size={20} />
          </button>
          <p className="jd-admin-topbar-title">{section?.label || 'Dashboard'}</p>
          <div className="jd-admin-topbar-actions">
            <PendingChanges />
            <a className="jd-admin-button jd-admin-button--quiet" href="/" target="_blank" rel="noreferrer">
              <JourneyIcon name="external" size={16} />
              <span className="jd-admin-hide-sm">View site</span>
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </div>
        </header>
        <main id="jd-admin-main" className="jd-admin-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}

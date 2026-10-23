import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import JourneyIcon from '../components/JourneyIcon'
import PendingChanges from './components/PendingChanges'
import { ToastProvider } from './components/Toasts'
import { groupedSections, sectionForPath } from './sections'

const RAIL_KEY = 'jd-admin-sidebar'

// The sidebar can shrink to an icon rail to give editors and their preview more
// room. It starts as a rail on tablet-sized screens; Jake's choice is remembered.
function initialRail() {
  try {
    const saved = localStorage.getItem(RAIL_KEY)
    if (saved) return saved === 'rail'
  } catch {
    // Storage blocked: fall back to the screen size.
  }
  return window.matchMedia?.('(max-width: 1279px)').matches ?? false
}

function SidebarNav({ onNavigate, rail }) {
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
                  title={rail ? section.label : undefined}
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

export default function AdminShell({ email, onSignOut, inert, children }) {
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [narrow, setNarrow] = useState(() => window.matchMedia?.('(max-width: 899px)').matches ?? false)
  const [rail, setRail] = useState(initialRail)
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

  const toggleRail = () => {
    setRail(!rail)
    try {
      localStorage.setItem(RAIL_KEY, rail ? 'full' : 'rail')
    } catch {
      // Not remembered; it still applies for this visit.
    }
  }
  const showRail = rail && !narrow

  return (
    <div className={`jd-admin-shell${drawerOpen ? ' is-drawer-open' : ''}${showRail ? ' is-rail' : ''}`} inert={inert ? '' : undefined}>
      <a className="jd-admin-skip" href="#jd-admin-main">Skip to content</a>

      {/* On phones the closed drawer is off-screen, so keep it out of the tab order. */}
      <aside ref={sidebarRef} className="jd-admin-sidebar" aria-label="Dashboard navigation" inert={narrow && !drawerOpen ? '' : undefined}>
        <Brand />
        <SidebarNav onNavigate={() => setDrawerOpen(false)} rail={showRail} />
        <div className="jd-admin-account">
          <p className="jd-admin-account-email" title={email}>{email}</p>
          <button type="button" className="jd-admin-account-signout" onClick={onSignOut} title={showRail ? 'Sign out' : undefined}>
            <JourneyIcon name="logOut" size={16} />
            <span>Sign out</span>
          </button>
          {!narrow && (
            <button type="button" className="jd-admin-rail-toggle" onClick={toggleRail}
              title={showRail ? 'Expand menu' : undefined}>
              <JourneyIcon name="sidebar" size={16} />
              <span>{showRail ? 'Expand menu' : 'Collapse menu'}</span>
            </button>
          )}
        </div>
      </aside>
      <button
        type="button"
        className="jd-admin-scrim"
        aria-label="Close menu"
        tabIndex={drawerOpen ? 0 : -1}
        onClick={() => setDrawerOpen(false)}
      />

      {/* While the phone drawer is open, keep Tab inside it. */}
      <ToastProvider>
        <div className="jd-admin-frame" inert={narrow && drawerOpen ? '' : undefined}>
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
      </ToastProvider>
    </div>
  )
}

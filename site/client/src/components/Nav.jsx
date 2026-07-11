import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useAssets } from '../hooks/useAssets'
import { useJSON } from '../hooks/useJSON'
/* R2 logo-hover reframed to the same canvas/content box as R2 logo (no size jump on swap) */
import logoHoverNav from '../assets/logo-hover-nav.webp'

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services', hasDropdown: true },
  { to: '/results', label: 'Results' },
  { to: '/contact', label: 'Contact' },
]

const FALLBACK_SERVICES = [
  { id: 'competition-prep', name: 'Competition Preparation', slug: 'competition-preparation' },
  { id: 'online-coaching', name: 'Online Coaching', slug: 'online-coaching' },
  { id: 'personal-training', name: 'Personal Training', slug: 'personal-training' },
  { id: 'posing-only', name: 'Posing', slug: 'posing-only' },
]

export default function Nav() {
  const [isOpen, setIsOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false)
  const servicesMenuId = useId()
  const servicesItemRef = useRef(null)
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()
  const location = useLocation()
  const { data: servicesData } = useJSON('/content/services.json')
  const services = servicesData || FALLBACK_SERVICES

  const isServicesRoute =
    location.pathname === '/services' || location.pathname.startsWith('/services/')

  useEffect(() => {
    setIsOpen(false)
    setServicesOpen(false)
    setMobileServicesOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!servicesOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setServicesOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [servicesOpen])

  const mobileVariants = shouldReduce
    ? {}
    : {
        initial: { height: 0, opacity: 0 },
        animate: { height: 'auto', opacity: 1 },
        exit: { height: 0, opacity: 0 },
        transition: { duration: 0.25, ease: 'easeInOut' },
      }

  const closeMobile = () => {
    setIsOpen(false)
    setMobileServicesOpen(false)
  }

  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <div className="container nav-inner">
        <Link to="/" className="nav-logo" aria-label="Team JD — Home">
          <span className="nav-logo-stack">
            <img
              className="nav-logo-default"
              src={resolveAsset('/api/assets/logo')}
              alt="Team JD Jake Dedert"
              decoding="async"
              width="1847"
              height="851"
            />
            <img
              className="nav-logo-alt"
              src={logoHoverNav}
              alt=""
              aria-hidden="true"
              decoding="async"
              width="1847"
              height="851"
            />
          </span>
        </Link>

        <ul className="nav-links" role="list">
          {NAV_LINKS.map(({ to, label, end, hasDropdown }) => {
            if (!hasDropdown) {
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                  >
                    {label}
                  </NavLink>
                </li>
              )
            }

            return (
              <li
                key={to}
                ref={servicesItemRef}
                className={`nav-item-dropdown${servicesOpen ? ' is-open' : ''}${isServicesRoute ? ' is-active' : ''}`}
                onMouseEnter={() => setServicesOpen(true)}
                onMouseLeave={() => setServicesOpen(false)}
                onFocus={() => setServicesOpen(true)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setServicesOpen(false)
                  }
                }}
              >
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `nav-dropdown-trigger${isActive || isServicesRoute ? ' active' : ''}`
                  }
                  aria-haspopup="true"
                  aria-expanded={servicesOpen}
                  aria-controls={servicesMenuId}
                >
                  {label}
                  <span className="nav-dropdown-chevron" aria-hidden="true" />
                </NavLink>

                <div
                  id={servicesMenuId}
                  className="nav-dropdown-panel"
                  role="region"
                  aria-label="Services menu"
                  hidden={!servicesOpen}
                >
                  <ul className="nav-dropdown-list" role="list">
                    {services.map((service) => (
                      <li key={service.id || service.slug}>
                        <Link
                          to={`/services/${service.slug}`}
                          className={
                            location.pathname === `/services/${service.slug}`
                              ? 'is-current'
                              : undefined
                          }
                        >
                          {service.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link to="/services" className="nav-dropdown-footer">
                    View all services <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="nav-cta">
          <a
            href="https://calendly.com/team-jd/15min"
            className="btn btn-primary btn-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Book a Consult
          </a>
        </div>

        <button
          className={`nav-hamburger${isOpen ? ' open' : ''}`}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="nav-mobile"
            role="dialog"
            aria-label="Mobile navigation"
            {...mobileVariants}
          >
            {NAV_LINKS.map(({ to, label, hasDropdown }) => {
              if (!hasDropdown) {
                return (
                  <NavLink key={to} to={to} onClick={closeMobile}>
                    {label}
                  </NavLink>
                )
              }

              return (
                <div key={to} className="nav-mobile-services">
                  <div className="nav-mobile-services-row">
                    <NavLink
                      to={to}
                      className={isServicesRoute ? 'active' : undefined}
                      onClick={closeMobile}
                    >
                      {label}
                    </NavLink>
                    <button
                      type="button"
                      className={`nav-mobile-services-toggle${mobileServicesOpen ? ' is-open' : ''}`}
                      aria-expanded={mobileServicesOpen}
                      aria-controls={`${servicesMenuId}-mobile`}
                      aria-label={mobileServicesOpen ? 'Collapse services' : 'Expand services'}
                      onClick={() => setMobileServicesOpen((prev) => !prev)}
                    >
                      <span aria-hidden="true" />
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {mobileServicesOpen && (
                      <motion.div
                        id={`${servicesMenuId}-mobile`}
                        className="nav-mobile-services-panel"
                        initial={shouldReduce ? false : { height: 0, opacity: 0 }}
                        animate={shouldReduce ? undefined : { height: 'auto', opacity: 1 }}
                        exit={shouldReduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                      >
                        {services.map((service) => (
                          <Link
                            key={service.id || service.slug}
                            to={`/services/${service.slug}`}
                            onClick={closeMobile}
                          >
                            {service.name}
                          </Link>
                        ))}
                        <Link to="/services" onClick={closeMobile}>
                          View all services
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
            <div className="mobile-cta">
              <a
                href="https://calendly.com/team-jd/15min"
                className="btn btn-primary"
                target="_blank"
                rel="noopener noreferrer"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={closeMobile}
              >
                Book a Consult
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useAssets } from '../hooks/useAssets'
/* R2 logo-hover reframed to the same canvas/content box as R2 logo (no size jump on swap) */
import logoHoverNav from '../assets/logo-hover-nav.webp'

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/results', label: 'Results' },
  { to: '/contact', label: 'Contact' },
]

export default function Nav() {
  const [isOpen, setIsOpen] = useState(false)
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()

  const mobileVariants = shouldReduce
    ? {}
    : {
        initial: { height: 0, opacity: 0 },
        animate: { height: 'auto', opacity: 1 },
        exit: { height: 0, opacity: 0 },
        transition: { duration: 0.25, ease: 'easeInOut' },
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
          {NAV_LINKS.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                {label}
              </NavLink>
            </li>
          ))}
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
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setIsOpen(false)}
              >
                {label}
              </NavLink>
            ))}
            <div className="mobile-cta">
              <a
                href="https://calendly.com/team-jd/15min"
                className="btn btn-primary"
                target="_blank"
                rel="noopener noreferrer"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setIsOpen(false)}
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

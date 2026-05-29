import { Link } from 'react-router-dom'
import { useAssets } from '../hooks/useAssets'

export default function Footer() {
  const resolveAsset = useAssets()
  const year = new Date().getFullYear()

  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-logo">
              <img
                src={resolveAsset('/api/assets/logo')}
                alt="Team JD Jake Dedert"
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className="footer-tagline">
              Elite fitness coaching for those who are serious about results. Competition
              prep, online coaching, personal training, and posing.
            </p>
          </div>

          <div>
            <p className="footer-heading">Pages</p>
            <ul className="footer-links" role="list">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/services">Services</Link></li>
              <li><Link to="/results">Results</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>

          <div>
            <p className="footer-heading">Services</p>
            <ul className="footer-links" role="list">
              <li><Link to="/services#competition-prep">Competition Prep</Link></li>
              <li><Link to="/services#online-coaching">Online Coaching</Link></li>
              <li><Link to="/services#personal-training">Personal Training</Link></li>
              <li><Link to="/services#posing-only">Posing Only</Link></li>
            </ul>
            <p className="footer-heading" style={{ marginTop: '1.5rem' }}>Connect</p>
            <ul className="footer-links" role="list">
              <li>
                <a href="https://www.instagram.com/jakededert/" target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
              </li>
              <li>
                <a href="https://calendly.com/team-jd/15min" target="_blank" rel="noopener noreferrer">
                  Book a Consult
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            &copy; {year} Jake Dedert &mdash; Team JD. All rights reserved.
          </p>
          <Link
            to="/privacy"
            style={{ color: 'var(--color-text-subtle)', fontSize: '0.875rem', transition: 'color 150ms ease' }}
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  )
}

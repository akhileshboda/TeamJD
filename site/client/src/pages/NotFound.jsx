import { Link } from 'react-router-dom'
import FindYourFitLink from '../components/FindYourFitLink'

export default function NotFound() {
  return (
    <section className="not-found-page" aria-labelledby="not-found-heading">
      <div className="not-found-bg" aria-hidden="true" />
      <div className="container not-found-inner">
        <div className="not-found-copy">
          <img
            className="not-found-logo"
            src="/assets/branding/team-jd-logo.png"
            alt="Team JD Jake Dedert"
            decoding="async"
          />
          <p className="eyebrow">404 / Page Not Found</p>
          <h1 id="not-found-heading">This Page Missed Its Set.</h1>
          <p className="not-found-lede">
            The link may have moved, or the page you were looking for no longer exists.
            Head back to Team JD and we&apos;ll get you on the right track.
          </p>
          <div className="not-found-actions" aria-label="Recovery links">
            <Link to="/" className="btn btn-primary">
              Back Home
            </Link>
            <Link to="/services" className="btn btn-secondary">
              View Services
            </Link>
          </div>
        </div>

        <div className="not-found-panel" aria-label="Quick links">
          <p className="not-found-panel-kicker">Still looking?</p>
          <ul className="not-found-links" role="list">
            <li>
              <Link to="/contact">Book or send Jake a message</Link>
            </li>
            <li>
              <FindYourFitLink>Find the right coaching path</FindYourFitLink>
            </li>
            <li>
              <a
                href="https://www.instagram.com/jake_dedert_teamjd_coaching/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Check Team JD on Instagram
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

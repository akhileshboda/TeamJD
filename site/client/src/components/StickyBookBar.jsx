import { Link } from 'react-router-dom'
import JourneyIcon from './JourneyIcon'

// Mobile-only persistent next-step bar. Booking is deliberately unavailable
// until the service fit check has been completed successfully.
export default function StickyBookBar({ service, qualificationState, recommendation }) {
  if (!service) return null

  const status = qualificationState?.status || 'locked'

  return (
    <div className="sticky-book-bar" role="region" aria-label="Service next step">
      <div className="sticky-book-bar-label">
        <span className="sticky-book-bar-name">{service.name}</span>
        <span className="sticky-book-bar-price">
          {status === 'qualified'
            ? 'Fit check complete'
            : status === 'redirect'
              ? 'Better path found'
              : 'A quick fit check comes first'}
        </span>
      </div>

      {status === 'qualified' ? (
        <a
          href={service.cta_url}
          className="btn btn-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Book now
          <JourneyIcon name="arrowRight" size={16} />
        </a>
      ) : status === 'redirect' && recommendation ? (
        <Link className="btn btn-primary" to={`/services/${recommendation.slug}`}>
          View match
          <JourneyIcon name="arrowRight" size={16} />
        </Link>
      ) : status === 'redirect' ? (
        <Link className="btn btn-primary" to="/contact">
          Message Jake
        </Link>
      ) : (
        <a className="btn btn-primary" href="#service-fit-check">
          Check your fit
          <JourneyIcon name="arrowRight" size={16} />
        </a>
      )}
    </div>
  )
}

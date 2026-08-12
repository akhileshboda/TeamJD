import JourneyIcon from './JourneyIcon'
import CompetitionPrepBookingAction from './CompetitionPrepBookingAction'
import { useFindYourFitSession } from '../context/FindYourFitSession'
import { getServicePricingContext } from '../utils/servicePricing'

export default function StickyBookBar({ service, services = [] }) {
  const { validForCompetitionPrep } = useFindYourFitSession()
  if (!service) return null

  const requiresFindYourFit = Boolean(service.application_required)
  const pricing = getServicePricingContext(service)
  const pricingLabel = pricing?.compactLabel ?? 'Book a consultation'
  const secondaryLabel = requiresFindYourFit && !validForCompetitionPrep
    ? `${pricingLabel} · Fit check required`
    : pricingLabel

  return (
    <div className="sticky-book-bar" role="region" aria-label="Service next step">
      <div className="sticky-book-bar-label">
        <span className="sticky-book-bar-name">{service.name}</span>
        <span className="sticky-book-bar-price">{secondaryLabel}</span>
      </div>

      {requiresFindYourFit ? (
        <CompetitionPrepBookingAction
          service={service}
          services={services}
          className="btn btn-primary"
        >
          Book now
          <JourneyIcon name="arrowRight" size={16} />
        </CompetitionPrepBookingAction>
      ) : (
        <a
          href={service.cta_url}
          className="btn btn-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Book now
          <JourneyIcon name="arrowRight" size={16} />
        </a>
      )}
    </div>
  )
}

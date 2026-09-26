import JourneyIcon from './JourneyIcon'
import CompetitionPrepBookingAction from './CompetitionPrepBookingAction'
import { useFindYourFitSession } from '../context/FindYourFitSession'
import { getServicePricingContext } from '../utils/servicePricing'
import { resolveServiceAction } from '../utils/bookingLinks'

export default function StickyBookBar({ service, services = [] }) {
  const { validForCompetitionPrep } = useFindYourFitSession()
  if (!service) return null

  const action = resolveServiceAction(service)
  const pricing = getServicePricingContext(service)
  const pricingLabel = pricing?.compactLabel ?? 'Book a consultation'
  const secondaryLabel = action.isApplication && !validForCompetitionPrep
    ? `${pricingLabel} · Application required`
    : pricingLabel

  return (
    <div className="sticky-book-bar" role="region" aria-label="Service next step">
      <div className="sticky-book-bar-label">
        <span className="sticky-book-bar-name">{service.name}</span>
        <span className="sticky-book-bar-price">{secondaryLabel}</span>
      </div>

      {action.isApplication ? (
        <CompetitionPrepBookingAction
          service={service}
          services={services}
          className="btn btn-primary"
        >
          {action.shortLabel}
          <JourneyIcon name="arrowRight" size={16} />
        </CompetitionPrepBookingAction>
      ) : (
        <a
          href={action.href}
          className="btn btn-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          {action.shortLabel}
          <JourneyIcon name="arrowRight" size={16} />
        </a>
      )}
    </div>
  )
}

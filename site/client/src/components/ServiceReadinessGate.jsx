import FindYourFitLink from './FindYourFitLink'
import JourneyIcon from './JourneyIcon'
import CompetitionPrepBookingAction from './CompetitionPrepBookingAction'
import ServiceBookingCard from './ServiceBookingCard'
import { useFindYourFitSession } from '../context/FindYourFitSession'
import { resolveServiceAction } from '../utils/bookingLinks'

export default function ServiceReadinessGate({ service, services = [] }) {
  const { completed, outcome, validForCompetitionPrep } = useFindYourFitSession()
  const action = resolveServiceAction(service)
  const recommendation = outcome?.recommendationSlug
    ? services.find((candidate) => candidate.slug === outcome.recommendationSlug)
    : null

  const heading = validForCompetitionPrep
    ? 'Competition Preparation is your match.'
    : !completed
      ? 'Complete Find Your Fit before you apply.'
      : outcome.status === 'consult'
        ? 'Talk it through before choosing prep.'
        : `${recommendation?.name || 'Another coaching path'} is your current match.`

  const copy = validForCompetitionPrep
    ? 'Your result supports a Competition Preparation application. Jake will still decide whether your timeline and readiness are right for prep.'
    : !completed
      ? 'Find Your Fit gives Jake useful context before you apply for prep. You can complete it now or continue to the application anyway.'
      : outcome.status === 'consult'
        ? 'Your answers suggest a direct conversation is the best next step. You can review that result or continue to the application anyway.'
        : `Your answers currently point towards ${recommendation?.name || 'another service'}. Review your result or continue to the application if you still want Jake to assess you for prep.`

  return (
    <ServiceBookingCard
      id="service-fit-check"
      service={service}
      heading="Find Your Fit checkpoint"
      headingId="service-readiness-title"
      className="service-readiness-gate"
    >
      <div className="service-readiness-gate-body">
        <div className="service-readiness-gate-icon" aria-hidden="true">
          <JourneyIcon name={validForCompetitionPrep ? 'check' : 'compass'} size={26} />
        </div>
        <div>
          {/* Unlike the direct-booking branch, this heading reports session state rather
              than restating the service name, so it earns its place inside the card. */}
          <h3>{heading}</h3>
          <p>{copy}</p>
        </div>
        <div className="service-readiness-gate-actions">
          {!validForCompetitionPrep && (
            <FindYourFitLink className="btn btn-primary">
              {completed ? 'Review Find Your Fit' : 'Start Find Your Fit'}
              <JourneyIcon name="arrowRight" size={17} />
            </FindYourFitLink>
          )}
          <CompetitionPrepBookingAction
            service={service}
            services={services}
            className={`btn ${validForCompetitionPrep ? 'btn-primary' : 'btn-secondary'}`}
          >
            {action.label}
            <JourneyIcon name="arrowRight" size={17} />
          </CompetitionPrepBookingAction>
        </div>
      </div>
    </ServiceBookingCard>
  )
}

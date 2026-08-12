import FindYourFitLink from './FindYourFitLink'
import JourneyIcon from './JourneyIcon'
import ScrollChromeSection from './ScrollChromeSection'
import CompetitionPrepBookingAction from './CompetitionPrepBookingAction'
import { useFindYourFitSession } from '../context/FindYourFitSession'

export default function ServiceReadinessGate({ service, services = [] }) {
  const { completed, outcome, validForCompetitionPrep } = useFindYourFitSession()
  const recommendation = outcome?.recommendationSlug
    ? services.find((candidate) => candidate.slug === outcome.recommendationSlug)
    : null

  const heading = validForCompetitionPrep
    ? 'Competition Preparation is your match.'
    : !completed
      ? 'Complete Find Your Fit before booking.'
      : outcome.status === 'consult'
        ? 'Talk it through before choosing prep.'
        : `${recommendation?.name || 'Another coaching path'} is your current match.`

  const copy = validForCompetitionPrep
    ? 'Your result supports a Competition Preparation assessment. Jake will still decide whether your timeline and readiness are right for prep.'
    : !completed
      ? 'Find Your Fit gives Jake useful context before you request a prep assessment. You can complete it now or continue to the booking checkpoint.'
      : outcome.status === 'consult'
        ? 'Your answers suggest a direct conversation is the best next step. You can review that result or continue to the booking checkpoint.'
        : `Your answers currently point towards ${recommendation?.name || 'another service'}. Review your result or continue to the booking checkpoint if you still want to speak about prep.`

  return (
    <ScrollChromeSection
      id="service-fit-check"
      className="service-content-block service-content-block--readiness service-readiness-gate"
      aria-labelledby="service-readiness-title"
    >
      <div className="service-content-block-heading">
        <span aria-hidden="true">04</span>
        <div>
          <span>Your next step</span>
          <h3 id="service-readiness-title">Find Your Fit checkpoint</h3>
        </div>
      </div>

      <div className="service-readiness-gate-body">
        <div className="service-readiness-gate-icon" aria-hidden="true">
          <JourneyIcon name={validForCompetitionPrep ? 'check' : 'compass'} size={26} />
        </div>
        <div>
          <span className="eyebrow">
            {validForCompetitionPrep ? 'Find Your Fit complete' : 'Before Calendly'}
          </span>
          <h2>{heading}</h2>
          <p>{copy}</p>
          {service.pricing_message && (
            <p className="service-tailored-pricing">{service.pricing_message}</p>
          )}
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
            {service.cta_text}
            <JourneyIcon name="arrowRight" size={17} />
          </CompetitionPrepBookingAction>
        </div>
      </div>
    </ScrollChromeSection>
  )
}

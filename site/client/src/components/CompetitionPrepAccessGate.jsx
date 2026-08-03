import { Link } from 'react-router-dom'
import FindYourFitLink from './FindYourFitLink'
import JourneyIcon from './JourneyIcon'
import { useFindYourFitSession } from '../context/FindYourFitSession'

export default function CompetitionPrepAccessGate({ service, services = [] }) {
  const {
    completed,
    outcome,
    grantCompetitionPrepPageAccess,
  } = useFindYourFitSession()

  const recommendation = outcome?.recommendationSlug
    ? services.find((candidate) => candidate.slug === outcome.recommendationSlug)
    : null

  const heading = !completed
    ? 'Find your fit before exploring competition prep.'
    : outcome.status === 'consult'
      ? 'A conversation with Jake is your recommended next step.'
      : `${recommendation?.name || 'Another coaching path'} is your current match.`

  const copy = !completed
    ? 'Competition preparation is demanding and highly individual. Complete the short Find Your Fit questionnaire first so the next step reflects your goal and readiness.'
    : outcome.status === 'consult'
      ? 'Your answers suggest that talking through the coaching commitment will be more useful than choosing a service immediately. You can still review Competition Preparation if you want to.'
      : `Find Your Fit currently points you towards ${recommendation?.name || 'a different service'}. You can review that recommendation or continue to the Competition Preparation page anyway.`

  return (
    <section className="competition-prep-access-gate" aria-labelledby="competition-prep-gate-title">
      <div className="competition-prep-access-gate-glow" aria-hidden="true" />
      <div className="container competition-prep-access-gate-inner">
        <div className="competition-prep-access-gate-icon" aria-hidden="true">
          <JourneyIcon name="compass" size={32} />
        </div>
        <span className="eyebrow">Find Your Fit checkpoint</span>
        <h1 id="competition-prep-gate-title">{heading}</h1>
        <p>{copy}</p>

        {recommendation && (
          <div className="competition-prep-access-recommendation">
            <span>Your current match</span>
            <strong>{recommendation.name}</strong>
            <p>{recommendation.short_description}</p>
          </div>
        )}

        <div className="competition-prep-access-gate-actions">
          <FindYourFitLink className="btn btn-primary btn-lg">
            {completed ? 'Review Find Your Fit' : 'Start Find Your Fit'}
            <JourneyIcon name="arrowRight" size={18} />
          </FindYourFitLink>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={grantCompetitionPrepPageAccess}
          >
            View {service.name} anyway
          </button>
          <Link className="competition-prep-access-back" to="/services">
            <JourneyIcon name="arrowLeft" size={17} />
            Back to all services
          </Link>
        </div>

        <p className="competition-prep-access-note">
          Continuing lets you review the service for this browser session. Booking remains a
          separate checkpoint.
        </p>
      </div>
    </section>
  )
}

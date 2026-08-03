import JourneyIcon from './JourneyIcon'
import FindYourFitLink from './FindYourFitLink'

export default function ServiceFinderBanner() {
  return (
    <section
      id="find-your-fit"
      className="service-finder-banner"
      aria-labelledby="service-finder-banner-title"
    >
      <div className="service-finder-banner-icon" aria-hidden="true">
        <JourneyIcon name="compass" size={28} />
      </div>
      <div className="service-finder-banner-copy">
        <span className="eyebrow">Find Your Fit</span>
        <h2 id="service-finder-banner-title">Start with what you actually need.</h2>
        <p>
          Answer four to six focused questions about your goal, support, and readiness. We will
          guide you to the service that makes sense now.
        </p>
      </div>
      <FindYourFitLink className="btn btn-primary btn-lg">
        Find My Best Match
        <JourneyIcon name="arrowRight" size={18} />
      </FindYourFitLink>
    </section>
  )
}

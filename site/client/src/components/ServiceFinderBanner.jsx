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
        <h2 id="service-finder-banner-title">Start in the right room.</h2>
        <p>Two quick questions will point you towards the coaching path that best matches your goal.</p>
      </div>
      <FindYourFitLink className="btn btn-primary btn-lg">
        Find My Best Match
        <JourneyIcon name="arrowRight" size={18} />
      </FindYourFitLink>
    </section>
  )
}

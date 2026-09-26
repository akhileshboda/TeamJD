import ScrollChromeSection from './ScrollChromeSection'
import ServicePricingConversion from './ServicePricingConversion'

// Section 04 renders one of two branches -- the Find Your Fit checkpoint for services
// that require an application, the direct booking block for the rest. Both used to
// hand-roll this scaffolding, which meant two copies of the step number, two section
// class lists to keep in step, and a CTA that was sized differently depending on which
// branch drew it. The branches now differ only in their heading and their actions.
export default function ServiceBookingCard({
  id,
  service,
  step = '04',
  kicker = 'Your next step',
  heading,
  headingId,
  className,
  children,
}) {
  return (
    <ScrollChromeSection
      id={id}
      className={`service-content-block service-content-block--readiness ${className}`}
      aria-labelledby={headingId}
    >
      <div className="service-content-block-heading">
        <span aria-hidden="true">{step}</span>
        <div>
          <span>{kicker}</span>
          <h2 id={headingId}>{heading}</h2>
        </div>
      </div>

      <ServicePricingConversion service={service} placement="final">
        {children}
      </ServicePricingConversion>
    </ScrollChromeSection>
  )
}

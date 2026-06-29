import { Link } from 'react-router-dom'
import SectionReveal from './SectionReveal'

export default function CTABanner({
  title = 'Start Your Transformation Today.',
  description = 'Book a free 15-minute consultation. No obligation — just an honest conversation about what\'s possible for you.',
  primaryLabel = 'Book a Free Consult',
  primaryHref = 'https://calendly.com/team-jd/15min',
  primaryExternal = true,
  secondaryLabel = 'Explore Services',
  secondaryTo = '/services',
  eyebrow = 'Ready to Begin?',
  sectionClassName = '',
}) {
  return (
    <section className={`section${sectionClassName ? ` ${sectionClassName}` : ''}`} aria-labelledby="cta-heading">
      <div className="container">
        <SectionReveal>
          <div className="cta-banner">
            {eyebrow && (
              <span className="eyebrow" style={{ display: 'inline-block', marginBottom: '0.75rem' }}>
                {eyebrow}
              </span>
            )}
            <h2 id="cta-heading">{title}</h2>
            <p>{description}</p>
            <div className="actions">
              {primaryExternal ? (
                <a
                  href={primaryHref}
                  className="btn btn-primary btn-lg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {primaryLabel}
                </a>
              ) : (
                <Link to={primaryHref} className="btn btn-primary btn-lg">
                  {primaryLabel}
                </Link>
              )}
              <Link to={secondaryTo} className="btn btn-secondary btn-lg">
                {secondaryLabel}
              </Link>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  )
}

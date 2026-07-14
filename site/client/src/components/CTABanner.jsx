import { useId } from 'react'
import { Link } from 'react-router-dom'
import SectionReveal from './SectionReveal'

const DEFAULT_ACTIONS = [
  {
    label: 'Explore Services',
    to: '/services',
    variant: 'primary',
    analyticsId: 'explore_services',
  },
  {
    label: 'Find Your Fit',
    to: '/services#find-your-fit',
    variant: 'secondary',
    analyticsId: 'find_your_fit',
  },
]

function CTAAction({ action, location }) {
  const className = `btn btn-${action.variant || 'secondary'} btn-lg`
  const analyticsProps = {
    'data-analytics-event': 'final_cta_click',
    'data-analytics-location': location,
    'data-analytics-id': action.analyticsId,
  }

  if (action.type === 'button' || action.asButton) {
    return (
      <button type="button" className={className} {...analyticsProps}>
        {action.label}
      </button>
    )
  }

  if (action.to) {
    return (
      <Link to={action.to} className={className} {...analyticsProps}>
        {action.label}
      </Link>
    )
  }

  return (
    <a
      href={action.href}
      className={className}
      target={action.newTab === false ? undefined : '_blank'}
      rel={action.newTab === false ? undefined : 'noopener noreferrer'}
      {...analyticsProps}
    >
      {action.label}
    </a>
  )
}

export default function CTABanner({
  title = 'Find the Coaching That Fits Your Next Move.',
  description = 'Explore the coaching paths, compare the support available, and choose the next step that matches your goal.',
  eyebrow = 'Your Next Move',
  actions = DEFAULT_ACTIONS,
  analyticsLocation = 'home_final_cta',
  sectionClassName = '',
}) {
  const headingId = useId()

  return (
    <section
      className={`section cta-section${sectionClassName ? ` ${sectionClassName}` : ''}`}
      aria-labelledby={headingId}
    >
      <div className="container">
        <SectionReveal>
          <div className="cta-banner">
            <div className="cta-banner-copy">
              {eyebrow && <span className="eyebrow">{eyebrow}</span>}
              <h2 id={headingId}>{title}</h2>
              <p>{description}</p>
            </div>
            <div className="cta-banner-action-zone">
              <div className="actions">
                {actions.map((action) => (
                  <CTAAction
                    key={`${action.analyticsId || action.to || action.href || 'action'}-${action.label}`}
                    action={action}
                    location={analyticsLocation}
                  />
                ))}
              </div>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  )
}

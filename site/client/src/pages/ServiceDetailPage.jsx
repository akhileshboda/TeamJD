import { Navigate, useParams } from 'react-router-dom'
import CompetitionPrepAccessGate from '../components/CompetitionPrepAccessGate'
import JourneyIcon from '../components/JourneyIcon'
import ScrollChromeSection from '../components/ScrollChromeSection'
import SectionReveal from '../components/SectionReveal'
import ServiceDetailHero from '../components/ServiceDetailHero'
import ServiceGlassCard from '../components/ServiceGlassCard'
import ServiceMediaCarousel from '../components/ServiceMediaCarousel'
import ServiceReadinessGate from '../components/ServiceReadinessGate'
import ServiceStandardTimeline from '../components/ServiceStandardTimeline'
import StickyBookBar from '../components/StickyBookBar'
import { useJSON } from '../hooks/useJSON'
import { useAssets } from '../hooks/useAssets'
import { useFindYourFitSession } from '../context/FindYourFitSession'

const inclusionGroups = [
  { title: 'Your coaching plan', range: [0, 2], variant: 'plan' },
  { title: 'Delivery and support', range: [2, Infinity], variant: 'delivery' },
]

export default function ServiceDetailPage() {
  const { slug } = useParams()
  const { data: services } = useJSON('/content/services.json')
  const resolveAsset = useAssets()
  const { canViewCompetitionPrep } = useFindYourFitSession()

  if (!services) {
    return (
      <div className="service-route-loading" role="status">
        <span className="visually-hidden">Loading service</span>
        <div className="service-skeleton-hero" aria-hidden="true">
          <div className="service-skeleton-copy">
            <div className="service-skeleton-bar service-skeleton-bar--chip" />
            <div className="service-skeleton-bar service-skeleton-bar--title" />
            <div className="service-skeleton-bar service-skeleton-bar--title-short" />
            <div className="service-skeleton-bar service-skeleton-bar--text" />
          </div>
          <div className="service-skeleton-frame" />
        </div>
      </div>
    )
  }

  const service = services.find((candidate) => candidate.slug === slug)
  if (!service) return <Navigate to="/services" replace />

  if (service.application_required && !canViewCompetitionPrep) {
    return <CompetitionPrepAccessGate service={service} services={services} />
  }

  const others = services.filter((candidate) => candidate.slug !== slug)

  const theme = service.theme ?? {}
  const themeVars = {
    '--svc-accent': theme.accent,
    '--svc-accent-rgb': theme.accent_rgb,
    '--svc-accent-2': theme.accent2,
    '--svc-accent-2-rgb': theme.accent2_rgb,
  }
  const bodyImageSrc = resolveAsset(service.body_image ?? service.hero_image)
  const bannerImageSrc = resolveAsset(service.banner_image ?? service.body_image ?? service.hero_image)
  const investment = service.facts?.find((fact) => fact.label.toLowerCase() === 'investment')

  return (
    <div className="service-journey-theme" style={themeVars}>
      <ServiceDetailHero service={service} />

      <div className="service-journey-page">
        <div className="service-journey-page-glow" aria-hidden="true" />
        <div className="service-journey-drift service-journey-drift--one" aria-hidden="true" />
        <div className="service-journey-drift service-journey-drift--two" aria-hidden="true" />
        <div className="container service-journey-container">
          <SectionReveal inView={false}>
            <section className="service-intro-section" aria-labelledby="service-intro-title">
              <div className="service-intro-copy">
                <span className="eyebrow">Know What You Are Choosing</span>
                <h2 id="service-intro-title">The right service starts with the right expectation.</h2>
                <p>{service.description}</p>
              </div>

              <ServiceMediaCarousel service={service} />
            </section>
          </SectionReveal>

          <ServiceStandardTimeline service={service} />

          <section className="service-inclusions-section" aria-labelledby="service-inclusions-title">
            <SectionReveal>
              <div className="service-section-heading">
                <div>
                  <span className="eyebrow">What Is Included</span>
                  <h2 id="service-inclusions-title">Support built around the whole job.</h2>
                </div>
                <p>
                  Each part of the service has a purpose. Together they create the structure,
                  feedback, and accountability behind the result.
                </p>
              </div>
            </SectionReveal>

            <div className="service-inclusions-groups">
              {inclusionGroups.map((group, groupIndex) => {
                const [start, end] = group.range
                const items = service.includes.slice(start, end)
                if (items.length === 0) return null

                const groupId = `${service.slug}-inclusion-group-${groupIndex + 1}`

                return (
                  <ScrollChromeSection
                    className={`service-content-block service-content-block--${group.variant} service-inclusions-group`}
                    aria-labelledby={groupId}
                    key={group.title}
                  >
                    <SectionReveal>
                      <div className="service-content-block-heading">
                        <span aria-hidden="true">{String(groupIndex + 1).padStart(2, '0')}</span>
                        <div>
                          <span>Included support</span>
                          <h3 id={groupId}>{group.title}</h3>
                        </div>
                      </div>
                    </SectionReveal>

                    <div className="service-inclusions-grid">
                      {items.map((item, itemIndex) => {
                        const index = start + itemIndex

                        return (
                          <SectionReveal
                            key={item.title}
                            delay={Math.min(itemIndex * 0.05, 0.12)}
                          >
                            <article
                              className={`service-inclusion-card glass-panel${
                                index === 0 ? ' service-inclusion-card--feature' : ''
                              }`}
                              style={
                                index === 0
                                  ? { '--svc-card-photo': `url("${bodyImageSrc}")` }
                                  : undefined
                              }
                            >
                              <div className="service-inclusion-number" aria-hidden="true">
                                {String(index + 1).padStart(2, '0')}
                              </div>
                              <div className="service-inclusion-icon" aria-hidden="true">
                                <img
                                  src={resolveAsset(item.icon)}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                />
                              </div>
                              <h3>{item.title}</h3>
                              <p>{item.description}</p>
                            </article>
                          </SectionReveal>
                        )
                      })}
                    </div>
                  </ScrollChromeSection>
                )
              })}
            </div>

            <SectionReveal>
              <figure className="service-ultrawide-media" data-service-media-slot="video-ready">
                <img
                  src={bannerImageSrc}
                  alt={`${service.name} coaching in action`}
                  loading="lazy"
                  decoding="async"
                />
                <div className="service-ultrawide-media-scrim" aria-hidden="true" />
                <figcaption>
                  <span>Inside the service</span>
                  <strong>{service.name} in practice</strong>
                </figcaption>
              </figure>
            </SectionReveal>

            {investment && (
              <details className="service-investment-disclosure">
                <summary>Session investment</summary>
                <span>{investment.value}</span>
              </details>
            )}
          </section>

          <SectionReveal>
            <ScrollChromeSection className="service-content-block service-content-block--fit" aria-labelledby="service-fit-title">
              <div className="service-content-block-heading">
                <span aria-hidden="true">03</span>
                <div>
                  <span>Before you continue</span>
                  <h3 id="service-fit-title">Good fit</h3>
                </div>
              </div>

              <div className="service-fit-split">
                <article className="service-fit-panel service-fit-split-copy">
                  <div className="service-fit-panel-heading">
                    <JourneyIcon name="user" size={24} />
                    <div>
                      <span className="eyebrow">A Good Fit Looks Like</span>
                      <h2>This matches you if&hellip;</h2>
                    </div>
                  </div>
                  <ul>
                    {service.who_its_for.map((item) => (
                      <li key={item}>
                        <span aria-hidden="true"><JourneyIcon name="check" size={17} /></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>

                <div
                  className="service-fit-split-photo"
                  role="img"
                  aria-label={service.body_alt ?? ''}
                  style={{ '--svc-fit-photo': `url("${bodyImageSrc}")` }}
                />
              </div>
            </ScrollChromeSection>
          </SectionReveal>

          {service.application_required ? (
            <SectionReveal>
              <ServiceReadinessGate
                key={service.slug}
                service={service}
                services={services}
              />
            </SectionReveal>
          ) : (
            <SectionReveal>
              <ScrollChromeSection
                id="service-booking"
                className="service-content-block service-content-block--readiness service-direct-booking"
                aria-labelledby="service-booking-title"
              >
                <div className="service-content-block-heading">
                  <span aria-hidden="true">04</span>
                  <div>
                    <span>Your next step</span>
                    <h3 id="service-booking-title">Ready to get started?</h3>
                  </div>
                </div>

                <div className="service-readiness-gate-body">
                  <div className="service-readiness-gate-icon" aria-hidden="true">
                    <JourneyIcon name="check" size={26} />
                  </div>
                  <div>
                    <span className="eyebrow">Booking available</span>
                    <h2>{service.name}</h2>
                    <p>
                      Review the service details above, then choose a time to speak with Jake
                      about your goal and next steps.
                    </p>
                    {service.pricing_message && (
                      <p className="service-tailored-pricing">{service.pricing_message}</p>
                    )}
                  </div>
                  <a
                    href={service.cta_url}
                    className="btn btn-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {service.cta_text}
                    <JourneyIcon name="arrowRight" size={17} />
                  </a>
                </div>
              </ScrollChromeSection>
            </SectionReveal>
          )}

          <section className="service-related-section" aria-labelledby="service-related-title">
            <SectionReveal>
              <div className="service-section-heading service-related-heading">
                <div>
                  <span className="eyebrow">Explore Other Services</span>
                  <h2 id="service-related-title">More coaching paths</h2>
                </div>
              </div>
            </SectionReveal>

            <div
              className="service-related-grid"
              role="region"
              aria-label="Other coaching services"
              tabIndex="0"
            >
              {others.map((candidate, index) => (
                <SectionReveal key={candidate.id} delay={Math.min(index * 0.06, 0.12)}>
                  <ServiceGlassCard service={candidate} />
                </SectionReveal>
              ))}
            </div>
          </section>
        </div>
      </div>

      <StickyBookBar
        service={service}
        services={services}
      />
    </div>
  )
}

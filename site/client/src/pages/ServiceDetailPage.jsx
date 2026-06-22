import { Link, useParams, Navigate } from 'react-router-dom'
import PageHero from '../components/PageHero'
import SectionReveal from '../components/SectionReveal'
import StickyBookBar from '../components/StickyBookBar'
import { useJSON } from '../hooks/useJSON'
import { useAssets } from '../hooks/useAssets'

export default function ServiceDetailPage() {
  const { slug } = useParams()
  const { data: services } = useJSON('/content/services.json')
  const resolveAsset = useAssets()

  if (!services) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 1.5rem', color: 'var(--color-text-muted)' }}>
        Loading&hellip;
      </div>
    )
  }

  const service = services.find((s) => s.slug === slug)
  if (!service) {
    return <Navigate to="/services" replace />
  }

  const others = services.filter((s) => s.slug !== slug)

  return (
    <>
      <PageHero
        eyebrow="Coaching Package"
        title={service.name}
        subtitle={service.tagline}
      />

      <section className="service-detail-page section">
        <div className="container">
          <SectionReveal inView={false}>
            <div className="service-detail-body">
              <Link to="/services" className="service-back-link">
                &larr; All Services
              </Link>

              <p style={{ marginBottom: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                {service.description}
              </p>

              <h3 style={{ marginBottom: 'var(--space-5)', fontSize: '1.125rem' }}>
                What&apos;s Included
              </h3>
              <ul className="includes-list" style={{ marginBottom: 'var(--space-8)' }}>
                {service.includes.map((item) => (
                  <li key={item.title} className="includes-item">
                    <img
                      src={resolveAsset(item.icon)}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="includes-item-text">
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {service.who_its_for && (
                <>
                  <h3 style={{ marginBottom: 'var(--space-4)', fontSize: '1.125rem' }}>
                    You&apos;re a Great Fit If&hellip;
                  </h3>
                  <ul
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                      marginBottom: 'var(--space-8)',
                    }}
                  >
                    {service.who_its_for.map((item) => (
                      <li
                        key={item}
                        style={{
                          display: 'flex',
                          gap: 'var(--space-3)',
                          alignItems: 'flex-start',
                          color: 'var(--color-text-muted)',
                          fontSize: '0.9375rem',
                        }}
                      >
                        <span
                          style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: '2px' }}
                        >
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {service.pricing && (
                <p
                  style={{
                    color: 'var(--color-accent)',
                    fontWeight: 700,
                    fontSize: '1.125rem',
                    marginBottom: 'var(--space-6)',
                  }}
                >
                  {service.pricing}
                </p>
              )}

              {service.federations && (
                <p
                  style={{
                    color: 'var(--color-text-muted)',
                    fontSize: '0.875rem',
                    marginBottom: 'var(--space-8)',
                  }}
                >
                  <strong style={{ color: 'var(--color-text)' }}>Supported Federations:</strong>{' '}
                  {service.federations.join(' · ')}
                </p>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <a
                  href={service.cta_url}
                  className="btn btn-primary btn-lg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {service.cta_text}
                </a>
                {service.application_required && (
                  <span className="badge" style={{ alignSelf: 'center' }}>
                    Application Required
                  </span>
                )}
              </div>
            </div>
          </SectionReveal>

          {others.length > 0 && (
            <div className="explore-others">
              <span className="explore-others-label">Explore other services</span>
              <div className="explore-others-links">
                {others.map((s) => (
                  <Link key={s.slug} to={`/services/${s.slug}`} className="filter-btn">
                    {s.name} &rarr;
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <StickyBookBar service={service} />
    </>
  )
}

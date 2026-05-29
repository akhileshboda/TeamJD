import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import CTABanner from '../components/CTABanner'
import SectionReveal from '../components/SectionReveal'
import { useJSON } from '../hooks/useJSON'
import { useAssets } from '../hooks/useAssets'

function ServiceDetail({ service, resolveAsset }) {
  return (
    <section className="service-detail section" id={service.id}>
      <div className="container">
        <SectionReveal>
          <div style={{ maxWidth: '780px' }}>
            <span className="accent-line" />
            <h2>{service.name}</h2>
            <p className="service-tagline">{service.tagline}</p>
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
                      <span style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: '2px' }}>
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
      </div>
    </section>
  )
}

export default function Services() {
  const { data: services } = useJSON('/content/services.json')
  const resolveAsset = useAssets()

  return (
    <>
      <PageHero
        eyebrow="Coaching Packages"
        title="Pick Your Path."
        subtitle="Every service is 100% personalised to your goals, your body, and your timeline. No templates. No copy-paste programs. No shortcuts."
      />

      {/* Quick Nav */}
      <div className="services-quick-nav">
        <div className="container">
          {['competition-prep', 'online-coaching', 'personal-training', 'posing-only'].map(
            (id) => (
              <a key={id} href={`#${id}`} className="filter-btn">
                {id
                  .split('-')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ')}
              </a>
            )
          )}
        </div>
      </div>

      {/* Service sections */}
      {services
        ? services.map((service, i) => (
            <div key={service.id}>
              <ServiceDetail service={service} resolveAsset={resolveAsset} />
              {i < services.length - 1 && (
                <hr
                  className="divider"
                  style={{ marginInline: 'var(--container-pad)' }}
                />
              )}
            </div>
          ))
        : (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
            Loading services&hellip;
          </div>
        )}

      {/* CTA */}
      <CTABanner
        title="Not Sure Which Is Right for You?"
        description="Book a free 15-minute consultation. Jake will help you figure out the best path based on your goals, experience, and lifestyle."
        secondaryLabel="Get in Touch"
        secondaryTo="/contact"
        eyebrow=""
      />
    </>
  )
}

import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import CredibilityStrip from '../components/CredibilityStrip'
import ServiceCard from '../components/ServiceCard'
import ResultCard from '../components/ResultCard'
import TestimonialCard from '../components/TestimonialCard'
import FAQItem from '../components/FAQItem'
import CTABanner from '../components/CTABanner'
import Lightbox from '../components/Lightbox'
import SectionReveal, { StaggerContainer, StaggerItem } from '../components/SectionReveal'
import { useJSON } from '../hooks/useJSON'
import { useAssets } from '../hooks/useAssets'
import { useState } from 'react'

export default function Home() {
  const { data: services } = useJSON('/content/services.json')
  const { data: testimonials } = useJSON('/content/testimonials.json')
  const { data: faqs } = useJSON('/content/faqs.json')
  const { data: results } = useJSON('/content/results.json')
  const resolveAsset = useAssets()
  const [lightboxImage, setLightboxImage] = useState(null)

  const previewResults = results?.slice(0, 3) || []
  const previewTestimonials = testimonials?.slice(0, 3) || []

  return (
    <>
      {/* Hero */}
      <Hero />

      {/* Credibility Strip */}
      <CredibilityStrip />

      {/* Services Overview */}
      <section className="section" aria-labelledby="services-heading">
        <div className="container">
          <SectionReveal>
            <div className="section-header">
              <span className="eyebrow">What We Offer</span>
              <h2 id="services-heading">Pick Your Path.</h2>
              <p>
                Every coaching package is built around your goals, your lifestyle, and your
                potential. No templates. No shortcuts.
              </p>
            </div>
          </SectionReveal>

          <StaggerContainer className="grid-service-tiles">
            {services
              ? services.map((service) => (
                  <StaggerItem key={service.id}>
                    <ServiceCard service={service} />
                  </StaggerItem>
                ))
              : Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="service-tile service-tile--skeleton"
                    aria-hidden="true"
                  />
                ))}
          </StaggerContainer>

          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <Link to="/services" className="btn btn-secondary">
              View All Services &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Results Preview */}
      <section
        className="section"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBlock: '1px solid var(--color-border)',
        }}
        aria-labelledby="results-heading"
      >
        <div className="container">
          <SectionReveal>
            <div className="section-header">
              <span className="eyebrow">Real Results</span>
              <h2 id="results-heading">Clients Who Showed Up.</h2>
              <p>
                These aren&apos;t stock photos. These are real people who committed to the
                process and delivered on stage.
              </p>
            </div>
          </SectionReveal>

          <StaggerContainer className="grid-results">
            {previewResults.map((result) => (
              <StaggerItem key={result.id}>
                <ResultCard result={result} onOpen={setLightboxImage} />
              </StaggerItem>
            ))}
          </StaggerContainer>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link to="/results" className="btn btn-outline">
              View All Results &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* About Teaser */}
      <section className="section" aria-labelledby="about-heading">
        <div className="container">
          <SectionReveal>
            <div className="two-col-grid-center">
              <div>
                <span className="eyebrow">Meet Your Coach</span>
                <h2 id="about-heading" style={{ marginBottom: '1.25rem' }}>
                  I&apos;m Jake.
                  <br />
                  This is Personal.
                </h2>
                <p
                  style={{
                    color: 'var(--color-text-muted)',
                    marginBottom: '1.25rem',
                    fontSize: '1.0625rem',
                    lineHeight: 1.75,
                  }}
                >
                  I&apos;m a professional bodybuilder and fitness and nutrition coach dedicated
                  to helping you achieve your unique goals. I believe in working with your
                  natural strengths while helping you push through your limitations — everything
                  I do is customised specifically for you.
                </p>
                <p
                  style={{
                    color: 'var(--color-text-muted)',
                    marginBottom: '2rem',
                    fontSize: '1.0625rem',
                    lineHeight: 1.75,
                  }}
                >
                  As a Champion Physique Bodybuilder and Competition Prep coach with extensive
                  experience, I&apos;ve helped hundreds of clients transform their body,
                  mindset, and lifestyle.
                </p>
                <Link to="/about" className="btn btn-outline">
                  Learn About Jake &rarr;
                </Link>
              </div>

              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    aspectRatio: '3/4',
                    borderRadius: '1rem',
                    overflow: 'hidden',
                    backgroundColor: 'var(--color-surface)',
                  }}
                >
                  <img
                    src={resolveAsset('/api/assets/jake-hero')}
                    alt="Jake Dedert — Pro Physique bodybuilder and fitness coach"
                    loading="lazy"
                    decoding="async"
                    width="600"
                    height="800"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center top',
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-1.5rem',
                    left: '-1.5rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.75rem',
                    padding: '1.25rem 1.5rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--color-accent)',
                      fontWeight: 700,
                      marginBottom: '0.25rem',
                    }}
                  >
                    Pro Physique
                  </div>
                  <div
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 800,
                      color: 'var(--color-white)',
                    }}
                  >
                    Champion Bodybuilder
                  </div>
                </div>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* Testimonials */}
      <section
        className="section"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBlock: '1px solid var(--color-border)',
        }}
        aria-labelledby="testimonials-heading"
      >
        <div className="container">
          <SectionReveal>
            <div className="section-header">
              <span className="eyebrow">Client Stories</span>
              <h2 id="testimonials-heading">What They&apos;re Saying.</h2>
              <p>
                Real words from real clients who trusted the process and showed up every day.
              </p>
            </div>
          </SectionReveal>

          <StaggerContainer className="grid-testimonials">
            {previewTestimonials.map((t) => (
              <StaggerItem key={t.id}>
                <TestimonialCard testimonial={t} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" aria-labelledby="faq-heading">
        <div className="container">
          <SectionReveal>
            <div className="section-header">
              <span className="eyebrow">Common Questions</span>
              <h2 id="faq-heading">Got Questions?</h2>
              <p>Everything you need to know before taking the next step.</p>
            </div>
          </SectionReveal>

          <div className="faq-list">
            {faqs?.map((faq) => (
              <SectionReveal key={faq.id} delay={0}>
                <FAQItem faq={faq} />
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTABanner />

      {/* Lightbox */}
      <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  )
}

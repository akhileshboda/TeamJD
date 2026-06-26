import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import Hero from '../components/Hero'
import CredibilityStrip from '../components/CredibilityStrip'
import AppleWatchGallery from '../components/AppleWatchGallery'
import FAQItem from '../components/FAQItem'
import CTABanner from '../components/CTABanner'

import SectionReveal, { StaggerContainer, StaggerItem } from '../components/SectionReveal'
import { useJSON } from '../hooks/useJSON'
import { useAssets } from '../hooks/useAssets'


const servicePathways = [
  {
    id: 'competition-prep',
    label: 'Getting stage-ready',
    title: 'You have a date, a division, and no room for guesswork.',
    copy:
      'Jake helps tighten the details that matter most: training, nutrition, posing, peak week, and the decisions that keep prep moving with purpose.',
    fit: 'Best fit: competitors who want a complete prep strategy',
    fallbackName: 'Competition Preparation',
    fallbackSlug: 'competition-preparation',
    fallbackImage: 'jake-stage',
  },
  {
    id: 'online-coaching',
    label: 'Building structure online',
    title: 'You want coaching that travels with your actual life.',
    copy:
      'Your program, nutrition, check-ins, and accountability are shaped around your schedule, equipment, goals, and feedback instead of a generic template.',
    fit: 'Best fit: remote clients who want personal accountability',
    fallbackName: 'Online Coaching',
    fallbackSlug: 'online-coaching',
    fallbackImage: 'service-online-coaching',
  },
  {
    id: 'personal-training',
    label: 'Training in person',
    title: 'You want hands-on coaching and immediate correction.',
    copy:
      'Jake works with you session by session to build better movement, confidence under load, and a training rhythm you can actually trust.',
    fit: 'Best fit: Melbourne-based clients who want direct guidance',
    fallbackName: 'Personal Training',
    fallbackSlug: 'personal-training',
    fallbackImage: 'service-personal-training',
  },
  {
    id: 'posing-only',
    label: 'Sharpening presentation',
    title: 'You have the physique, now it needs to read on stage.',
    copy:
      'Posing work focuses on angles, transitions, stage confidence, and showing your strengths clearly under judging conditions.',
    fit: 'Best fit: competitors refining presentation and presence',
    fallbackName: 'Posing Only',
    fallbackSlug: 'posing-only',
    fallbackImage: 'service-posing',
  },
]

const MotionLink = motion.create(Link)

export default function Home() {
  const { data: services } = useJSON('/content/services.json')
  const { data: faqs } = useJSON('/content/faqs.json')
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()

  const servicesById = new Map((services || []).map((service) => [service.id, service]))
  const ServicePathwayLink = shouldReduce ? Link : MotionLink
  const pathwayMotion = shouldReduce
    ? {}
    : {
        whileHover: { y: -4 },
        whileFocus: { y: -4 },
        transition: { duration: 0.22, ease: 'easeOut' },
      }

  return (
    <>
      {/* Hero */}
      <Hero />

      {/* Credibility Strip */}
      <CredibilityStrip />

      {/* Personalised Services Guidance */}
      <section className="section home-services" aria-labelledby="services-heading">
        <div className="container">
          <SectionReveal>
            <div className="home-services-intro">
              <span className="eyebrow">How Jake Helps</span>
              <h2 id="services-heading">Find the Coaching That Fits Your Next Move.</h2>
              <p>
                Jake does not start with a package. He starts with your goal, your timeline,
                your training history, and the level of accountability you need to move with
                confidence.
              </p>
            </div>
          </SectionReveal>

          <StaggerContainer className="home-service-pathways">
            {servicePathways.map((pathway, index) => {
              const service = servicesById.get(pathway.id)
              const serviceName = service?.name || pathway.fallbackName
              const serviceSlug = service?.slug || pathway.fallbackSlug
              const backgroundSrc = resolveAsset(service?.hero_image || pathway.fallbackImage)

              return (
                <StaggerItem key={pathway.id}>
                  <ServicePathwayLink
                    to={`/services/${serviceSlug}`}
                    className="home-service-pathway"
                    aria-label={`${pathway.label}: explore ${serviceName}`}
                    style={{ '--pathway-bg': `url("${backgroundSrc}")` }}
                    {...pathwayMotion}
                  >
                    <span className="home-service-pathway-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="home-service-pathway-label">{pathway.label}</span>
                    <h3>{pathway.title}</h3>
                    <p>{pathway.copy}</p>
                    <span className="home-service-pathway-fit">{pathway.fit}</span>
                    <span className="home-service-pathway-cta">
                      Explore {serviceName} &rarr;
                    </span>
                  </ServicePathwayLink>
                </StaggerItem>
              )
            })}
          </StaggerContainer>

          <SectionReveal delay={0.08}>
            <div className="home-services-consult">
              <div>
                <span className="home-services-consult-kicker">Not sure yet?</span>
                <h3>Bring Jake the goal. He&apos;ll help shape the route.</h3>
                <p>
                  A quick consult is the easiest way to figure out whether you need prep,
                  online structure, in-person coaching, posing work, or a blend of support.
                </p>
              </div>
              <div className="home-services-consult-actions">
                <a
                  href="https://calendly.com/team-jd/15min"
                  className="btn btn-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Book a Free Consult
                </a>
                <Link to="/services" className="btn btn-secondary">
                  View All Services &rarr;
                </Link>
              </div>
            </div>
          </SectionReveal>

        </div>
      </section>

      {/* Interactive Results + Testimonials Gallery */}
      <AppleWatchGallery />

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


    </>
  )
}

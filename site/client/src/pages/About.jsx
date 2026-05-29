import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import CTABanner from '../components/CTABanner'
import SectionReveal from '../components/SectionReveal'
import { useAssets } from '../hooks/useAssets'

const STATS = [
  { value: '100+', label: 'Clients Transformed' },
  { value: '6+', label: 'Federations Supported' },
  { value: 'Pro', label: 'Physique Competitor' },
  { value: '100%', label: 'Customised Coaching' },
]

const FEDERATIONS = ['ifbb', 'nabba', 'inba', 'icn', 'fmg', 'anb']

export default function About() {
  const resolveAsset = useAssets()

  return (
    <>
      <PageHero
        eyebrow="About Jake"
        title="The Coach Behind the Brand."
        subtitle="A genuine commitment to your success — built on experience, trust, and a deep passion for helping people become the best version of themselves."
      />

      {/* Bio Section */}
      <section className="section">
        <div className="container">
          <div className="two-col-grid">
            {/* Photo */}
            <SectionReveal>
              <div className="about-photo-wrap">
                <div
                  style={{
                    aspectRatio: '3/4',
                    borderRadius: '1rem',
                    overflow: 'hidden',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <img
                    src={resolveAsset('/api/assets/jake-hero')}
                    alt="Jake Dedert — Pro Physique bodybuilder and fitness coach posing in gym"
                    decoding="async"
                    fetchPriority="high"
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
                    marginTop: '1.5rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.75rem',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'center',
                  }}
                >
                  <img
                    src={resolveAsset('/api/assets/logo-mark')}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain' }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--color-white)', fontSize: '0.9375rem' }}>
                      Jake Dedert
                    </div>
                    <div style={{ color: 'var(--color-accent)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      Pro Physique Champion &amp; Coach
                    </div>
                  </div>
                </div>
              </div>
            </SectionReveal>

            {/* Copy */}
            <SectionReveal delay={0.1}>
              <div>
                <span className="accent-line" />
                <h2 style={{ marginBottom: '1.5rem' }}>Who I Am.</h2>

                <p style={{ color: 'var(--color-text-muted)', fontSize: '1.0625rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>
                  I&apos;m Jake, a professional bodybuilder and fitness and nutrition coach
                  dedicated to helping you achieve your unique goals. I believe in working with
                  your natural strengths while helping you push through your limitations —
                  everything I do is customised specifically for you.
                </p>

                <p style={{ color: 'var(--color-text-muted)', fontSize: '1.0625rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>
                  As a Champion Physique Bodybuilder, Competition Prep coach, and Personal
                  Trainer with extensive experience in the fitness industry, I&apos;ve helped
                  hundreds of clients achieve their health and fitness goals, transform their
                  lifestyle and mindset, and dramatically improve their body composition.
                </p>

                <p style={{ color: 'var(--color-text-muted)', fontSize: '1.0625rem', lineHeight: 1.8, marginBottom: '2.5rem' }}>
                  Whether you&apos;re looking to compete, build muscle, lose fat, or simply
                  feel stronger and more confident in your own skin, I&apos;ll create a
                  personalised plan that fits your life and gets you real results.
                </p>

                <div className="stats-grid">
                  {STATS.map(({ value, label }) => (
                    <div key={label} className="stat-card">
                      <div className="stat-value">{value}</div>
                      <div className="stat-label">{label}</div>
                    </div>
                  ))}
                </div>

                <a
                  href="https://calendly.com/team-jd/15min"
                  className="btn btn-primary btn-lg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Work With Jake
                </a>
              </div>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section
        className="section"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBlock: '1px solid var(--color-border)',
        }}
      >
        <div className="container">
          <SectionReveal>
            <div style={{ maxWidth: '780px', marginInline: 'auto', textAlign: 'center' }}>
              <span className="eyebrow">Coaching Philosophy</span>
              <h2 style={{ marginBottom: '1.5rem' }}>More Than a Trainer.</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '1.125rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>
                At the heart of everything I do is a genuine commitment to helping people.
                Fitness isn&apos;t just about individual achievement — it&apos;s about building
                a supportive community where everyone can thrive. I believe that when we lift
                each other up, we all become stronger.
              </p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '1.125rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>
                My approach is rooted in understanding that every person&apos;s journey is
                different, and my primary focus is simply helping you become the best version
                of yourself. Whether you&apos;re just starting out or you&apos;re an
                experienced athlete, you&apos;ll find a welcoming, judgment-free environment
                where your success is my success.
              </p>
              <blockquote
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: 'var(--color-white)',
                  borderLeft: '3px solid var(--color-accent)',
                  paddingLeft: '1.5rem',
                  textAlign: 'left',
                  marginTop: '2.5rem',
                  fontStyle: 'italic',
                }}
              >
                &ldquo;Your goals become my goals. Your success is what drives me forward.&rdquo;
              </blockquote>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* Federation Strip */}
      <section className="section-sm" aria-labelledby="federations-heading">
        <div className="container">
          <p
            id="federations-heading"
            className="text-upper text-muted"
            style={{ textAlign: 'center', marginBottom: '2rem' }}
          >
            Federations Supported
          </p>
          <SectionReveal>
            <div className="federation-strip">
              {FEDERATIONS.map((fed) => (
                <img
                  key={fed}
                  className="federation-logo"
                  src={resolveAsset(`/api/assets/${fed}`)}
                  alt={`${fed.toUpperCase()} Federation`}
                  loading="lazy"
                  decoding="async"
                  width="80"
                  height="40"
                />
              ))}
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* CTA */}
      <CTABanner
        title="Ready to Work Together?"
        description="Book a free 15-minute consultation and let's talk about what's possible for you. No obligation — just an honest conversation."
        primaryLabel="Book a Free Consult"
        secondaryLabel="View Services"
        secondaryTo="/services"
        eyebrow=""
      />
    </>
  )
}

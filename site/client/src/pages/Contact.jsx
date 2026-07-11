import PageHero from '../components/PageHero'
import SectionReveal from '../components/SectionReveal'

const BOOKING_OPTIONS = [
  {
    href: 'https://calendly.com/team-jd/15min',
    label: 'Free 15-Min Consultation',
    description: 'Discuss your goals and find the right service — ideal for online coaching & personal training',
    icon: '📅',
    featured: true,
    iconBg: 'var(--color-accent-glow)',
    iconBorder: 'rgba(22,201,221,0.3)',
  },
  {
    href: 'https://calendly.com/team-jd/30min',
    label: 'Competition Prep Consultation',
    description: '30 minutes — for those serious about getting on stage. Application required.',
    icon: '🏆',
    featured: false,
    iconBg: 'var(--color-surface-2)',
    iconBorder: 'var(--color-border)',
  },
  {
    href: 'https://calendly.com/team-jd/1-on-1-posing-session',
    label: 'Posing Session',
    description: 'Book directly for posing instruction — all federations welcome.',
    icon: '💪',
    featured: false,
    iconBg: 'var(--color-surface-2)',
    iconBorder: 'var(--color-border)',
  },
]

export default function Contact() {
  return (
    <>
      <PageHero
        eyebrow="Let's Talk"
        title="Ready to Start?"
        subtitle="The first step is simple. Book a free 15-minute call and let's figure out the best path for your goals. No pressure, no obligation."
      />

      <section className="section">
        <div className="container">
          <div className="two-col-grid">
            {/* Booking Options */}
            <SectionReveal>
              <div>
                <span className="accent-line" />
                <h2 style={{ marginBottom: '1rem' }}>Book Your Free Consult.</h2>
                <p
                  style={{
                    color: 'var(--color-text-muted)',
                    marginBottom: '2rem',
                    fontSize: '1.0625rem',
                    lineHeight: 1.7,
                  }}
                >
                  The best way to get started is a quick 15-minute call. Jake will listen to
                  your goals, answer your questions, and help you understand which service is
                  the right fit — with zero pressure.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                  {BOOKING_OPTIONS.map(({ href, label, description, icon, featured, iconBg, iconBorder }) => (
                    <a
                      key={href}
                      href={href}
                      className={`booking-card${featured ? ' featured' : ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div
                          className="booking-icon"
                          style={{ background: iconBg, border: `1px solid ${iconBorder}` }}
                        >
                          {icon}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--color-white)', marginBottom: '0.25rem' }}>
                            {label}
                          </div>
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                            {description}
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>

                {/* Social Links */}
                <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                  <p
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: '0.875rem',
                      marginBottom: '1rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Connect on Social
                  </p>
                  <a
                    href="https://www.instagram.com/jakededert/"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: 'var(--color-text-muted)',
                      fontSize: '0.9375rem',
                      transition: 'color 150ms ease',
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-hover-accent)')}
                    onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                    @jakededert (Instagram)
                  </a>
                </div>
              </div>
            </SectionReveal>

            {/* Contact Form */}
            <SectionReveal delay={0.1}>
              <div>
                <span className="accent-line" />
                <h2 style={{ marginBottom: '0.5rem' }}>Send a Message.</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.9375rem' }}>
                  Prefer to write first? Send Jake a message below. This form submits directly
                  to email.{' '}
                  <strong style={{ color: 'var(--color-accent)' }}>Note:</strong> For fastest
                  response, use Calendly to book your consult above.
                </p>

                <form
                  action="mailto:jake@team-jd.com.au"
                  method="POST"
                  encType="text/plain"
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                >
                  <div className="form-name-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="contact-first">
                        First Name
                      </label>
                      <input
                        className="form-input"
                        type="text"
                        id="contact-first"
                        name="first_name"
                        placeholder="Jake"
                        autoComplete="given-name"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="contact-last">
                        Last Name
                      </label>
                      <input
                        className="form-input"
                        type="text"
                        id="contact-last"
                        name="last_name"
                        placeholder="Smith"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="contact-email">
                      Email Address
                    </label>
                    <input
                      className="form-input"
                      type="email"
                      id="contact-email"
                      name="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="contact-service">
                      Interested In
                    </label>
                    <select
                      className="form-input form-select"
                      id="contact-service"
                      name="service"
                      style={{
                        backgroundImage:
                          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23888' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 1rem center',
                        backgroundSize: '1rem',
                      }}
                    >
                      <option value="">Select a service&hellip;</option>
                      <option value="competition-prep">Competition Preparation</option>
                      <option value="online-coaching">Online Coaching</option>
                      <option value="personal-training">Personal Training</option>
                      <option value="posing-only">Posing</option>
                      <option value="unsure">Not Sure Yet</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="contact-message">
                      Your Message
                    </label>
                    <textarea
                      className="form-textarea"
                      id="contact-message"
                      name="message"
                      placeholder="Tell Jake about your goals, current fitness level, and what you're looking to achieve..."
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary btn-lg" style={{ alignSelf: 'flex-start' }}>
                    Send Message
                  </button>
                  <p style={{ color: 'var(--color-text-subtle)', fontSize: '0.8125rem', marginTop: '-0.5rem' }}>
                    This form opens your email client to send the message. For instant booking,
                    use{' '}
                    <a
                      href="https://calendly.com/team-jd/15min"
                      style={{ color: 'var(--color-accent)' }}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Calendly
                    </a>
                    .
                  </p>
                </form>
              </div>
            </SectionReveal>
          </div>
        </div>
      </section>
    </>
  )
}

import PageHero from '../components/PageHero'
import SectionReveal from '../components/SectionReveal'
import FindYourFitLink from '../components/FindYourFitLink'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { useSettings } from '../hooks/useSettings'

export default function Privacy() {
  usePageMeta({ page: 'privacy' })
  const { contact } = useSettings()
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy Policy" subtitle="Last updated: August 2026" />

      <section className="section">
        <div className="container">
          <SectionReveal>
            <div className="prose-card">
              <div>
                <h2>1. Introduction</h2>
                <p>
                  Jake Dedert trading as Team JD (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
                  &ldquo;our&rdquo;) is committed to protecting your personal information. This
                  Privacy Policy explains how we collect, use, disclose, and safeguard your
                  information when you visit our website team-jd.com.au or engage with our
                  coaching services.
                </p>
              </div>

              <hr className="prose-divider" />

              <div>
                <h2>2. Information We Collect</h2>
                <p>We may collect information that you provide directly to us, including:</p>
                <ul className="prose-list" style={{ marginTop: '0.75rem' }}>
                  {[
                    'Name, email address, and contact information',
                    'Fitness goals, health history, and progress photos (for coaching purposes)',
                    'Communication records (emails, messages via coaching app)',
                    'Payment information (processed securely through third-party providers)',
                    'Booking information via Calendly (subject to Calendly\'s own Privacy Policy)',
                  ].map((item) => (
                    <li key={item}>
                      <span className="arrow">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p style={{ marginTop: '0.75rem' }}>
                  We also count visits to this website to understand which pages are useful. This uses no
                  cookies and stores no IP address: only the page viewed, the date, the type of device, and
                  the general source of the visit (for example, Instagram or a search engine).
                </p>
              </div>

              <hr className="prose-divider" />

              <div>
                <h2>3. How We Use Your Information</h2>
                <p>We use the information we collect to:</p>
                <ul className="prose-list" style={{ marginTop: '0.75rem' }}>
                  {[
                    'Provide and personalise our coaching services',
                    'Monitor your progress and adjust your program',
                    'Communicate with you about sessions, programs, and updates',
                    'Process bookings and payments',
                    'Improve our website and services',
                  ].map((item) => (
                    <li key={item}>
                      <span className="arrow">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <hr className="prose-divider" />

              <div>
                <h2>4. Photos and Progress Images</h2>
                <p>
                  Progress photos you share are used solely for coaching purposes. We will
                  never share your photos publicly without your explicit written consent. If you
                  provide consent for your photos to be used for marketing purposes (e.g.,
                  results gallery), you may withdraw that consent at any time by contacting us.
                </p>
              </div>

              <hr className="prose-divider" />

              <div>
                <h2>5. Third-Party Services</h2>
                <p>We use third-party services that may collect information. These include:</p>
                <ul className="prose-list" style={{ marginTop: '0.75rem' }}>
                  <li>
                    <span className="arrow">→</span>
                    <span>
                      <strong style={{ color: 'var(--color-text)' }}>Calendly</strong> —
                      appointment scheduling (subject to{' '}
                      <a
                        href="https://calendly.com/privacy"
                        style={{ color: 'var(--color-accent)' }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Calendly&apos;s Privacy Policy
                      </a>
                      )
                    </span>
                  </li>
                  <li>
                    <span className="arrow">→</span>
                    <span>
                      <strong style={{ color: 'var(--color-text)' }}>Payment processors</strong>
                      {' '}— for billing and transactions
                    </span>
                  </li>
                  <li>
                    <span className="arrow">→</span>
                    <span>
                      <strong style={{ color: 'var(--color-text)' }}>Coaching apps</strong> — for
                      program delivery and progress tracking
                    </span>
                  </li>
                  <li>
                    <span className="arrow">→</span>
                    <span>
                      <span>
                        <strong style={{ color: 'var(--color-text)' }}>Resend</strong> — to deliver
                        website enquiries and confirmation emails
                      </span>
                    </span>
                  </li>
                  <li>
                    <span className="arrow">→</span>
                    <span>
                      <span>
                        <strong style={{ color: 'var(--color-text)' }}>
                          Cloudflare Turnstile
                        </strong>{' '}
                        — to verify enquiry submissions and help prevent automated abuse
                      </span>
                    </span>
                  </li>
                </ul>
              </div>

              <hr className="prose-divider" />

              <div>
                <h2>6. Data Retention &amp; Security</h2>
                <p>
                  We retain your personal information for as long as necessary to provide our
                  services and comply with legal obligations. We implement appropriate security
                  measures to protect your data. However, no method of transmission over the
                  Internet is 100% secure.
                </p>
              </div>

              <hr className="prose-divider" />

              <div>
                <h2>7. Your Rights</h2>
                <p>Under Australian privacy law, you have the right to:</p>
                <ul className="prose-list" style={{ marginTop: '0.75rem' }}>
                  {[
                    'Access the personal information we hold about you',
                    'Request correction of inaccurate information',
                    'Request deletion of your data (subject to legal obligations)',
                    'Withdraw consent where processing is based on consent',
                  ].map((item) => (
                    <li key={item}>
                      <span className="arrow">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <hr className="prose-divider" />

              <div>
                <h2>8. Contact Us</h2>
                <p>
                  If you have questions about this Privacy Policy or wish to exercise your
                  rights, please contact us at{' '}
                  <a href={`mailto:${contact.email}`} style={{ color: 'var(--color-accent)' }}>
                    {contact.email}
                  </a>{' '}
                  or start with the{' '}
                  <FindYourFitLink style={{ color: 'var(--color-accent)' }}>
                    service finder
                  </FindYourFitLink>
                  .
                </p>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>
    </>
  )
}

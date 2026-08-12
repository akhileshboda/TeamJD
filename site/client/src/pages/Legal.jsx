import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHero from '../components/PageHero'
import SectionReveal from '../components/SectionReveal'
import LegalTabs from '../components/LegalTabs'
import FindYourFitLink from '../components/FindYourFitLink'

const TAB_META = {
  privacy: { title: 'Privacy Policy', path: '/privacy' },
  terms: { title: 'Terms & Conditions', path: '/terms' },
}

function PrivacyContent() {
  return (
    <div id="legal-panel-privacy" role="tabpanel" aria-labelledby="legal-tab-privacy" className="prose-card">
      <div>
        <h2>1. Introduction</h2>
        <p>
          Jake Dedert trading as Team JD (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
          &ldquo;our&rdquo;) coaches clients through team-jd.com.au and directly. This Privacy
          Policy sets out what information we collect through the site and through coaching, how
          we use it, and the choices you have over it.
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
          Progress photos you share are used solely for coaching purposes. We will never share
          your photos publicly without your explicit written consent. If you provide consent for
          your photos to be used for marketing purposes (e.g., results gallery), you may withdraw
          that consent at any time by contacting us.
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
              <strong style={{ color: 'var(--color-text)' }}>Calendly</strong> — appointment
              scheduling (subject to{' '}
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
            <strong style={{ color: 'var(--color-text)' }}>Payment processors</strong> — for
            billing and transactions
          </li>
          <li>
            <span className="arrow">→</span>
            <strong style={{ color: 'var(--color-text)' }}>Coaching apps</strong> — for program
            delivery and progress tracking
          </li>
          <li>
            <span className="arrow">→</span>
            <span>
              <strong style={{ color: 'var(--color-text)' }}>Resend</strong> — to deliver website
              enquiries and confirmation emails
            </span>
          </li>
          <li>
            <span className="arrow">→</span>
            <span>
              <strong style={{ color: 'var(--color-text)' }}>Cloudflare Turnstile</strong> — to
              verify enquiry submissions and help prevent automated abuse
            </span>
          </li>
        </ul>
      </div>

      <hr className="prose-divider" />

      <div>
        <h2>6. Data Retention &amp; Security</h2>
        <p>
          We keep your information only for as long as it&apos;s needed to deliver your coaching
          program and meet our record-keeping obligations — after that, we delete it. We take
          reasonable steps to protect it, including restricted access to coaching and payment
          platforms, but no online system is completely immune to compromise, so we can&apos;t
          guarantee absolute security.
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
          If you have questions about this Privacy Policy or wish to exercise your rights, please
          contact us at{' '}
          <a href="mailto:jake@team-jd.com.au" style={{ color: 'var(--color-accent)' }}>
            jake@team-jd.com.au
          </a>{' '}
          or start with the{' '}
          <FindYourFitLink style={{ color: 'var(--color-accent)' }}>
            service finder
          </FindYourFitLink>
          .
        </p>
      </div>
    </div>
  )
}

function TermsContent() {
  return (
    <div id="legal-panel-terms" role="tabpanel" aria-labelledby="legal-tab-terms" className="prose-card">
      <div>
        <h2>1. Scope of These Terms</h2>
        <p>
          These Terms &amp; Conditions govern your engagement with Jake Dedert trading as Team JD
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) for competition preparation,
          online coaching, personal training, and posing services. By booking a consultation or
          starting a coaching program, you agree to these terms.
        </p>
      </div>

      <hr className="prose-divider" />

      <div>
        <h2>2. Bookings &amp; Payment</h2>
        <p>
          Coaching engagements start with a consultation booked via Calendly. Program pricing,
          payment schedule, and start date are confirmed with you directly before your program
          begins.{' '}
          {/* TODO(legal-review): confirm actual payment cadence (upfront vs. recurring) and
              late-payment handling with Jake before launch. */}
          We don&apos;t enrol you in ongoing billing without your confirmation.
        </p>
      </div>

      <hr className="prose-divider" />

      <div>
        <h2>3. Cancellations &amp; Rescheduling</h2>
        <p>
          If you need to cancel or reschedule a session, please give at least 24 hours&apos;
          notice where possible.{' '}
          {/* TODO(legal-review): confirm actual cancellation notice window and any
              late-cancellation fee with Jake — this is an industry-standard placeholder, not a
              confirmed policy. */}
          Cancelling or pausing a program is handled case by case — contact us as soon as your
          circumstances change.
        </p>
      </div>

      <hr className="prose-divider" />

      <div>
        <h2>4. Refunds</h2>
        <p>
          Coaching results depend on your consistency and circumstances, so we don&apos;t
          guarantee outcomes and don&apos;t offer refunds once a program has started, except where
          required by the Australian Consumer Law.{' '}
          {/* TODO(legal-review): confirm refund handling for cancellations made before a
              program starts with Jake. */}
        </p>
      </div>

      <hr className="prose-divider" />

      <div>
        <h2>5. Health Disclosure &amp; Assumption of Risk</h2>
        <p>
          Physical training carries an inherent risk of injury. Before starting, tell us about any
          medical conditions, injuries, or health concerns that could affect your training — we
          rely on this information to program safely for you. If you have any doubt about your
          fitness to train, check with a doctor first. You take part in training and competition
          preparation voluntarily and at your own risk, to the extent the law allows.
        </p>
      </div>

      <hr className="prose-divider" />

      <div>
        <h2>6. Liability</h2>
        <p>
          To the extent permitted by law, we aren&apos;t liable for injury, loss, or damage arising
          from your participation in coaching, except where that liability can&apos;t be excluded
          under the Australian Consumer Law — including our obligation to provide services with
          due care and skill. Nothing in these Terms excludes, restricts, or modifies any consumer
          guarantee that applies to our services.
        </p>
      </div>

      <hr className="prose-divider" />

      <div>
        <h2>7. Photos &amp; Content</h2>
        <p>
          Progress photos and any use of your images for marketing are covered by our{' '}
          <a href="/privacy" style={{ color: 'var(--color-accent)' }}>
            Privacy Policy
          </a>{' '}
          — the same consent and withdrawal rights described there apply here.
        </p>
      </div>

      <hr className="prose-divider" />

      <div>
        <h2>8. Changes to These Terms &amp; Governing Law</h2>
        <p>
          We may update these Terms as our coaching services change; the current version on this
          page always applies. These Terms are governed by the laws of South Australia, Australia,
          and apply to services we provide in Australia — they don&apos;t claim to comply with, or
          extend rights under, any other jurisdiction&apos;s law.
        </p>
      </div>

      <hr className="prose-divider" />

      <div>
        <h2>9. Contact Us</h2>
        <p>
          If you have questions about these Terms, please contact us at{' '}
          <a href="mailto:jake@team-jd.com.au" style={{ color: 'var(--color-accent)' }}>
            jake@team-jd.com.au
          </a>{' '}
          or start with the{' '}
          <FindYourFitLink style={{ color: 'var(--color-accent)' }}>
            service finder
          </FindYourFitLink>
          .
        </p>
      </div>
    </div>
  )
}

export default function Legal({ initialTab = 'privacy' }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const navigate = useNavigate()

  function handleTabChange(nextTab) {
    if (nextTab === activeTab) return
    setActiveTab(nextTab)
    navigate(TAB_META[nextTab].path, { replace: true })
  }

  return (
    <>
      <PageHero eyebrow="Legal" title={TAB_META[activeTab].title} subtitle="Last updated: August 2026" />

      <section className="section">
        <div className="container">
          <LegalTabs activeTab={activeTab} onChange={handleTabChange} />
          <SectionReveal>
            {activeTab === 'privacy' ? <PrivacyContent /> : <TermsContent />}
          </SectionReveal>
        </div>
      </section>
    </>
  )
}

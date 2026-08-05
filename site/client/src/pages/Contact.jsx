import { useCallback, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ContactMediaReel from '../components/ContactMediaReel'
import ContactSocialCarousel from '../components/ContactSocialCarousel'
import FindYourFitLink from '../components/FindYourFitLink'
import JourneyIcon from '../components/JourneyIcon'
import SectionReveal from '../components/SectionReveal'
import TurnstileWidget from '../components/TurnstileWidget'
import { useAssets } from '../hooks/useAssets'

const SERVICES = [
  {
    index: '01',
    to: '/services/competition-preparation',
    label: 'Competition Preparation',
    description: 'Stage strategy, physique development, and presentation built around a realistic timeline.',
  },
  {
    index: '02',
    to: '/services/online-coaching',
    label: 'Online Coaching',
    description: 'Training, nutrition, check-ins, and accountability wherever you are.',
  },
  {
    index: '03',
    to: '/services/personal-training',
    label: 'Personal Training',
    description: 'One-to-one coaching and technique work in Adelaide.',
  },
  {
    index: '04',
    to: '/services/posing-only',
    label: 'Posing',
    description: 'Focused presentation, transitions, and stage presence.',
  },
]

const CONTACT_SERVICE_VALUES = new Set([
  'competition-prep',
  'online-coaching',
  'personal-training',
  'posing-only',
  'unsure',
  'general',
])

function createSubmissionId() {
  return crypto.randomUUID()
}

const SOCIAL_POSTS = [
  {
    id: 'facebook-490737829725503',
    asset: 'gallery-social-facebook-stage-2022',
    href: 'https://www.facebook.com/photo/?fbid=490737829725503',
    label: 'Stage work',
    alt: 'Jake standing with another physique competitor on stage',
  },
  {
    id: 'facebook-490737826392170',
    asset: 'gallery-social-facebook-editorial-2022',
    href: 'https://www.facebook.com/photo/?fbid=490737826392170',
    label: 'Editorial physique',
    alt: 'Jake posing during an industrial-location fitness photoshoot',
  },
  {
    id: 'facebook-733438047252501',
    asset: 'gallery-social-facebook-coaching-2020',
    href: 'https://www.facebook.com/photo/?fbid=733438047252501',
    label: 'Competition day',
    alt: 'Jake with two competitors at an ICN South Australia event',
  },
  {
    id: 'facebook-383852782211031',
    asset: 'gallery-social-facebook-training-detail-2019',
    href: 'https://www.facebook.com/photo/?fbid=383852782211031',
    label: 'Training detail',
    alt: 'Side profile of Jake training in a gym',
  },
  {
    id: 'facebook-375585383037771',
    asset: 'gallery-social-facebook-studio-portrait-2019',
    href: 'https://www.facebook.com/photo/?fbid=375585383037771',
    label: 'Studio portrait',
    alt: 'Jake posing for a studio physique portrait',
  },
  {
    id: 'facebook-373422239920752',
    asset: 'gallery-social-facebook-gym-2019',
    href: 'https://www.facebook.com/photo/?fbid=373422239920752',
    label: 'In the gym',
    alt: 'Jake standing among strength equipment in a gym',
  },
  {
    id: 'facebook-363234144272895',
    asset: 'gallery-jake-training-facebook-2019',
    href: 'https://www.facebook.com/photo.php?fbid=363234144272895',
    label: 'Training progress',
    alt: 'Jake documenting his training progress in the gym',
  },
]

export default function Contact() {
  const resolveAsset = useAssets()
  const [searchParams] = useSearchParams()
  const requestedService = searchParams.get('service')
  const initialService = CONTACT_SERVICE_VALUES.has(requestedService) ? requestedService : ''
  const turnstileRef = useRef(null)
  const submissionIdRef = useRef(createSubmissionId())
  const payloadSignatureRef = useRef(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [securityStatus, setSecurityStatus] = useState('')
  const [submitStatus, setSubmitStatus] = useState({ type: 'idle', message: '' })
  const handleTurnstileToken = useCallback((token) => setTurnstileToken(token), [])
  const handleTurnstileStatus = useCallback((message) => setSecurityStatus(message), [])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!turnstileToken || submitStatus.type === 'pending') {
      setSubmitStatus({ type: 'error', message: 'Complete the security check before sending.' })
      return
    }

    const form = event.currentTarget
    const data = new FormData(form)
    const formValues = {
      firstName: data.get('firstName'),
      lastName: data.get('lastName'),
      email: data.get('email'),
      service: data.get('service'),
      message: data.get('message'),
      website: data.get('website'),
    }
    const payloadSignature = JSON.stringify(formValues)
    if (payloadSignatureRef.current && payloadSignatureRef.current !== payloadSignature) {
      submissionIdRef.current = createSubmissionId()
    }
    payloadSignatureRef.current = payloadSignature

    const payload = {
      ...formValues,
      submissionId: submissionIdRef.current,
      turnstileToken,
    }

    setSubmitStatus({ type: 'pending', message: 'Sending your enquiry…' })

    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error?.message || 'Your enquiry could not be sent. Please try again.')
      }

      form.reset()
      submissionIdRef.current = createSubmissionId()
      payloadSignatureRef.current = null
      setTurnstileToken('')
      turnstileRef.current?.reset()
      setSubmitStatus({
        type: 'success',
        message: 'Your enquiry has been sent. A confirmation is on its way to your email.',
      })
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error
          ? error.message
          : 'Your enquiry could not be sent. Please try again.',
      })
      setTurnstileToken('')
      turnstileRef.current?.reset()
    }
  }

  return (
    <div className="contact-page">
      <section className="contact-hero" aria-labelledby="contact-title">
        <div className="container contact-hero-inner">
          <div className="contact-hero-layout">
            <div className="contact-hero-lead">
              <SectionReveal className="contact-hero-copy" inView={false}>
                <span className="contact-eyebrow">Contact / Start Here</span>
                <h1 id="contact-title">What are you working toward?</h1>
                <p>
                  Choose a coaching path if you&apos;re ready to make progress, or send Jake a
                  question if you need clarity first.
                </p>
              </SectionReveal>

              <SectionReveal className="contact-route-marker" delay={0.08} inView={false}>
                <span>01</span>
                <span className="contact-route-marker-line" aria-hidden="true" />
                <span>Choose Your Route</span>
              </SectionReveal>
            </div>

            <div className="contact-gateway" role="group" aria-label="Choose how to start">
              <div className="contact-gateway-grid">
                <SectionReveal
                  className="contact-route contact-route--primary"
                  inView={false}
                  delay={0.08}
                >
                  <div>
                    <div className="contact-route-icon" aria-hidden="true">
                      <JourneyIcon name="compass" size={28} />
                    </div>
                    <span className="contact-route-kicker">Coaching Path</span>
                    <h2>I&apos;m looking for coaching</h2>
                    <p>
                      Compare Jake&apos;s coaching services and find the structure that matches
                      your goal, environment, and level of support.
                    </p>
                  </div>
                  <a
                    className="btn btn-primary btn-lg contact-route-action"
                    href="#contact-services"
                  >
                    Explore coaching
                    <JourneyIcon name="arrowRight" size={18} />
                  </a>
                </SectionReveal>

                <SectionReveal
                  className="contact-route contact-route--secondary"
                  inView={false}
                  delay={0.14}
                >
                  <div>
                    <div className="contact-route-icon" aria-hidden="true">
                      <JourneyIcon name="message" size={28} />
                    </div>
                    <span className="contact-route-kicker">General Enquiry</span>
                    <h2>I have a question</h2>
                    <p>
                      Send context directly to Jake when your question does not need a coaching
                      booking or service fit check.
                    </p>
                  </div>
                  <a
                    className="btn btn-outline btn-lg contact-route-action"
                    href="#contact-enquiry"
                  >
                    Ask Jake
                    <JourneyIcon name="arrowRight" size={18} />
                  </a>
                </SectionReveal>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="contact-services"
        id="contact-services"
        aria-labelledby="contact-services-title"
      >
        <div className="container contact-services-layout">
          <SectionReveal className="contact-section-heading">
            <div>
              <span className="contact-eyebrow">Coaching Services</span>
              <h2 id="contact-services-title">Explore the work.</h2>
            </div>
            <span className="contact-section-meta">Select a service</span>
          </SectionReveal>

          <SectionReveal className="contact-services-media" delay={0.05}>
            <ContactMediaReel
              youtubeId="GbQomqb28os"
              poster={resolveAsset('/api/assets/video-contact-athlete-reel-poster')}
              credit="Nike"
              creditHref="https://www.youtube.com/watch?v=GbQomqb28os"
            />
          </SectionReveal>

          <div className="contact-services-directory">

            <ol className="contact-service-list">
              {SERVICES.map((service, position) => (
                <li key={service.to}>
                  <SectionReveal delay={position * 0.05}>
                    <Link className="contact-service-row" to={service.to}>
                      <span className="contact-service-index">{service.index}</span>
                      <span className="contact-service-name">{service.label}</span>
                      <span className="contact-service-description">{service.description}</span>
                      <span className="contact-service-action">
                        View service
                        <JourneyIcon name="arrowRight" size={17} />
                      </span>
                    </Link>
                  </SectionReveal>
                </li>
              ))}
            </ol>

            <SectionReveal className="contact-services-finder">
              <span>Not sure which path fits?</span>
              <FindYourFitLink>
                Find Your Fit
                <JourneyIcon name="arrowRight" size={17} />
              </FindYourFitLink>
            </SectionReveal>
          </div>
        </div>
      </section>

      <section
        className="contact-enquiry"
        id="contact-enquiry"
        aria-labelledby="contact-enquiry-title"
      >
        <div className="container contact-enquiry-grid">
          <SectionReveal className="contact-enquiry-intro">
            <span className="contact-eyebrow">General Enquiry</span>
            <h2 id="contact-enquiry-title">Ask Jake directly.</h2>
            <p>
              For a general question or context that does not need a booking, send it here.
              Coaching enquiries should begin with the service finder so you arrive in the
              right conversation.
            </p>
            <div className="contact-enquiry-note">
              <span aria-hidden="true" />
              <span>Questions, context, and current-client support</span>
            </div>
          </SectionReveal>

          <SectionReveal className="contact-enquiry-panel" delay={0.08}>
            <form
              className="contact-enquiry-form"
              aria-label="Contact Jake"
              onSubmit={handleSubmit}
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
                    name="firstName"
                    placeholder="Jake"
                    autoComplete="given-name"
                    required
                    maxLength={100}
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
                    name="lastName"
                    placeholder="Smith"
                    autoComplete="family-name"
                    maxLength={100}
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
                  maxLength={254}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contact-service">
                  Interested In
                </label>
                <select
                  key={initialService || 'empty'}
                  className="form-input form-select"
                  id="contact-service"
                  name="service"
                  defaultValue={initialService}
                >
                  <option value="">Select a service&hellip;</option>
                  <option value="competition-prep">Competition Preparation</option>
                  <option value="online-coaching">Online Coaching</option>
                  <option value="personal-training">Personal Training</option>
                  <option value="posing-only">Posing</option>
                  <option value="unsure">Not Sure Yet</option>
                  <option value="general">General Question</option>
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
                  placeholder="Tell Jake what you would like clarity on..."
                  required
                  maxLength={5000}
                />
              </div>

              <div className="contact-honeypot" aria-hidden="true">
                <label htmlFor="contact-website">Website</label>
                <input
                  id="contact-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <TurnstileWidget
                ref={turnstileRef}
                onToken={handleTurnstileToken}
                onStatus={handleTurnstileStatus}
              />
              {securityStatus && (
                <p className="contact-form-security-status" role="status" aria-live="polite">
                  {securityStatus}
                </p>
              )}

              <div className="contact-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={submitStatus.type === 'pending' || !turnstileToken}
                >
                  {submitStatus.type === 'pending' ? 'Sending…' : 'Send enquiry'}
                  <JourneyIcon name="arrowRight" size={18} />
                </button>
                <p>
                  Looking for coaching?{' '}
                  <FindYourFitLink>Start with Find Your Fit.</FindYourFitLink>
                </p>
              </div>

              <p
                className={`contact-form-status contact-form-status--${submitStatus.type}`}
                role={submitStatus.type === 'error' ? 'alert' : 'status'}
                aria-live="polite"
              >
                {submitStatus.message}
              </p>

              <p className="contact-form-disclosure">
                Resend delivers your enquiry and confirmation email. Cloudflare Turnstile helps
                prevent abuse. Read our <Link to="/privacy">Privacy Policy</Link>.
              </p>
            </form>
          </SectionReveal>
        </div>
      </section>

      <section className="contact-connect" aria-labelledby="contact-connect-title">
        <div className="container contact-connect-inner">
          <SectionReveal className="contact-connect-header">
            <div className="contact-connect-copy">
              <span className="contact-eyebrow">Connect</span>
              <h2 id="contact-connect-title">Follow the work.</h2>
              <p>Training, perspective, and the work behind each outcome.</p>
            </div>
            <div className="contact-connect-links">
              <a
                href="https://www.instagram.com/jakededert/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram @jakededert
                <JourneyIcon name="arrowRight" size={17} />
              </a>
              <a
                href="https://www.facebook.com/p/Jake-Dedert-Team-JD-Coaching-100063678694779/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook
                <JourneyIcon name="arrowRight" size={17} />
              </a>
            </div>
          </SectionReveal>

          <SectionReveal className="contact-social-gallery" delay={0.08}>
            <ContactSocialCarousel posts={SOCIAL_POSTS} />
          </SectionReveal>
        </div>
      </section>
    </div>
  )
}

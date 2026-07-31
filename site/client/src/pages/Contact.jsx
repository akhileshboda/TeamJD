import { Link } from 'react-router-dom'
import ContactMediaReel from '../components/ContactMediaReel'
import ContactSocialCarousel from '../components/ContactSocialCarousel'
import FindYourFitLink from '../components/FindYourFitLink'
import JourneyIcon from '../components/JourneyIcon'
import SectionReveal from '../components/SectionReveal'
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
              action="mailto:jake@team-jd.com.au"
              method="POST"
              encType="text/plain"
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
                <select className="form-input form-select" id="contact-service" name="service">
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
                />
              </div>

              <div className="contact-form-actions">
                <button type="submit" className="btn btn-primary btn-lg">
                  Send enquiry
                  <JourneyIcon name="arrowRight" size={18} />
                </button>
                <p>
                  Looking for coaching?{' '}
                  <FindYourFitLink>Start with Find Your Fit.</FindYourFitLink>
                </p>
              </div>

              <p className="contact-form-disclosure">
                This form opens your email app so you can review the message before sending it.
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

import { Fragment, useRef } from 'react'
import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import CredibilityStrip from '../components/CredibilityStrip'
import AppleWatchGallery from '../components/AppleWatchGallery'
import FAQItem from '../components/FAQItem'
import CTABanner from '../components/CTABanner'
import FindYourFitLink from '../components/FindYourFitLink'
import { useContent } from '../hooks/useContent'
import { framedBackgroundPosition, framedImageStyle, useMedia } from '../hooks/useAssets'
import { usePageMeta } from '../hooks/usePageMeta'
import { DESKTOP_QUERY, EASE, DURATION, MOBILE_QUERY, ScrollTrigger, SplitText, gsap, useGSAP } from '../motion/gsap'
import { useMotionAllowed, useRefreshOnSettle, useSmoothScroll } from '../motion/useLandingMotion'
import '../styles/Home.css'

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
    fit: 'Best fit: Adelaide-based clients who want direct guidance',
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
    fallbackName: 'Posing',
    fallbackSlug: 'posing-only',
    fallbackImage: 'service-posing',
  },
]

const MANIFESTO =
  'Jake does not start with a package. He starts with your goal, your timeline, your training history, and the level of accountability you need to move with confidence.'

// Words that carry the accent colour once the manifesto lights up.
const MANIFESTO_ACCENTS = new Set(['goal,', 'timeline,', 'history,', 'confidence.'])

function Manifesto() {
  const words = MANIFESTO.split(' ')
  return (
    <p className="lp-manifesto-text">
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span className={`lp-word${MANIFESTO_ACCENTS.has(word) ? ' lp-word--accent' : ''}`}>{word}</span>
          {index < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </p>
  )
}

// Sets an attribute on the landing root while a matchMedia branch is live, so the
// CSS can switch from the static layout to the animated one (and back on revert).
function markMode(root, mode) {
  root.setAttribute('data-lp-motion', mode)
  return () => root.removeAttribute('data-lp-motion')
}

export default function Home() {
  usePageMeta({ page: 'home' })
  const { data: services } = useContent('services')
  const { data: faqs } = useContent('faqs')
  const { data: results } = useContent('results')
  const media = useMedia()
  const aboutPhoto = media(
    'home.about-photo',
    '/api/assets/jake-hero',
    'Jake Dedert — Pro Physique bodybuilder and fitness coach',
  )
  const rootRef = useRef(null)
  const motionAllowed = useMotionAllowed()
  useSmoothScroll(motionAllowed)
  useRefreshOnSettle([motionAllowed, services, faqs, results, aboutPhoto.src])

  const servicesById = new Map((services || []).map((service) => [service.id, service]))

  useGSAP(
    () => {
      if (!motionAllowed) return undefined
      const root = rootRef.current
      const mm = gsap.matchMedia()

      // ── Shared by every screen size ──────────────────────────────────────
      mm.add('(min-width: 0px)', () => {
        // Hero load-in: headline lines rise out of a mask, then the rest follows.
        const split = SplitText.create('.lp-hero-title .lp-hero-line', { type: 'lines', mask: 'lines' })
        gsap
          .timeline({ defaults: { ease: EASE.enter } })
          .from('.lp-hero-media', { scale: 1.12, duration: 2.2, ease: 'power2.out' }, 0)
          .from('.lp-hero-eyebrow', { y: 16, autoAlpha: 0, duration: DURATION.base }, 0.15)
          .from(split.lines, { yPercent: 110, duration: DURATION.slow, stagger: 0.12 }, 0.25)
          .from('.lp-hero-foot > *', { y: 28, autoAlpha: 0, duration: DURATION.base, stagger: 0.1 }, 0.75)
          .from('.lp-hero-cue', { autoAlpha: 0, duration: DURATION.base }, 1.2)

        // Manifesto: each word brightens as the paragraph crosses the screen.
        gsap.fromTo(
          '.lp-word',
          { opacity: 0.16 },
          {
            opacity: 1,
            ease: EASE.scrub,
            stagger: 0.08,
            scrollTrigger: { trigger: '.lp-manifesto-text', start: 'top 82%', end: 'bottom 45%', scrub: 0.6 },
          },
        )

        // Section headings: masked line reveals, once.
        gsap.utils.toArray('[data-lp-split]').forEach((heading) => {
          const lines = SplitText.create(heading, { type: 'lines', mask: 'lines' })
          gsap.from(lines.lines, {
            yPercent: 105,
            duration: DURATION.slow,
            ease: EASE.enter,
            stagger: 0.1,
            scrollTrigger: { trigger: heading, start: 'top 85%', once: true },
          })
        })

        // Small supporting blocks fade up as they arrive.
        gsap.set('[data-lp-rise]', { y: 36, autoAlpha: 0 })
        ScrollTrigger.batch('[data-lp-rise]', {
          start: 'top 88%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { y: 0, autoAlpha: 1, duration: DURATION.base, ease: EASE.enter, stagger: 0.08, overwrite: true }),
        })

        // About: the portrait opens like a shutter and drifts against the scroll.
        gsap
          .timeline({ scrollTrigger: { trigger: '.lp-about-figure', start: 'top 80%', once: true } })
          .fromTo(
            '.lp-about-frame',
            { clipPath: 'inset(100% 0% 0% 0%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: DURATION.slow, ease: EASE.move },
          )
          .from('.lp-about-badge', { x: -32, autoAlpha: 0, duration: DURATION.base, ease: EASE.enter }, '-=0.45')
        gsap.fromTo(
          '.lp-about-parallax',
          { yPercent: -8, scale: 1.16 },
          {
            yPercent: 8,
            scale: 1.16,
            ease: EASE.scrub,
            scrollTrigger: { trigger: '.lp-about-figure', start: 'top bottom', end: 'bottom top', scrub: true },
          },
        )

        // Results: the section opens with a wipe from the centre.
        gsap.fromTo(
          '.lp-results',
          { clipPath: 'inset(0% 6% 0% 6% round 2rem)' },
          {
            clipPath: 'inset(0% 0% 0% 0% round 0rem)',
            ease: EASE.scrub,
            scrollTrigger: { trigger: '.lp-results', start: 'top 95%', end: 'top 25%', scrub: 0.6 },
          },
        )

        // Final call to action: an accent rule draws across as it arrives.
        gsap.fromTo(
          '.lp-final-rule',
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: EASE.scrub,
            scrollTrigger: { trigger: '.lp-final', start: 'top 85%', end: 'top 35%', scrub: 0.6 },
          },
        )
      })

      // ── Desktop: pinned, scrubbed sequences ─────────────────────────────
      mm.add(DESKTOP_QUERY, () => {
        const unmark = markMode(root, 'desktop')

        // Hero holds while the footage recedes into a framed card.
        gsap
          .timeline({
            defaults: { ease: EASE.scrub },
            scrollTrigger: {
              trigger: '.lp-hero',
              start: 'top top',
              end: '+=70%',
              pin: true,
              scrub: 0.7,
              // The Replay button mounts whenever the footage ends, so it is hidden
              // by state (CSS) rather than by this timeline.
              onUpdate: (self) => root.querySelector('.lp-hero')?.toggleAttribute('data-scrolled', self.progress > 0.02),
            },
          })
          .to('.lp-hero-media', { scale: 0.9, borderRadius: 28, yPercent: -2 }, 0)
          .to('.lp-hero-content', { yPercent: -18, autoAlpha: 0 }, 0)
          .to('.lp-hero-overlay', { opacity: 0.85 }, 0)
          .to('.lp-hero-cue', { autoAlpha: 0, duration: 0.2 }, 0)

        // Pause the hero footage once it has scrolled away; it costs frames for nothing.
        ScrollTrigger.create({
          trigger: '.lp-hero',
          start: 'top top',
          end: 'bottom top',
          onLeave: () => root.querySelector('.lp-hero-video')?.pause(),
          onEnterBack: () => {
            const video = root.querySelector('.lp-hero-video')
            if (video && !video.ended) video.play()?.catch?.(() => {})
          },
        })

        // Credentials glide sideways with the scroll.
        gsap.fromTo(
          '.lp-cred-track',
          { xPercent: 0 },
          {
            xPercent: -32,
            ease: EASE.scrub,
            scrollTrigger: { trigger: '.lp-cred', start: 'top bottom', end: 'bottom top', scrub: 0.5 },
          },
        )

        // Pathways: the four panels travel horizontally while the section is pinned.
        const track = root.querySelector('.lp-pathways-track')
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth)
        const travel = gsap.to(track, {
          x: () => -distance(),
          ease: EASE.scrub,
          scrollTrigger: {
            trigger: '.lp-pathways-pin',
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        })
        gsap.fromTo('.lp-pathways-progress-bar', { scaleX: 0 }, {
          scaleX: 1,
          ease: EASE.scrub,
          scrollTrigger: { trigger: '.lp-pathways-pin', start: 'top top', end: () => `+=${distance()}`, scrub: true },
        })
        gsap.utils.toArray('.lp-pathway').forEach((panel) => {
          gsap.fromTo(
            panel.querySelector('.lp-pathway-media'),
            { xPercent: -10 },
            {
              xPercent: 10,
              ease: EASE.scrub,
              scrollTrigger: {
                trigger: panel,
                containerAnimation: travel,
                start: 'left right',
                end: 'right left',
                scrub: true,
              },
            },
          )
        })

        return unmark
      })

      // ── Phones and tablets: lighter, unpinned reveals ───────────────────
      mm.add(MOBILE_QUERY, () => {
        const unmark = markMode(root, 'compact')
        gsap.utils.toArray('.lp-pathway').forEach((panel) => {
          gsap.from(panel, {
            y: 48,
            autoAlpha: 0,
            duration: DURATION.base,
            ease: EASE.enter,
            scrollTrigger: { trigger: panel, start: 'top 90%', once: true },
          })
        })
        return unmark
      })

      return () => mm.revert()
    },
    { scope: rootRef, dependencies: [motionAllowed, Boolean(faqs?.length), Boolean(services?.length)], revertOnUpdate: true },
  )

  return (
    <div className="lp" ref={rootRef}>
      <Hero />

      <CredibilityStrip />

      {/* Personalised services guidance */}
      <section className="lp-manifesto" aria-labelledby="services-heading">
        <div className="container">
          <div className="lp-manifesto-head">
            <span className="eyebrow">How Jake Helps</span>
            <h2 id="services-heading" data-lp-split>
              Find the Coaching That Fits Your Next Move.
            </h2>
          </div>
          <Manifesto />
        </div>
      </section>

      <section className="lp-pathways" aria-label="Coaching pathways">
        <div className="lp-pathways-pin">
          <div className="lp-pathways-rail">
            <span className="eyebrow">Four ways in</span>
            <p>Scroll through the routes Jake coaches.</p>
            <div className="lp-pathways-progress" aria-hidden="true">
              <span className="lp-pathways-progress-bar" />
            </div>
          </div>

          <ul className="lp-pathways-track" role="list">
            {servicePathways.map((pathway, index) => {
              const service = servicesById.get(pathway.id)
              const serviceName = service?.name || pathway.fallbackName
              const serviceSlug = service?.slug || pathway.fallbackSlug
              const background = media(
                `services.${serviceSlug}.hero`,
                service?.hero_image || pathway.fallbackImage,
              )

              return (
                <li key={pathway.id} className="lp-pathway">
                  <Link
                    to={`/services/${serviceSlug}`}
                    className="lp-pathway-link"
                    aria-label={`${pathway.label}: explore ${serviceName}`}
                    data-analytics-event="service_discovery"
                    data-analytics-location="home_service_pathways"
                    data-analytics-id={pathway.id}
                    data-cms-section={background.slotId}
                  >
                    <span className="lp-pathway-media" aria-hidden="true">
                      <span
                        className="lp-pathway-image"
                        style={{
                          backgroundImage: `url("${background.src}")`,
                          backgroundPosition: framedBackgroundPosition(background),
                        }}
                      />
                    </span>
                    <span className="lp-pathway-shade" aria-hidden="true" />
                    <span className="lp-pathway-number" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="lp-pathway-body">
                      <span className="lp-pathway-label">{pathway.label}</span>
                      <span className="lp-pathway-title">{pathway.title}</span>
                      <span className="lp-pathway-copy">{pathway.copy}</span>
                      <span className="lp-pathway-fit">{pathway.fit}</span>
                      <span className="lp-pathway-cta">
                        Explore {serviceName} <span aria-hidden="true">&rarr;</span>
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="container">
          <div className="lp-consult" data-lp-rise>
            <div>
              <span className="lp-consult-kicker">Not sure yet?</span>
              <h3>Bring Jake the goal. He&apos;ll help shape the route.</h3>
              <p>
                A quick consult is the easiest way to figure out whether you need prep, online
                structure, in-person coaching, posing work, or a blend of support.
              </p>
            </div>
            <div className="lp-consult-actions">
              <FindYourFitLink className="btn btn-primary">Find Your Fit</FindYourFitLink>
              <Link to="/services" className="btn btn-secondary">
                View All Services &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive results + testimonials gallery */}
      <div className="lp-results">
        <AppleWatchGallery />
      </div>

      {/* About teaser */}
      <section className="lp-about" aria-labelledby="about-heading">
        <div className="container lp-about-grid">
          <div className="lp-about-copy">
            <span className="eyebrow">Meet Your Coach</span>
            <h2 id="about-heading" data-lp-split>
              I&apos;m Jake.
              <br />
              This is Personal.
            </h2>
            <p data-lp-rise>
              I&apos;m a professional bodybuilder and fitness and nutrition coach dedicated to
              helping you achieve your unique goals. I believe in working with your natural
              strengths while helping you push through your limitations — everything I do is
              customised specifically for you.
            </p>
            <p data-lp-rise>
              As a Champion Physique Bodybuilder and Competition Prep coach with extensive
              experience, I&apos;ve helped hundreds of clients transform their body, mindset, and
              lifestyle.
            </p>
            <div data-lp-rise>
              <Link to="/about" className="btn btn-outline">
                Learn About Jake &rarr;
              </Link>
            </div>
          </div>

          <figure className="lp-about-figure">
            <div className="lp-about-frame">
              <div className="lp-about-parallax">
                <img
                  src={aboutPhoto.src}
                  alt={aboutPhoto.alt}
                  loading="lazy"
                  decoding="async"
                  width="600"
                  height="800"
                  data-cms-section={aboutPhoto.slotId}
                  style={framedImageStyle(aboutPhoto)}
                />
              </div>
            </div>
            <figcaption className="lp-about-badge">
              <span className="lp-about-badge-kicker">Pro Physique</span>
              <span className="lp-about-badge-title">Champion Bodybuilder</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-faq" aria-labelledby="faq-heading" data-cms-section="faqs">
        <div className="container lp-faq-grid">
          <div className="lp-faq-head">
            <span className="eyebrow">Common Questions</span>
            <h2 id="faq-heading" data-lp-split>
              Got Questions?
            </h2>
            <p>Everything you need to know before taking the next step.</p>
          </div>

          <div className="faq-list lp-faq-list">
            {faqs?.map((faq) => (
              <div key={faq.id} data-lp-rise>
                <FAQItem faq={faq} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final call to action */}
      <div className="lp-final">
        <span className="lp-final-rule" aria-hidden="true" />
        <CTABanner sectionClassName="home-section home-final-cta lp-final-cta" />
      </div>
    </div>
  )
}

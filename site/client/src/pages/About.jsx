import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import PageHero from '../components/PageHero'
import CTABanner from '../components/CTABanner'
import ClientResultsCarousel from '../components/ClientResultsCarousel'
import Lightbox from '../components/Lightbox'
import SectionReveal, { StaggerContainer, StaggerItem } from '../components/SectionReveal'
import { useAssets } from '../hooks/useAssets'
import { useJSON } from '../hooks/useJSON'
import wnbfLogo from '../assets/wnbf.svg'

const STATS = [
  { value: '100+', label: 'Clients Transformed' },
  { value: '6+', label: 'Federations Supported' },
  { value: 'Pro', label: 'Physique Competitor' },
  { value: '100%', label: 'Customised Coaching' },
]

const PILLARS = [
  {
    number: '01',
    title: 'Built from the stage.',
    body: 'Competition experience sharpens every coaching decision — from purposeful training and nutrition to presentation, timing, and the details that matter when pressure rises.',
  },
  {
    number: '02',
    title: 'Fully customised. Always.',
    body: 'No templates or copy-paste macros. Your plan reflects your goals, schedule, equipment, training history, and the way your body responds.',
  },
  {
    number: '03',
    title: 'Real accountability.',
    body: 'Honest feedback, clear check-ins, and considered adjustments keep the work moving when motivation dips or life becomes demanding.',
  },
  {
    number: '04',
    title: 'Judgment-free progress.',
    body: 'Your starting point is information, not a verdict. The standard stays high while the coaching remains supportive, practical, and personal.',
  },
]

const PROCESS_STEPS = [
  {
    number: '01',
    title: 'Consult',
    body: 'We start with the goal, your timeline, your training history, and the support you actually need. The first conversation creates clarity — not pressure.',
  },
  {
    number: '02',
    title: 'Plan',
    body: 'Training, nutrition, accountability, and presentation are shaped into one route that fits your life and gives every week a purpose.',
  },
  {
    number: '03',
    title: 'Execute',
    body: 'You do the work with clear direction. Jake stays close to the details, answers questions, and keeps the plan moving with intent.',
  },
  {
    number: '04',
    title: 'Refine',
    body: 'Progress photos, performance, feedback, and check-ins guide the next adjustment. What works is reinforced; what does not is changed.',
  },
]

const FIT_SIGNALS = [
  'You are ready to follow a plan built around your real life.',
  'You value honest feedback and clear accountability.',
  'You understand that consistency matters more than quick fixes.',
  'You want coaching that adapts as your body and circumstances change.',
]

const COACHED_FEDERATIONS = [
  { name: 'IFBB', asset: 'ifbb' },
  { name: 'FMG', asset: 'fmg' },
  { name: 'ICN', asset: 'icn' },
  { name: 'ANB', asset: 'anb' },
  { name: 'NABBA', asset: 'nabba' },
  { name: 'WNBF', src: wnbfLogo },
]

const ABOUT_FINAL_ACTIONS = [
  {
    label: 'Explore Services',
    to: '/services',
    variant: 'primary',
    analyticsId: 'explore_services',
  },
  {
    label: 'View Client Results',
    to: '/results',
    variant: 'secondary',
    analyticsId: 'view_results',
  },
]

const PROCESS_STEP_THRESHOLDS = [0, 0.28, 0.58, 0.88]

function ProcessTimeline({ steps }) {
  const timelineRef = useRef(null)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    const timeline = timelineRef.current
    if (!timeline) return undefined

    const stepElements = Array.from(timeline.querySelectorAll('[data-process-step]'))

    if (shouldReduceMotion) {
      timeline.style.setProperty('--process-progress', '1')
      timeline.classList.remove('is-ambient-active')
      stepElements.forEach((step) => { step.dataset.active = 'true' })
      return undefined
    }

    let isVisible = false
    let frameId = null

    const updateProgress = () => {
      frameId = null
      if (!isVisible) return

      const rect = timeline.getBoundingClientRect()
      const startLine = window.innerHeight * 0.78
      const endLine = window.innerHeight * 0.28
      const travel = Math.max(1, rect.height + startLine - endLine)
      const progress = Math.min(1, Math.max(0, (startLine - rect.top) / travel))

      timeline.style.setProperty('--process-progress', progress.toFixed(4))
      stepElements.forEach((step, index) => {
        step.dataset.active = String(progress >= PROCESS_STEP_THRESHOLDS[index])
      })
    }

    const requestProgressUpdate = () => {
      if (!isVisible || frameId !== null) return
      frameId = window.requestAnimationFrame(updateProgress)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
        timeline.classList.toggle('is-ambient-active', isVisible)
        if (isVisible) requestProgressUpdate()
      },
      { rootMargin: '20% 0px 20% 0px' },
    )

    observer.observe(timeline)
    window.addEventListener('scroll', requestProgressUpdate, { passive: true })
    window.addEventListener('resize', requestProgressUpdate)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', requestProgressUpdate)
      window.removeEventListener('resize', requestProgressUpdate)
      if (frameId !== null) window.cancelAnimationFrame(frameId)
    }
  }, [shouldReduceMotion])

  return (
    <div ref={timelineRef} className="about-process-timeline-wrap">
      <span className="about-process-track" aria-hidden="true">
        <span className="about-process-track-fill" />
      </span>
      <ol className="about-process-timeline">
        {steps.map((step, index) => (
          <li key={step.number} data-process-step data-active={index === 0 ? 'true' : 'false'}>
            <SectionReveal delay={index * 0.05} y={20}>
              <article className="about-process-step">
                <span className="about-process-number" aria-hidden="true">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </article>
            </SectionReveal>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function About() {
  const resolveAsset = useAssets()
  const { data: results } = useJSON('/content/results.json')
  const [lightboxImage, setLightboxImage] = useState(null)

  return (
    <>
      <PageHero
        eyebrow="Meet Jake"
        title="This Is Personal."
        subtitle="Pro Physique competitor. Competition prep coach. Personal trainer. One coaching standard, built around the person doing the work."
      />

      <div className="about-continuum">
        <section className="section about-section about-bio" aria-labelledby="about-bio-heading">
          <div className="container">
            <div className="about-bio-grid">
              <div className="about-photo-wrap">
                  <div className="about-photo-frame">
                    <img
                      src={resolveAsset('/api/assets/jake-hero')}
                      alt="Jake Dedert, Pro Physique bodybuilder and fitness coach, posing in a gym"
                      decoding="async"
                      fetchpriority="high"
                      width="600"
                      height="800"
                    />
                  </div>

                  <div className="about-identity-card">
                    <img
                      src={resolveAsset('/api/assets/logo-mark')}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      className="about-identity-logo"
                    />
                    <div>
                      <div className="about-identity-name">Jake Dedert</div>
                      <div className="about-identity-role">Pro Physique Champion &amp; Coach</div>
                    </div>
                  </div>

                  <div className="stats-grid about-stats" aria-label="Jake Dedert coaching statistics">
                    {STATS.map(({ value, label }) => (
                      <div key={label} className="stat-card">
                        <div className="stat-value">{value}</div>
                        <div className="stat-label">{label}</div>
                      </div>
                    ))}
                  </div>
              </div>

              <SectionReveal className="about-bio-reveal" delay={0.1}>
                <div className="about-bio-copy">
                  <span className="accent-line" />
                  <span className="eyebrow">The Person Behind the Plan</span>
                  <h2 id="about-bio-heading">The standard is personal.</h2>

                  <p>
                    I&apos;m Jake — a professional bodybuilder and fitness and nutrition coach who
                    treats every client&apos;s goal with the focus it deserves. That goal might be a
                    stage, a photoshoot, a stronger body, or the confidence that comes from finally
                    feeling in control of your training.
                  </p>

                  <p>
                    Competition taught me how much the details matter: purposeful programming,
                    nutrition that supports the outcome, presentation under pressure, and calm
                    adjustments when variables shift. That experience informs my coaching; it does
                    not limit who the coaching is for.
                  </p>

                  <p>
                    Whether we work face to face or online, you get clear direction, honest feedback,
                    and a plan shaped around your strengths, constraints, and life. The goal is not
                    to make you fit a system. It is to build a system that helps you progress.
                  </p>

                  <div className="about-bio-actions">
                    <Link
                      to="/services"
                      className="btn btn-primary btn-lg"
                      data-analytics-event="service_discovery"
                      data-analytics-location="about_bio"
                      data-analytics-id="explore_services"
                    >
                      Explore Coaching Services
                    </Link>
                    <Link
                      to="/results"
                      className="btn btn-outline btn-lg"
                      data-analytics-event="results_view_all"
                      data-analytics-location="about_bio"
                      data-analytics-id="view_results"
                    >
                      See Client Results <span aria-hidden="true">→</span>
                    </Link>
                  </div>

                  <div className="about-federations-panel" aria-labelledby="coached-federations-heading">
                    <p id="coached-federations-heading">Federations I Coach</p>
                    <ul>
                      {COACHED_FEDERATIONS.map((federation) => (
                        <li key={federation.name}>
                          <img
                            src={federation.src || resolveAsset(`/api/assets/${federation.asset}`)}
                            alt={`${federation.name} logo`}
                            loading="lazy"
                            decoding="async"
                            width="112"
                            height="56"
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </SectionReveal>
            </div>
          </div>
        </section>

        <section className="section about-section about-pillars-section" aria-labelledby="pillars-heading">
          <div className="container">
            <SectionReveal>
              <div className="about-section-intro">
                <span className="eyebrow">Coaching Philosophy</span>
                <h2 id="pillars-heading">More than a program.</h2>
                <p>
                  The plan matters, but so does the relationship behind it. Team JD combines a high
                  standard of detail with coaching that stays responsive to the person doing the work.
                </p>
              </div>
            </SectionReveal>

            <StaggerContainer className="about-pillars">
              {PILLARS.map((pillar) => (
                <StaggerItem key={pillar.number}>
                  <article className="about-pillar-card" tabIndex="0">
                    <span className="about-pillar-number" aria-hidden="true">{pillar.number}</span>
                    <h3>{pillar.title}</h3>
                    <p>{pillar.body}</p>
                  </article>
                </StaggerItem>
              ))}
            </StaggerContainer>

            <SectionReveal delay={0.08}>
              <blockquote className="about-editorial-quote">
                <span aria-hidden="true">“</span>
                <p>Your goals become my goals. Your success is what drives me forward.</p>
              </blockquote>
            </SectionReveal>
          </div>
        </section>

        <section className="section about-section about-process-section" aria-labelledby="process-heading">
          <div className="container">
            <SectionReveal>
              <div className="about-section-intro about-section-intro--split">
                <div>
                  <span className="eyebrow">How We Work</span>
                  <h2 id="process-heading">A clear route. Refined as you move.</h2>
                </div>
                <p>
                  You bring the goal. Jake builds the route, stays close to the execution, and
                  adjusts the plan using what your progress is actually showing.
                </p>
              </div>
            </SectionReveal>

            <div className="about-process-story">
              <SectionReveal className="about-process-media">
                <figure>
                  <img
                    src={resolveAsset('/api/assets/jake-stage')}
                    alt="Jake celebrating on stage with a successful competition client"
                    loading="lazy"
                    decoding="async"
                    width="640"
                    height="800"
                  />
                  <figcaption>The standard carries from the first conversation to the final detail.</figcaption>
                </figure>
              </SectionReveal>

              <ProcessTimeline steps={PROCESS_STEPS} />
            </div>
          </div>
        </section>

        <section className="section about-section about-fit-section" aria-labelledby="fit-heading">
          <div className="container">
            <div className="about-fit-layout">
              <SectionReveal>
                <div className="about-fit-statement">
                  <span className="eyebrow">Who Team JD Is For</span>
                  <h2 id="fit-heading">Different goals. Same standard.</h2>
                  <p>
                    You do not need to be a bodybuilder to want serious coaching. Team JD is for
                    people who want meaningful change and are ready to work with a plan that is
                    personal, accountable, and built to evolve.
                  </p>
                  <Link
                    to="/services"
                    className="about-fit-link"
                    data-analytics-event="service_discovery"
                    data-analytics-location="about_fit"
                    data-analytics-id="find_coaching_path"
                  >
                    Find your coaching path <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </SectionReveal>

              <SectionReveal delay={0.08}>
                <ul className="about-fit-signals">
                  {FIT_SIGNALS.map((signal, index) => (
                    <li key={signal}>
                      <span aria-hidden="true">0{index + 1}</span>
                      <p>{signal}</p>
                    </li>
                  ))}
                </ul>
              </SectionReveal>
            </div>

          </div>
        </section>

        <section className="section about-section about-results-section" aria-labelledby="about-results-heading">
          <div className="container">
            <SectionReveal>
              <ClientResultsCarousel
                results={results || []}
                onOpen={setLightboxImage}
                eyebrow="Client Results"
                title="The work shows."
                headingId="about-results-heading"
              />
            </SectionReveal>
          </div>
        </section>

        <CTABanner
          sectionClassName="about-section about-final-cta"
          analyticsLocation="about_final_cta"
          eyebrow="Choose Your Next Step"
          title="Find the coaching that fits your next move."
          description="Compare the support available, see where your goal fits, and choose a service built to move you forward."
          actions={ABOUT_FINAL_ACTIONS}
        />
      </div>

      <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  )
}

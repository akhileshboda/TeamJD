import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import CTABanner from '../components/CTABanner'
import ClientResultsCarousel from '../components/ClientResultsCarousel'
import Lightbox from '../components/Lightbox'
import SectionReveal, { StaggerContainer, StaggerItem } from '../components/SectionReveal'
import { useAssets } from '../hooks/useAssets'
import { useJSON } from '../hooks/useJSON'

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

const GOAL_SPECTRUM = [
  'Body composition',
  'Strength',
  'Confidence',
  'Presentation',
  'Competition',
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

              <SectionReveal delay={0.1}>
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

              <ol className="about-process-timeline">
                {PROCESS_STEPS.map((step, index) => (
                  <li key={step.number}>
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

            <SectionReveal delay={0.1}>
              <div className="about-goal-spectrum" aria-label="Goals supported by Team JD">
                <span>Your goal might be</span>
                <ul>
                  {GOAL_SPECTRUM.map((goal) => <li key={goal}>{goal}</li>)}
                </ul>
              </div>
            </SectionReveal>
          </div>
        </section>

        <section className="section about-section about-results-section" aria-labelledby="about-results-heading">
          <div className="container">
            <SectionReveal>
              <div className="about-section-intro about-section-intro--split">
                <div>
                  <span className="eyebrow">Client Results</span>
                  <h2 id="about-results-heading">The work shows.</h2>
                </div>
                <p>
                  For now, this track highlights competition outcomes. As the result library grows,
                  it will also carry the body-composition and lifestyle progress created through the
                  same coaching standard.
                </p>
              </div>
            </SectionReveal>

            {results && (
              <SectionReveal delay={0.06}>
                <ClientResultsCarousel results={results} onOpen={setLightboxImage} />
              </SectionReveal>
            )}
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

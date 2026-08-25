import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useAssets } from '../hooks/useAssets'
import JourneyIcon from './JourneyIcon'
import ServicePricingConversion from './ServicePricingConversion'
import CompetitionPrepBookingAction from './CompetitionPrepBookingAction'
import { resolveServiceAction } from '../utils/bookingLinks'

const EASE = [0.25, 0.1, 0.25, 1]

const copyVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

const copyItem = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
}

export default function ServiceDetailHero({ service, services = [] }) {
  const sectionRef = useRef(null)
  const action = resolveServiceAction(service)
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()
  const heroSrc = resolveAsset(service.hero_image)
  const heroFacts = service.facts ?? []

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const parallaxY = useTransform(scrollYProgress, [0, 1], [0, 48])

  const itemProps = shouldReduce ? {} : { variants: copyItem }

  return (
    <section
      ref={sectionRef}
      className="service-journey-hero"
      aria-labelledby="service-journey-title"
    >
      <div
        className="service-journey-hero-backdrop"
        aria-hidden="true"
        style={{ '--svc-hero-photo': `url("${heroSrc}")` }}
      />
      <div className="service-journey-orb service-journey-orb--cyan" aria-hidden="true" />
      <div className="service-journey-orb service-journey-orb--coral" aria-hidden="true" />

      <div className="container service-journey-hero-inner">
        <motion.div
          className="service-journey-hero-copy"
          variants={shouldReduce ? undefined : copyVariants}
          initial={shouldReduce ? false : 'hidden'}
          animate={shouldReduce ? undefined : 'visible'}
        >
          <motion.div {...itemProps}>
            <Link to="/services" className="service-menu-link">
              <JourneyIcon name="arrowLeft" size={18} />
              <span>Service Menu</span>
            </Link>
          </motion.div>

          <motion.div className="service-journey-kickers" {...itemProps}>
            <span className="eyebrow">Coaching Pathway</span>
            {service.application_required && (
              <span className="service-fit-chip">
                <JourneyIcon name="lock" size={14} />
                Find Your Fit first &middot; Application required
              </span>
            )}
          </motion.div>

          <motion.h1 id="service-journey-title" {...itemProps}>
            {service.name}
          </motion.h1>
          <motion.p {...itemProps}>{service.tagline}</motion.p>

          {heroFacts.length > 0 && (
            <motion.ul
              className="service-hero-stats"
              aria-label={`${service.name} at a glance`}
              {...itemProps}
            >
              {heroFacts.map((fact) => (
                <li key={fact.label}>
                  <span>{fact.label}</span>
                  <strong>
                    {fact.url ? (
                      <a
                        className="service-hero-stat-link"
                        href={fact.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${fact.value} in Google Maps`}
                      >
                        {fact.value}
                        <JourneyIcon name="arrowRight" size={14} />
                      </a>
                    ) : (
                      fact.value
                    )}
                  </strong>
                </li>
              ))}
            </motion.ul>
          )}

          <motion.div {...itemProps}>
            <ServicePricingConversion service={service} placement="hero">
              {action.isApplication ? (
                <div className="service-hero-actions">
                  <CompetitionPrepBookingAction
                    service={service}
                    services={services}
                    className="btn btn-primary"
                  >
                    {action.label}
                    <JourneyIcon name="arrowRight" size={18} />
                  </CompetitionPrepBookingAction>
                  <a className="service-hero-secondary-link" href="#service-fit-check">
                    See what Jake assesses first
                  </a>
                </div>
              ) : (
                <a
                  className="btn btn-primary"
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {action.label}
                  <JourneyIcon name="arrowRight" size={18} />
                </a>
              )}
            </ServicePricingConversion>
          </motion.div>
        </motion.div>

        <motion.div
          className="service-journey-visual"
          initial={shouldReduce ? false : { opacity: 0, x: 28 }}
          animate={shouldReduce ? undefined : { opacity: 1, x: 0 }}
          transition={{ duration: 0.65, ease: EASE, delay: 0.08 }}
        >
          <div className="service-journey-visual-glow" aria-hidden="true" />
          <motion.div
            className="service-journey-parallax"
            style={shouldReduce ? undefined : { y: parallaxY }}
          >
            <div className="service-journey-ring" aria-hidden="true" />
            <div className="service-journey-image-frame">
              <img src={heroSrc} alt={service.hero_alt} decoding="async" fetchpriority="high" />
              <div className="service-journey-image-scrim" aria-hidden="true" />
              <div className="service-journey-image-plate">
                <span>Team JD standard</span>
                <strong>{service.expectation_title}</strong>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

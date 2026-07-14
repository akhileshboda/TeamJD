import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useAssets } from '../hooks/useAssets'

export default function ServiceGlassCard({ service }) {
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()

  const heroSrc = service.hero_image ? resolveAsset(service.hero_image) : ''
  const fallbackIcon = service.includes?.[0]?.icon || ''

  const MotionLink = shouldReduce ? Link : motion.create(Link)
  const motionProps = shouldReduce
    ? {}
    : {
        whileHover: { y: -4 },
        whileFocus: { y: -4 },
        transition: { duration: 0.2, ease: 'easeOut' },
      }

  return (
    <MotionLink
      to={`/services/${service.slug}`}
      className="service-glass-card"
      aria-label={`${service.name} — learn more`}
      data-analytics-event="service_discovery"
      data-analytics-location="services_glass_grid"
      data-analytics-id={service.id}
      {...motionProps}
    >
      <div
        className={`service-glass-card-media${heroSrc ? '' : ' service-glass-card-media--fallback'}`}
      >
        {heroSrc ? (
          <img
            src={heroSrc}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          />
        ) : (
          fallbackIcon && (
            <img
              className="service-glass-card-fallback-icon"
              src={resolveAsset(fallbackIcon)}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
          )
        )}
      </div>

      <div className="service-glass-card-scrim" aria-hidden="true" />

      <span className="service-glass-badge">Fit Check Before Booking</span>

      <div className="service-glass-card-plate">
        <h3>{service.name}</h3>
        <p>{service.tagline}</p>
        <span className="service-glass-card-cta">
          Learn more <span aria-hidden="true">→</span>
        </span>
      </div>
    </MotionLink>
  )
}

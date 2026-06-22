import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useAssets } from '../hooks/useAssets'

export default function ServiceCard({ service }) {
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()

  const heroSrc = service.hero_image ? resolveAsset(service.hero_image) : ''
  const fallbackIcon = service.includes?.[0]?.icon || ''

  const Card = shouldReduce ? 'div' : motion.div
  const cardProps = shouldReduce
    ? {}
    : { whileHover: 'hover', whileFocus: 'hover', initial: 'rest', animate: 'rest' }

  const mediaVariants = shouldReduce
    ? undefined
    : {
        rest: { scale: 1 },
        hover: { scale: 1.06, transition: { duration: 0.4, ease: 'easeOut' } },
      }
  const Media = shouldReduce ? 'div' : motion.div

  return (
    <Link
      to={`/services/${service.slug}`}
      className="service-tile-link"
      aria-label={`${service.name} — learn more`}
    >
      <Card className="service-tile" {...cardProps}>
        <Media
          className={`service-tile-media${heroSrc ? '' : ' service-tile-media--fallback'}`}
          variants={mediaVariants}
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
                className="service-tile-fallback-icon"
                src={resolveAsset(fallbackIcon)}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
              />
            )
          )}
        </Media>

        <div className="service-tile-overlay" />

        <div className="service-tile-content">
          {service.application_required && (
            <span className="badge">Application Required</span>
          )}
          <h3>{service.name}</h3>
          <p>{service.tagline}</p>
          <span className="service-tile-cta">Learn More &rarr;</span>
        </div>
      </Card>
    </Link>
  )
}

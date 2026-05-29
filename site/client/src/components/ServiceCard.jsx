import { motion, useReducedMotion } from 'framer-motion'
import { useAssets } from '../hooks/useAssets'

export default function ServiceCard({ service }) {
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()

  const icon = service.includes?.[0]?.icon || ''

  const Card = shouldReduce ? 'div' : motion.div
  const cardProps = shouldReduce
    ? {}
    : { whileHover: { y: -4 }, transition: { duration: 0.2 } }

  return (
    <Card className="service-card" {...cardProps}>
      {icon && (
        <img
          className="card-icon"
          src={resolveAsset(icon)}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={{ width: '4rem', height: '4rem' }}
        />
      )}
      <h3>{service.name}</h3>
      <p>{service.short_description}</p>
      <div className="card-footer">
        {service.application_required && (
          <span className="badge">Application Required</span>
        )}
        <a
          href={service.cta_url}
          className="btn btn-outline btn-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          {service.cta_text}
        </a>
      </div>
    </Card>
  )
}

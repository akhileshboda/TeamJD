import { motion, useReducedMotion } from 'motion/react'
import { useAssets } from '../hooks/useAssets'

export default function ResultCard({ result, onOpen }) {
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()
  const src = resolveAsset(result.src)

  const Card = shouldReduce ? 'div' : motion.div
  const cardProps = shouldReduce
    ? {}
    : { whileHover: 'hover', initial: 'rest', animate: 'rest' }

  const overlayVariants = {
    rest: { opacity: 0 },
    hover: { opacity: 1, transition: { duration: 0.25 } },
  }

  return (
    <Card
      className="result-card"
      onClick={() => onOpen({ src, alt: result.alt, caption: result.caption })}
      role="button"
      tabIndex={0}
      aria-label={`View: ${result.caption}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen({ src, alt: result.alt, caption: result.caption })
        }
      }}
      {...cardProps}
    >
      <img
        src={src}
        alt={result.alt}
        loading="eager"
        decoding="async"
        width="683"
        height="1024"
      />
      {shouldReduce ? (
        <div className="result-card-overlay">
          <span className="result-caption">{result.caption}</span>
        </div>
      ) : (
        <motion.div className="result-card-overlay" variants={overlayVariants}>
          <span className="result-caption">{result.caption}</span>
        </motion.div>
      )}
    </Card>
  )
}

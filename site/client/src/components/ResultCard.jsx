import { useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useAssets } from '../hooks/useAssets'

export default function ResultCard({ result, onOpen }) {
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()
  const cardRef = useRef(null)
  const src = resolveAsset(result.src)

  const openResult = () => {
    onOpen({
      src,
      alt: result.alt,
      caption: result.caption,
      trigger: cardRef.current,
    })
  }

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
      ref={cardRef}
      className="result-card"
      onClick={openResult}
      role="button"
      tabIndex={0}
      aria-label={`View: ${result.caption}`}
      data-analytics-event="result_open"
      data-analytics-location="results_grid"
      data-analytics-id={result.id}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openResult()
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

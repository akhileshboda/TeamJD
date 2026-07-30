import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { getResultPresentation } from '../utils/resultsLibrary'
import '../styles/ResultMedia.css'

export default function ResultMedia({
  result,
  src,
  loading = 'eager',
  className = '',
}) {
  const shouldReduceMotion = useReducedMotion()
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const presentation = getResultPresentation(result)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [result?.id, src])

  const style = {
    '--result-focus-x': `${presentation.focusX}%`,
    '--result-focus-y': `${presentation.focusY}%`,
  }

  return (
    <div
      className={`result-media${className ? ` ${className}` : ''}`}
      data-fit={presentation.fit}
      data-loaded={loaded ? 'true' : 'false'}
      style={style}
    >
      {failed ? (
        <div className="result-media-fallback" role="img" aria-label="Image unavailable">
          <span aria-hidden="true">JD</span>
          This image is temporarily unavailable.
        </div>
      ) : (
        <>
          {presentation.fit === 'contain' && (
            <img
              className="result-media-ambient"
              src={src}
              alt=""
              aria-hidden="true"
              loading={loading}
              decoding="async"
              draggable={false}
            />
          )}
          <motion.img
            key={`${result?.id || src}-foreground`}
            className="result-media-foreground"
            src={src}
            alt={result?.alt || ''}
            loading={loading}
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            initial={false}
            animate={{ opacity: loaded ? 1 : 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.24,
              ease: 'easeOut',
            }}
          />
        </>
      )}
    </div>
  )
}

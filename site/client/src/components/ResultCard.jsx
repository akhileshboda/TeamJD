import { useEffect, useState } from 'react'
import { useAssets } from '../hooks/useAssets'
import { RESULT_CATEGORY_LABELS } from '../utils/resultsLibrary'

export default function ResultCard({ result, onOpen, priority = false }) {
  const resolveAsset = useAssets()
  const src = resolveAsset(result.src)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [src])

  return (
    <button
      type="button"
      className={`result-card result-card--${result.kind}`}
      onClick={(event) => onOpen(result, event.currentTarget)}
      aria-label={`View ${result.caption}`}
      data-analytics-event="result_open"
      data-analytics-location="results_library"
      data-analytics-id={result.id}
      data-result-id={result.id}
    >
      <span className="result-card-media">
        {imageFailed ? (
          <span className="result-card-image-fallback" role="img" aria-label="Image unavailable">
            <span aria-hidden="true">JD</span>
            Image unavailable
          </span>
        ) : (
          <img
            src={src}
            alt={result.alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            width="900"
            height="1200"
            onError={() => setImageFailed(true)}
          />
        )}
        <span className="result-card-badges" aria-hidden="true">
          <span className="result-card-category">{RESULT_CATEGORY_LABELS[result.category]}</span>
          <span className={`result-card-kind result-card-kind--${result.kind}`}>
            {result.kind === 'client' ? 'Client result' : 'Reference'}
          </span>
        </span>
      </span>

      <span className="result-card-copy">
        <span className="result-card-caption">{result.caption}</span>
        <span className="result-card-action" aria-hidden="true">View result ↗</span>
      </span>
    </button>
  )
}

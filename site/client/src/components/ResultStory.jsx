import { getResultStory } from '../utils/resultsLibrary'
import '../styles/ResultStory.css'

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export default function ResultStory({
  result,
  titleId,
  descriptionId,
  headingLevel = 3,
  className = '',
}) {
  const story = getResultStory(result)
  const Heading = `h${headingLevel}`

  return (
    <div className={`result-story${className ? ` ${className}` : ''}`}>
      <span className="result-story-badge" data-category={result?.category}>
        {story.categoryLabel}
      </span>

      <Heading id={titleId} className="result-story-title">{story.title}</Heading>

      {story.location && (
        <div className="result-story-location">
          <PinIcon />
          <span>{story.location}</span>
          {story.duration && <span className="result-story-meta-sep">{story.duration}</span>}
        </div>
      )}

      {story.summary && (
        <p id={descriptionId} className="result-story-summary">{story.summary}</p>
      )}

      {story.testimonial && (
        <figure className="result-story-testimonial" data-category={result?.category}>
          <span className="result-story-quote-mark" aria-hidden="true">&ldquo;</span>
          <blockquote>{story.testimonial.quote}</blockquote>
          <figcaption>
            <strong>{story.testimonial.author}</strong>
            {story.testimonial.result && ` · ${story.testimonial.result}`}
          </figcaption>
        </figure>
      )}
    </div>
  )
}

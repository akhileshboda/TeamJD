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

// Text typed in the dashboard keeps its shape: a blank line starts a new
// paragraph, and a single line break stays a line break (CSS pre-line).
function paragraphs(text) {
  return text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
}

export function ResultStoryBadge({ result }) {
  const story = getResultStory(result)

  return (
    <span className="result-story-badge" data-category={result?.category}>
      {story.categoryLabel}
    </span>
  )
}

export default function ResultStory({
  result,
  titleId,
  descriptionId,
  headingLevel = 3,
  className = '',
  showBadge = true,
}) {
  const story = getResultStory(result)
  const Heading = `h${headingLevel}`

  return (
    <div className={`result-story${className ? ` ${className}` : ''}`}>
      {showBadge && <ResultStoryBadge result={result} />}

      <Heading id={titleId} className="result-story-title">{story.title}</Heading>

      {(story.location || story.duration) && (
        <div className="result-story-location">
          {story.location && <PinIcon />}
          {story.location && <span>{story.location}</span>}
          {story.duration && <span className={story.location ? 'result-story-meta-sep' : undefined}>{story.duration}</span>}
        </div>
      )}

      {story.summary && (
        <div id={descriptionId} className="result-story-summary">
          {paragraphs(story.summary).map((part, index) => <p key={index}>{part}</p>)}
        </div>
      )}

      {story.testimonial && (
        <figure className="result-story-testimonial" data-category={result?.category}>
          <span className="result-story-quote-mark" aria-hidden="true">&ldquo;</span>
          <blockquote>
            {paragraphs(story.testimonial.quote).map((part, index) => <p key={index}>{part}</p>)}
          </blockquote>
          <figcaption>
            <strong>{story.testimonial.author}</strong>
            {story.testimonial.result && ` · ${story.testimonial.result}`}
          </figcaption>
        </figure>
      )}
    </div>
  )
}

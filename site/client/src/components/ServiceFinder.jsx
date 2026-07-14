import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import JourneyIcon from './JourneyIcon'
import { evaluateFinder, FINDER_QUESTIONS } from '../utils/qualification'

export default function ServiceFinder({ services }) {
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState({ status: 'locked' })
  const [error, setError] = useState('')
  const questionRefs = useRef({})
  const resultRef = useRef(null)
  const shouldFocusResult = useRef(false)

  const recommendation = result.recommendationSlug
    ? services.find((service) => service.slug === result.recommendationSlug)
    : null

  useEffect(() => {
    if (window.location.hash !== '#find-your-fit') return undefined

    const frame = requestAnimationFrame(() => {
      document.getElementById('find-your-fit')?.scrollIntoView({ block: 'start' })
    })

    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (shouldFocusResult.current && result.status === 'recommended') {
      resultRef.current?.focus()
      shouldFocusResult.current = false
    }
  }, [result])

  const submit = (event) => {
    event.preventDefault()
    const nextResult = evaluateFinder(answers)

    if (nextResult.status === 'locked') {
      setError('Choose an answer for both questions to see your recommended path.')
      questionRefs.current[nextResult.missingQuestionIds[0]]?.focus()
      return
    }

    shouldFocusResult.current = true
    setError('')
    setResult(nextResult)
  }

  const restart = () => {
    setAnswers({})
    setError('')
    setResult({ status: 'locked' })
    requestAnimationFrame(() => questionRefs.current[FINDER_QUESTIONS[0].id]?.focus())
  }

  return (
    <section id="find-your-fit" className="service-finder" aria-labelledby="service-finder-title">
      <div className="service-finder-glow" aria-hidden="true" />
      <div className="service-finder-intro">
        <div className="service-finder-icon" aria-hidden="true">
          <JourneyIcon name="compass" size={30} />
        </div>
        <span className="eyebrow">Find Your Fit</span>
        <h2 id="service-finder-title">Start in the right room.</h2>
        <p>
          Two quick questions will point you towards the service that best matches your goal.
          You will still review that service and complete its fit check before booking.
        </p>
      </div>

      {result.status === 'locked' ? (
        <form className="service-finder-form" onSubmit={submit} noValidate>
          {FINDER_QUESTIONS.map((question, index) => (
            <fieldset
              key={question.id}
              className="service-finder-question"
              ref={(node) => {
                questionRefs.current[question.id] = node
              }}
              tabIndex="-1"
            >
              <legend>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {question.prompt}
              </legend>
              <div className="service-finder-options">
                {question.options.map((option) => {
                  const inputId = `finder-${question.id}-${option.value}`
                  return (
                    <label className="service-finder-option" htmlFor={inputId} key={option.value}>
                      <input
                        id={inputId}
                        type="radio"
                        name={`finder-${question.id}`}
                        value={option.value}
                        checked={answers[question.id] === option.value}
                        onChange={() => {
                          setAnswers((current) => ({ ...current, [question.id]: option.value }))
                          setError('')
                        }}
                      />
                      <span className="service-finder-option-mark" aria-hidden="true" />
                      <span>{option.label}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ))}

          {error && <p className="qualification-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary btn-lg">
            Show My Best Match
            <JourneyIcon name="arrowRight" size={18} />
          </button>
        </form>
      ) : (
        <div ref={resultRef} className="service-finder-result" tabIndex="-1" aria-live="polite">
          <span className="service-finder-result-label">Your recommended path</span>
          <h3>{recommendation?.name}</h3>
          <p>{result.reason}</p>
          {recommendation && <p className="service-finder-result-detail">{recommendation.tagline}</p>}
          <div className="service-finder-result-actions">
            {recommendation && (
              <Link className="btn btn-primary btn-lg" to={`/services/${recommendation.slug}`}>
                Review {recommendation.name}
                <JourneyIcon name="arrowRight" size={18} />
              </Link>
            )}
            <button type="button" className="qualification-edit" onClick={restart}>
              <JourneyIcon name="refresh" size={17} />
              Start again
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

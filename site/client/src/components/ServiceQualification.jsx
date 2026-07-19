import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import JourneyIcon from './JourneyIcon'
import {
  clearServiceQualification,
  evaluateQualification,
  markServiceQualified,
} from '../utils/qualification'

function qualifiedResult() {
  return { status: 'qualified', missingQuestionIds: [] }
}

export default function ServiceQualification({
  service,
  services,
  initialQualified = false,
  onStateChange,
  embedded = false,
  sectionId = 'service-fit-check',
}) {
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(initialQualified ? qualifiedResult : { status: 'locked' })
  const [error, setError] = useState('')
  const resultRef = useRef(null)
  const questionRefs = useRef({})
  const shouldFocusResult = useRef(false)
  const qualification = service.qualification

  const recommendation = result.recommendationSlug
    ? services.find((candidate) => candidate.slug === result.recommendationSlug)
    : null

  useEffect(() => {
    if (shouldFocusResult.current && result.status !== 'locked') {
      resultRef.current?.focus()
      shouldFocusResult.current = false
    }
  }, [result])

  const chooseAnswer = (questionId, value) => {
    setAnswers((current) => ({ ...current, [questionId]: value }))
    setError('')
  }

  const submit = (event) => {
    event.preventDefault()
    const nextResult = evaluateQualification(qualification, answers)

    if (nextResult.status === 'locked') {
      setError('Answer each question before checking your fit.')
      questionRefs.current[nextResult.missingQuestionIds[0]]?.focus()
      return
    }

    if (nextResult.status === 'qualified') {
      markServiceQualified(service.slug)
    } else {
      clearServiceQualification(service.slug)
    }

    shouldFocusResult.current = true
    setError('')
    setResult(nextResult)
    onStateChange?.(nextResult)
  }

  const editAnswers = () => {
    clearServiceQualification(service.slug)
    setAnswers({})
    setError('')
    setResult({ status: 'locked' })
    onStateChange?.({ status: 'locked' })
    requestAnimationFrame(() => questionRefs.current[qualification.questions[0]?.id]?.focus())
  }

  return (
    <section
      id={sectionId}
      className={`service-qualification${embedded ? ' service-qualification--embedded' : ' glass-panel'}`}
      aria-labelledby="service-qualification-title"
    >
      <div className="service-qualification-heading">
        <div className="service-qualification-icon" aria-hidden="true">
          <JourneyIcon name="compass" size={26} />
        </div>
        <div>
          <span className="eyebrow">{qualification.eyebrow}</span>
          <h2 id="service-qualification-title">{qualification.title}</h2>
          <p>{qualification.intro}</p>
        </div>
      </div>

      {result.status === 'locked' ? (
        <form className="qualification-form" onSubmit={submit} noValidate>
          <div className="qualification-progress">
            <div className="qualification-progress-dots" aria-hidden="true">
              {qualification.questions.map((question) => (
                <span
                  key={question.id}
                  className={`qualification-progress-dot${
                    answers[question.id] ? ' is-filled' : ''
                  }`}
                />
              ))}
            </div>
            <span className="visually-hidden" aria-live="polite">
              {qualification.questions.filter((question) => answers[question.id]).length} of{' '}
              {qualification.questions.length} questions answered
            </span>
          </div>

          {qualification.questions.map((question, questionIndex) => (
            <fieldset
              key={question.id}
              className="qualification-question"
              ref={(node) => {
                questionRefs.current[question.id] = node
              }}
              tabIndex="-1"
            >
              <legend>
                <span>{String(questionIndex + 1).padStart(2, '0')}</span>
                {question.prompt}
              </legend>

              <div className="qualification-options">
                {question.options.map((option) => {
                  const inputId = `${service.slug}-${question.id}-${option.value}`
                  return (
                    <label className="qualification-option" htmlFor={inputId} key={option.value}>
                      <input
                        id={inputId}
                        type="radio"
                        name={question.id}
                        value={option.value}
                        checked={answers[question.id] === option.value}
                        onChange={() => chooseAnswer(question.id, option.value)}
                      />
                      <span className="qualification-option-mark" aria-hidden="true" />
                      <span>{option.label}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ))}

          {error && <p className="qualification-error" role="alert">{error}</p>}

          <div className="qualification-submit-row">
            <button type="submit" className="btn btn-primary btn-lg">
              Check My Fit
              <JourneyIcon name="arrowRight" size={18} />
            </button>
            <p>
              Your answers stay on this page. They are not sent to Jake or stored after this
              browser session.
            </p>
          </div>
        </form>
      ) : (
        <div
          ref={resultRef}
          className={`qualification-result qualification-result--${result.status}`}
          tabIndex="-1"
          aria-live="polite"
        >
          <div className="qualification-result-icon" aria-hidden="true">
            <JourneyIcon name={result.status === 'qualified' ? 'check' : 'compass'} size={28} />
          </div>

          {result.status === 'qualified' ? (
            <>
              <span className="qualification-result-kicker">Booking unlocked</span>
              <h3>{qualification.pass_title}</h3>
              <p>{qualification.pass_copy}</p>
              <div className="qualification-result-actions">
                <a
                  href={service.cta_url}
                  className="btn btn-primary btn-lg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {service.cta_text}
                  <JourneyIcon name="arrowRight" size={18} />
                </a>
                <button type="button" className="qualification-edit" onClick={editAnswers}>
                  <JourneyIcon name="refresh" size={17} />
                  Review fit check
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="qualification-result-kicker">A better next move</span>
              <h3>{qualification.redirect_title}</h3>
              <p>{result.response || qualification.redirect_copy}</p>

              {recommendation && (
                <div className="qualification-recommendation">
                  <span>Recommended service</span>
                  <strong>{recommendation.name}</strong>
                  <p>{recommendation.short_description}</p>
                </div>
              )}

              <div className="qualification-result-actions">
                {recommendation ? (
                  <Link className="btn btn-primary btn-lg" to={`/services/${recommendation.slug}`}>
                    Explore {recommendation.name}
                    <JourneyIcon name="arrowRight" size={18} />
                  </Link>
                ) : (
                  <Link className="btn btn-primary btn-lg" to="/contact">
                    Send Jake a Message
                    <JourneyIcon name="message" size={18} />
                  </Link>
                )}
                <Link className="btn btn-secondary" to="/services">
                  View All Services
                </Link>
                <button type="button" className="qualification-edit" onClick={editAnswers}>
                  <JourneyIcon name="refresh" size={17} />
                  Change answers
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}

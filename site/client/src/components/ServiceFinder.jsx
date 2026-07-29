import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import JourneyIcon from './JourneyIcon'
import { evaluateFinder, FINDER_QUESTIONS } from '../utils/qualification'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function ServiceFinder({ services }) {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState({ status: 'locked' })
  const triggerRef = useRef(null)
  const dialogRef = useRef(null)
  const resultRef = useRef(null)
  const titleId = useId()
  const location = useLocation()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()

  const recommendation = result.recommendationSlug
    ? services.find((service) => service.slug === result.recommendationSlug)
    : null
  const currentQuestion = FINDER_QUESTIONS[step]
  const progress = ((step + 1) / FINDER_QUESTIONS.length) * 100

  useEffect(() => {
    setIsOpen(location.hash === '#find-your-fit')
  }, [location.hash])

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
        navigate({ pathname: location.pathname, search: location.search }, { replace: true })
        return
      }

      if (event.key !== 'Tab') return
      const focusable = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }, [isOpen, location.pathname, location.search, navigate])

  useEffect(() => {
    if (result.status === 'recommended') resultRef.current?.focus()
  }, [result.status])

  const openFinder = () => {
    setIsOpen(true)
    navigate({ pathname: location.pathname, search: location.search, hash: '#find-your-fit' })
  }

  const closeFinder = () => {
    setIsOpen(false)
    navigate({ pathname: location.pathname, search: location.search }, { replace: true })
  }

  const submitStep = (event) => {
    event.preventDefault()
    if (!answers[currentQuestion.id]) return

    if (step < FINDER_QUESTIONS.length - 1) {
      setStep((current) => current + 1)
      return
    }

    setResult(evaluateFinder(answers))
  }

  const restart = () => {
    setAnswers({})
    setResult({ status: 'locked' })
    setStep(0)
  }

  const editAnswers = () => {
    setResult({ status: 'locked' })
    setStep(FINDER_QUESTIONS.length - 1)
  }

  const dialogMotion = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18, scale: 0.985 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 12, scale: 0.99 },
        transition: { duration: 0.22, ease: 'easeOut' },
      }

  return (
    <>
      <section id="find-your-fit" className="service-finder-banner" aria-labelledby={titleId}>
        <div className="service-finder-banner-icon" aria-hidden="true">
          <JourneyIcon name="compass" size={28} />
        </div>
        <div className="service-finder-banner-copy">
          <span className="eyebrow">Find Your Fit</span>
          <h2 id={titleId}>Start in the right room.</h2>
          <p>Two quick questions will point you towards the coaching path that best matches your goal.</p>
        </div>
        <button
          ref={triggerRef}
          type="button"
          className="btn btn-primary btn-lg"
          onClick={openFinder}
        >
          Find My Best Match
          <JourneyIcon name="arrowRight" size={18} />
        </button>
      </section>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                className="service-finder-modal-overlay"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) closeFinder()
                }}
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <motion.section
                  ref={dialogRef}
                  className="service-finder-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="service-finder-modal-title"
                  tabIndex={-1}
                  {...dialogMotion}
                >
                  <header className="service-finder-modal-header">
                    <div>
                      <span className="eyebrow">Find Your Fit</span>
                      <h2 id="service-finder-modal-title">
                        {result.status === 'recommended' ? 'Your best starting point.' : 'Start in the right room.'}
                      </h2>
                    </div>
                    <button
                      type="button"
                      className="service-finder-modal-close"
                      aria-label="Close Find Your Fit"
                      onClick={closeFinder}
                      autoFocus
                    >
                      <JourneyIcon name="close" size={19} />
                    </button>
                  </header>

                  {result.status === 'locked' ? (
                    <form className="service-finder-step" onSubmit={submitStep}>
                      <div className="service-finder-progress">
                        <div className="service-finder-progress-meta">
                          <span>Question {step + 1} of {FINDER_QUESTIONS.length}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="service-finder-progress-track" aria-hidden="true">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      <fieldset className="service-finder-question">
                        <legend>{currentQuestion.prompt}</legend>
                        <div className="service-finder-options">
                          {currentQuestion.options.map((option) => {
                            const inputId = `finder-${currentQuestion.id}-${option.value}`
                            return (
                              <label className="service-finder-option" htmlFor={inputId} key={option.value}>
                                <input
                                  id={inputId}
                                  type="radio"
                                  name={`finder-${currentQuestion.id}`}
                                  value={option.value}
                                  checked={answers[currentQuestion.id] === option.value}
                                  onChange={() => {
                                    setAnswers((current) => ({
                                      ...current,
                                      [currentQuestion.id]: option.value,
                                    }))
                                  }}
                                />
                                <span className="service-finder-option-mark" aria-hidden="true" />
                                <span>{option.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </fieldset>

                      <div className="service-finder-step-actions">
                        {step > 0 && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setStep((current) => current - 1)}
                          >
                            <JourneyIcon name="arrowLeft" size={17} />
                            Back
                          </button>
                        )}
                        <button
                          type="submit"
                          className="btn btn-primary btn-lg"
                          disabled={!answers[currentQuestion.id]}
                        >
                          {step === FINDER_QUESTIONS.length - 1 ? 'Show My Best Match' : 'Continue'}
                          <JourneyIcon name="arrowRight" size={18} />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      ref={resultRef}
                      className="service-finder-result"
                      tabIndex={-1}
                      aria-live="polite"
                    >
                      <span className="service-finder-result-label">Your recommended path</span>
                      <h3>{recommendation?.name}</h3>
                      <p>{result.reason}</p>
                      {recommendation && (
                        <p className="service-finder-result-detail">{recommendation.tagline}</p>
                      )}
                      <div className="service-finder-result-actions">
                        {recommendation && (
                          <Link
                            className="btn btn-primary btn-lg"
                            to={`/services/${recommendation.slug}`}
                          >
                            Review {recommendation.name}
                            <JourneyIcon name="arrowRight" size={18} />
                          </Link>
                        )}
                        <button type="button" className="qualification-edit" onClick={editAnswers}>
                          <JourneyIcon name="arrowLeft" size={17} />
                          Change last answer
                        </button>
                        <button type="button" className="qualification-edit" onClick={restart}>
                          <JourneyIcon name="refresh" size={17} />
                          Start again
                        </button>
                      </div>
                    </div>
                  )}
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import JourneyIcon from './JourneyIcon'
import {
  clearLastFindYourFitTrigger,
  FIND_YOUR_FIT_HASH,
  FIND_YOUR_FIT_HISTORY_KEY,
  getLastFindYourFitTrigger,
} from './FindYourFitLink'
import {
  clearServiceQualification,
  evaluateFinder,
  getFinderQuestions,
  markServiceQualified,
  pruneFinderAnswers,
} from '../utils/qualification'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function ServiceFinder({ services = [], loading = false, error = null }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState({ status: 'locked' })
  const dialogRef = useRef(null)
  const resultRef = useRef(null)
  const questionRef = useRef(null)
  const openerRef = useRef(null)
  const previousPathnameRef = useRef(null)
  const finderQualifiedSlugRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const isOpen = location.hash === FIND_YOUR_FIT_HASH

  const recommendation = result.recommendationSlug
    ? services.find((service) => service.slug === result.recommendationSlug)
    : null
  const questions = getFinderQuestions(answers)
  const currentQuestion = questions[step]
  const progress = ((step + 1) / questions.length) * 100

  const restart = useCallback(() => {
    setAnswers({})
    setResult({ status: 'locked' })
    setStep(0)
  }, [])

  useEffect(() => {
    if (previousPathnameRef.current === null) {
      previousPathnameRef.current = location.pathname
      return
    }

    if (previousPathnameRef.current !== location.pathname) {
      previousPathnameRef.current = location.pathname
      restart()
    }
  }, [location.pathname, restart])

  const closeFinder = useCallback(() => {
    if (location.state?.[FIND_YOUR_FIT_HISTORY_KEY]) {
      navigate(-1)
      return
    }

    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: location.state },
    )
  }, [location.pathname, location.search, location.state, navigate])

  useEffect(() => {
    if (!isOpen) return undefined

    openerRef.current = getLastFindYourFitTrigger() || document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeFinder()
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
      requestAnimationFrame(() => {
        const opener = openerRef.current
        if (opener?.isConnected) {
          opener.focus({ preventScroll: true })
        } else {
          const fallbackCandidates = Array.from(
            document.querySelectorAll(
              '[data-find-your-fit-focus-fallback], [data-find-your-fit-trigger]',
            ),
          )
          const fallback =
            fallbackCandidates.find((element) => {
              const styles = window.getComputedStyle(element)
              const bounds = element.getBoundingClientRect()
              return (
                !element.hidden &&
                element.getAttribute('aria-hidden') !== 'true' &&
                styles.display !== 'none' &&
                styles.visibility !== 'hidden' &&
                (bounds.width > 0 || bounds.height > 0)
              )
            }) || fallbackCandidates[0]
          fallback?.focus({ preventScroll: true })
        }
        clearLastFindYourFitTrigger(opener)
        openerRef.current = null
      })
    }
  }, [closeFinder, isOpen])

  useEffect(() => {
    if (result.status === 'recommended' || result.status === 'consult') {
      resultRef.current?.focus()
    }
  }, [result.status])

  useEffect(() => {
    if (!isOpen || result.status !== 'locked') return undefined

    const frame = requestAnimationFrame(() => questionRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [isOpen, result.status, step])

  const chooseAnswer = (questionId, value) => {
    setAnswers((current) => pruneFinderAnswers({ ...current, [questionId]: value }))
  }

  const submitStep = (event) => {
    event.preventDefault()
    if (!answers[currentQuestion.id]) return

    if (step < questions.length - 1) {
      setStep((current) => current + 1)
      return
    }

    const nextResult = evaluateFinder(answers)
    const previouslyQualifiedSlug = finderQualifiedSlugRef.current

    if (previouslyQualifiedSlug && previouslyQualifiedSlug !== nextResult.qualifiesSlug) {
      clearServiceQualification(previouslyQualifiedSlug)
      finderQualifiedSlugRef.current = null
    }

    if (nextResult.qualifiesSlug) {
      markServiceQualified(nextResult.qualifiesSlug)
      finderQualifiedSlugRef.current = nextResult.qualifiesSlug
    }

    setResult(nextResult)
  }

  const editAnswers = () => {
    setResult({ status: 'locked' })
    setStep(questions.length - 1)
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
    typeof document !== 'undefined' &&
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
                      {result.status === 'recommended'
                        ? 'Your best starting point.'
                        : result.status === 'consult'
                          ? 'A conversation is the right next step.'
                          : 'Start with what you actually need.'}
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
                          <span>Question {step + 1} of {questions.length}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="service-finder-progress-track" aria-hidden="true">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      <fieldset
                        ref={questionRef}
                        className="service-finder-question"
                        tabIndex={-1}
                      >
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
                                  onChange={() => chooseAnswer(currentQuestion.id, option.value)}
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
                          {step === questions.length - 1 ? 'Show My Best Match' : 'Continue'}
                          <JourneyIcon name="arrowRight" size={18} />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      ref={resultRef}
                      className={`service-finder-result service-finder-result--${result.status}`}
                      tabIndex={-1}
                      aria-live="polite"
                    >
                      <span className="service-finder-result-label">
                        {result.status === 'consult' ? 'Your next step' : 'Your recommended path'}
                      </span>
                      <h3>
                        {result.status === 'consult'
                          ? 'Talk it through with Jake'
                          : recommendation?.name ||
                            (loading ? 'Loading your match…' : 'Your match is ready.')}
                      </h3>
                      <p>{result.reason}</p>
                      {result.evidence?.length > 0 && (
                        <ul
                          className="service-finder-result-reasons"
                          aria-label="Why this is your next step"
                        >
                          {result.evidence.map((reason) => (
                            <li key={reason}>
                              <JourneyIcon name="check" size={16} />
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      )}
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
                        {result.status === 'consult' && (
                          <Link
                            className="btn btn-primary btn-lg"
                            to={{
                              pathname: '/contact',
                              search: '?service=unsure',
                              hash: '#contact-enquiry',
                            }}
                          >
                            Ask Jake Directly
                            <JourneyIcon name="message" size={18} />
                          </Link>
                        )}
                        {result.status === 'recommended' && !recommendation && !loading && (
                          <Link className="btn btn-primary btn-lg" to="/services">
                            View All Services
                            <JourneyIcon name="arrowRight" size={18} />
                          </Link>
                        )}
                        {result.status === 'recommended' && error && (
                          <p className="service-finder-result-detail" role="status">
                            We could not load the service details. You can still compare every
                            coaching option on the Services page.
                          </p>
                        )}
                        <button type="button" className="qualification-edit" onClick={editAnswers}>
                          <JourneyIcon name="arrowLeft" size={17} />
                          Change answers
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
      )
  )
}

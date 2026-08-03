import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import FindYourFitLink from './FindYourFitLink'
import JourneyIcon from './JourneyIcon'
import { useFindYourFitSession } from '../context/FindYourFitSession'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function CompetitionPrepBookingAction({
  service,
  services = [],
  className = 'btn btn-primary',
  children,
}) {
  const { completed, outcome, validForCompetitionPrep } = useFindYourFitSession()
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef(null)
  const dialogRef = useRef(null)
  const shouldReduceMotion = useReducedMotion()

  const recommendation = outcome?.recommendationSlug
    ? services.find((candidate) => candidate.slug === outcome.recommendationSlug)
    : null

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
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
      requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))
    }
  }, [isOpen])

  if (validForCompetitionPrep) {
    return (
      <a
        href={service.cta_url}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    )
  }

  const title = !completed
    ? 'Complete Find Your Fit before booking?'
    : outcome.status === 'consult'
      ? 'Your result recommends a conversation first.'
      : `${recommendation?.name || 'Another service'} is your current match.`

  const copy = !completed
    ? 'You have not completed Find Your Fit in this session. It takes four to six focused questions and helps Jake direct you to the right starting point.'
    : outcome.status === 'consult'
      ? 'Your answers suggest talking with Jake before selecting a coaching service. You can review that result or continue to the prep calendar anyway.'
      : `Your answers currently point towards ${recommendation?.name || 'a different coaching path'}, not Competition Preparation. You can review your result or continue to the prep calendar anyway.`

  const motionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18, scale: 0.985 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 12, scale: 0.99 },
        transition: { duration: 0.22, ease: 'easeOut' },
      }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        onClick={() => setIsOpen(true)}
      >
        {children}
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                className="booking-checkpoint-overlay"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setIsOpen(false)
                }}
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <motion.section
                  ref={dialogRef}
                  className="booking-checkpoint-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="booking-checkpoint-title"
                  aria-describedby="booking-checkpoint-copy"
                  tabIndex={-1}
                  {...motionProps}
                >
                  <button
                    type="button"
                    className="booking-checkpoint-close"
                    aria-label="Close booking checkpoint"
                    onClick={() => setIsOpen(false)}
                    autoFocus
                  >
                    <JourneyIcon name="close" size={18} />
                  </button>
                  <div className="booking-checkpoint-icon" aria-hidden="true">
                    <JourneyIcon name="compass" size={28} />
                  </div>
                  <span className="eyebrow">Before Calendly</span>
                  <h2 id="booking-checkpoint-title">{title}</h2>
                  <p id="booking-checkpoint-copy">{copy}</p>
                  <div className="booking-checkpoint-actions">
                    <FindYourFitLink
                      className="btn btn-primary btn-lg"
                      onClick={() => setIsOpen(false)}
                    >
                      {completed ? 'Review Find Your Fit' : 'Start Find Your Fit'}
                      <JourneyIcon name="arrowRight" size={18} />
                    </FindYourFitLink>
                    <a
                      href={service.cta_url}
                      className="btn btn-secondary btn-lg"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsOpen(false)}
                    >
                      Continue to Calendly anyway
                    </a>
                    <button
                      type="button"
                      className="booking-checkpoint-cancel"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import JourneyIcon from './JourneyIcon'
import ScrollChromeSection from './ScrollChromeSection'
import ServiceQualification from './ServiceQualification'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function ServiceReadinessGate({
  service,
  services,
  qualificationState,
  onStateChange,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef(null)
  const dialogRef = useRef(null)
  const shouldReduceMotion = useReducedMotion()
  const isQualified = qualificationState.status === 'qualified'

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
      if (focusable.length === 0) return
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
  }, [isOpen])

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
      <ScrollChromeSection
        id="service-fit-check"
        className="service-content-block service-content-block--readiness service-readiness-gate"
        aria-labelledby="service-readiness-title"
      >
        <div className="service-content-block-heading">
          <span aria-hidden="true">04</span>
          <div>
            <span>Your next step</span>
            <h3 id="service-readiness-title">Readiness check</h3>
          </div>
        </div>

        <div className="service-readiness-gate-body">
          <div className="service-readiness-gate-icon" aria-hidden="true">
            <JourneyIcon name={isQualified ? 'check' : 'compass'} size={26} />
          </div>
          <div>
            <span className="eyebrow">{isQualified ? 'Fit check complete' : service.qualification.eyebrow}</span>
            <h2>{isQualified ? service.qualification.pass_title : service.qualification.title}</h2>
            <p>{isQualified ? service.qualification.pass_copy : service.qualification.intro}</p>
          </div>
          <button
            ref={triggerRef}
            type="button"
            className="btn btn-primary"
            onClick={() => setIsOpen(true)}
          >
            {isQualified ? 'Review result' : 'Start readiness check'}
            <JourneyIcon name="arrowRight" size={17} />
          </button>
        </div>
      </ScrollChromeSection>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                className="service-readiness-modal-overlay"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setIsOpen(false)
                }}
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <motion.div
                  ref={dialogRef}
                  className="service-readiness-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${service.name} readiness check`}
                  tabIndex={-1}
                  {...motionProps}
                >
                  <div className="service-readiness-modal-bar">
                    <span>Team JD service fit</span>
                    <button
                      type="button"
                      className="service-readiness-modal-close"
                      aria-label="Close readiness check"
                      onClick={() => setIsOpen(false)}
                      autoFocus
                    >
                      <JourneyIcon name="close" size={18} />
                    </button>
                  </div>
                  <ServiceQualification
                    service={service}
                    services={services}
                    initialQualified={isQualified}
                    onStateChange={onStateChange}
                    embedded
                    sectionId={null}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}

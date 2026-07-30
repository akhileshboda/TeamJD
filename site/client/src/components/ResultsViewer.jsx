import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useAssets } from '../hooks/useAssets'
import ResultPresentation from './ResultPresentation'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function ResultsViewer({
  result,
  position,
  total,
  previousResult,
  nextResult,
  onPrevious,
  onNext,
  onClose,
}) {
  const dialogRef = useRef(null)
  const swipeRef = useRef(null)
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()
  const [storyOpen, setStoryOpen] = useState(true)
  const imageSrc = result ? resolveAsset(result.src) : ''

  useEffect(() => {
    setStoryOpen(true)
  }, [result?.id])

  useEffect(() => {
    if (!result) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [result])

  useEffect(() => {
    if (!result) return undefined

    const handler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === 'ArrowLeft' && previousResult) {
        event.preventDefault()
        onPrevious()
        return
      }

      if (event.key === 'ArrowRight' && nextResult) {
        event.preventDefault()
        onNext()
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

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextResult, onClose, onNext, onPrevious, previousResult, result])

  useEffect(() => {
    if (!result) return undefined

    ;[previousResult, nextResult].filter(Boolean).forEach((adjacent) => {
      const image = new Image()
      image.src = resolveAsset(adjacent.src)
    })

    return undefined
  }, [nextResult, previousResult, resolveAsset, result])

  const overlayMotion = shouldReduce
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 },
      }

  const dialogMotion = shouldReduce
    ? {}
    : {
        initial: { opacity: 0, y: 16, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 10, scale: 0.98 },
        transition: { duration: 0.24, ease: 'easeOut' },
      }

  return (
    <AnimatePresence>
      {result && (
        <motion.div
          className="results-viewer-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
          {...overlayMotion}
        >
          <motion.section
            ref={dialogRef}
            className="results-viewer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-viewer-title"
            aria-describedby="results-viewer-description"
            tabIndex={-1}
            onPointerDown={(event) => {
              if (event.pointerType === 'touch') {
                swipeRef.current = { x: event.clientX, y: event.clientY }
              }
            }}
            onPointerUp={(event) => {
              if (!swipeRef.current || event.pointerType !== 'touch') return
              const deltaX = event.clientX - swipeRef.current.x
              const deltaY = event.clientY - swipeRef.current.y
              swipeRef.current = null
              if (Math.abs(deltaX) < 54 || Math.abs(deltaX) < Math.abs(deltaY)) return
              if (deltaX > 0 && previousResult) onPrevious()
              if (deltaX < 0 && nextResult) onNext()
            }}
            {...dialogMotion}
          >
            <header className="results-viewer-header">
              <div>
                <span className="results-viewer-eyebrow">
                  {result.kind === 'client' ? 'Team JD client result' : 'Representative imagery'}
                </span>
                <span className="results-viewer-count">{position} of {total}</span>
              </div>
              <button
                type="button"
                className="results-viewer-close"
                aria-label="Close image viewer"
                onClick={onClose}
                autoFocus
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="results-viewer-body">
              <ResultPresentation
                result={result}
                src={imageSrc}
                titleId="results-viewer-title"
                descriptionId="results-viewer-description"
                headingLevel={2}
                storyOpen={storyOpen}
                onStoryOpenChange={setStoryOpen}
                allowStoryToggle
                useLabeledHideControl
                isModal
                role="document"
                className="results-viewer-presentation"
              />
            </div>

            <footer className="results-viewer-footer">
              <div className="results-viewer-navigation">
                <button type="button" onClick={onPrevious} disabled={!previousResult}>
                  <span aria-hidden="true">←</span> Previous
                </button>
                <button type="button" onClick={onNext} disabled={!nextResult}>
                  Next <span aria-hidden="true">→</span>
                </button>
              </div>
              <p className="results-viewer-hint">Use arrow keys or swipe to browse.</p>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function Lightbox({ image, onClose }) {
  const shouldReduce = useReducedMotion()
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!image) return undefined

    const returnFocusTarget = image.trigger
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
      if (returnFocusTarget?.isConnected) {
        requestAnimationFrame(() => returnFocusTarget.focus())
      }
    }
  }, [image])

  useEffect(() => {
    if (!image) return undefined

    const handler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
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
  }, [image, onClose])

  const overlayProps = shouldReduce
    ? { style: { opacity: 1 } }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 },
      }

  const innerProps = shouldReduce
    ? {}
    : {
        initial: { scale: 0.94, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.94, opacity: 0 },
        transition: { duration: 0.22 },
      }

  return (
    <AnimatePresence>
      {image && (
        <motion.div
          className="lightbox-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
          {...overlayProps}
        >
          <motion.div
            ref={dialogRef}
            className="lightbox-inner"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lightbox-title"
            aria-describedby={image.caption ? 'lightbox-caption' : undefined}
            tabIndex={-1}
            {...innerProps}
          >
            <h2 id="lightbox-title" className="visually-hidden">Client result image</h2>
            <button
              className="lightbox-close"
              aria-label="Close image viewer"
              onClick={onClose}
              autoFocus
            >
              &times;
            </button>
            <img
              className="lightbox-img"
              src={image.src}
              alt={image.alt}
              width="600"
              height="900"
            />
            {image.caption && (
              <p id="lightbox-caption" className="lightbox-caption">{image.caption}</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

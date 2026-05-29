import { useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

export default function Lightbox({ image, onClose }) {
  const shouldReduce = useReducedMotion()

  useEffect(() => {
    if (!image) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [image])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const overlayProps = shouldReduce
    ? { style: { opacity: 1 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }

  const innerProps = shouldReduce
    ? {}
    : { initial: { scale: 0.94, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.94, opacity: 0 }, transition: { duration: 0.22 } }

  return (
    <AnimatePresence>
      {image && (
        <motion.div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          {...overlayProps}
        >
          <motion.div className="lightbox-inner" {...innerProps}>
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
              <p className="lightbox-caption">{image.caption}</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

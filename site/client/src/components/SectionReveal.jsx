import { motion, useReducedMotion } from 'framer-motion'

export default function SectionReveal({ children, className = '', delay = 0, y = 32, inView = true }) {
  const shouldReduce = useReducedMotion()

  if (shouldReduce) {
    return <div className={className}>{children}</div>
  }

  // Above-the-fold content (inView={false}) animates on mount rather than via
  // an IntersectionObserver, which can race with StrictMode's dev double-mount
  // and strand content at the initial hidden state.
  const reveal = inView
    ? { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-80px' } }
    : { animate: { opacity: 1, y: 0 } }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      {...reveal}
      transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1], delay }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerContainer({ children, className = '', inView = true }) {
  const shouldReduce = useReducedMotion()

  if (shouldReduce) {
    return <div className={className}>{children}</div>
  }

  // See SectionReveal: inView={false} drives the stagger on mount (deterministic)
  // instead of via an IntersectionObserver, for above-the-fold grids.
  const activate = inView
    ? { whileInView: 'visible', viewport: { once: true, margin: '-60px' } }
    : { animate: 'visible' }

  return (
    <motion.div
      className={className}
      initial="hidden"
      {...activate}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08 } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className = '' }) {
  const shouldReduce = useReducedMotion()

  if (shouldReduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
      }}
    >
      {children}
    </motion.div>
  )
}

import { motion, useReducedMotion } from 'motion/react'

export default function PageHero({ eyebrow, title, subtitle }) {
  const shouldReduce = useReducedMotion()

  const Wrap = shouldReduce ? 'div' : motion.div
  const wrapProps = shouldReduce
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease: 'easeOut' },
      }

  return (
    <section className="page-hero">
      <div className="container">
        <Wrap {...wrapProps}>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </Wrap>
      </div>
    </section>
  )
}

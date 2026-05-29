import { motion, useReducedMotion } from 'framer-motion'

const ITEMS = [
  'Pro Physique Competitor',
  '100+ Clients Transformed',
  'All Major Federations',
  '100% Personalised',
  'Real Coaching Relationships',
]

export default function CredibilityStrip() {
  const shouldReduce = useReducedMotion()

  return (
    <div className="credibility-strip" aria-label="Credentials">
      <div className="container">
        {ITEMS.map((item, i) => {
          const Wrap = shouldReduce ? 'div' : motion.div
          const props = shouldReduce
            ? {}
            : {
                initial: { opacity: 0, y: 12 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true },
                transition: { duration: 0.4, delay: i * 0.07 },
              }

          return (
            <Wrap key={item} className="credibility-item" {...props}>
              <span className="check" aria-hidden="true">✦</span>
              <span>{item}</span>
            </Wrap>
          )
        })}
      </div>
    </div>
  )
}

import { motion, useReducedMotion } from 'framer-motion'
import { useAssets } from '../hooks/useAssets'

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
}

export default function Hero() {
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()

  const containerVariants = shouldReduce
    ? {}
    : {
        hidden: {},
        visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
      }

  const Item = shouldReduce ? 'div' : motion.div

  return (
    <section className="hero" aria-label="Hero">
      <div
        className="hero-bg"
        style={{ backgroundImage: `url('${resolveAsset('/api/assets/hero-bg')}')` }}
        role="img"
        aria-label="Muscular physique background"
      />
      <div className="hero-overlay" />
      <div className="container hero-content">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <Item variants={itemVariants}>
            <p className="hero-eyebrow">Team JD &mdash; Jake Dedert Fitness</p>
          </Item>

          <Item variants={itemVariants}>
            <h1>
              UNLOCK YOUR
              <br />
              TRUE POTENTIAL
            </h1>
          </Item>

          <Item variants={itemVariants}>
            <p className="hero-subtitle">
              Strong body, unstoppable mind. Let&apos;s build both. Personalised coaching
              tailored exclusively to you — competition prep, online coaching, and posing.
            </p>
          </Item>

          <Item variants={itemVariants}>
            <div className="hero-actions">
              <a
                href="https://calendly.com/team-jd/15min"
                className="btn btn-primary btn-lg"
                target="_blank"
                rel="noopener noreferrer"
              >
                Book a Free Consult
              </a>
              <a href="/services" className="btn btn-secondary btn-lg">
                View Services
              </a>
            </div>
          </Item>
        </motion.div>
      </div>
    </section>
  )
}

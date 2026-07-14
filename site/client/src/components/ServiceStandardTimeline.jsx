import { useRef } from 'react'
import { motion, useReducedMotion, useScroll } from 'motion/react'
import JourneyIcon from './JourneyIcon'
import SectionReveal from './SectionReveal'

export default function ServiceStandardTimeline({ service }) {
  const trackRef = useRef(null)
  const shouldReduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start 0.8', 'end 0.55'],
  })

  return (
    <section className="service-standard" aria-labelledby="service-standard-title">
      <SectionReveal>
        <div className="service-standard-heading">
          <div className="service-standard-mark" aria-hidden="true">
            <JourneyIcon name="target" size={28} />
          </div>
          <div>
            <span className="eyebrow">The Team JD Standard</span>
            <h2 id="service-standard-title">{service.expectation_title}</h2>
            <p>{service.expectation_lede}</p>
          </div>
        </div>
      </SectionReveal>

      <div className="service-standard-track" ref={trackRef}>
        <motion.div
          className="service-standard-line"
          aria-hidden="true"
          style={{ scaleY: shouldReduce ? 1 : scrollYProgress }}
        />
        <ol className="service-standard-steps">
          {service.expectations.map((step, index) => (
            <li key={step}>
              <SectionReveal className="service-standard-step" delay={Math.min(index * 0.05, 0.2)}>
                <span className="service-standard-node" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p>{step}</p>
              </SectionReveal>
            </li>
          ))}
        </ol>
      </div>

      {service.federations && (
        <SectionReveal>
          <div className="service-federation-note service-standard-federations">
            <span>Supported federations</span>
            <strong>{service.federations.join(' · ')}</strong>
          </div>
        </SectionReveal>
      )}
    </section>
  )
}

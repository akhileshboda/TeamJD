import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'

export default function ScrollChromeSection({ className = '', children, ...props }) {
  const sectionRef = useRef(null)
  const shouldReduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })
  const chromeTop = useTransform(scrollYProgress, [0, 1], ['4%', '72%'])
  const chromeOpacity = useTransform(scrollYProgress, [0, 0.12, 0.88, 1], [0.18, 0.9, 0.9, 0.18])

  return (
    <motion.section ref={sectionRef} className={className} {...props}>
      <motion.span
        className="service-scroll-chrome"
        aria-hidden="true"
        style={shouldReduceMotion ? { top: '34%', opacity: 0.65 } : { top: chromeTop, opacity: chromeOpacity }}
      />
      {children}
    </motion.section>
  )
}

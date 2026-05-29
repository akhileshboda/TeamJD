import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

export default function FAQItem({ faq, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const shouldReduce = useReducedMotion()

  return (
    <div className={`faq-item${isOpen ? ' open' : ''}`}>
      <button
        className="faq-question"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {faq.question}
        <svg
          className="faq-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="answer"
            initial={shouldReduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={shouldReduce ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="faq-answer-inner">{faq.answer}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

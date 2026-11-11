import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP)

// The landing page's motion language. Keep new sequences on these values so the
// page reads as one piece rather than a collection of effects.
export const EASE = {
  enter: 'power3.out', // things arriving
  move: 'expo.inOut', // things travelling between two states
  scrub: 'none', // anything tied directly to the scrollbar
}

export const DURATION = {
  quick: 0.45,
  base: 0.9,
  slow: 1.3,
}

// Pinned, scrubbed sequences only run on wide, pointer-driven screens. Phones get
// lighter one-shot reveals. Everything else (reduced motion, the dashboard preview)
// runs no GSAP at all and simply shows the content.
export const DESKTOP_QUERY = '(min-width: 1024px)'
export const MOBILE_QUERY = '(max-width: 1023.98px)'

export { gsap, ScrollTrigger, SplitText, useGSAP }

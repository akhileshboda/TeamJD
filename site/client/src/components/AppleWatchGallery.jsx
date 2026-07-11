import { AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useAssets } from '../hooks/useAssets'
import { useJSON } from '../hooks/useJSON'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SectionReveal from './SectionReveal'
import '../styles/AppleWatchGallery.css'

const CATEGORY_LABELS = {
  competition: 'Contest Prep',
  online: 'Online Coaching',
  posing: 'Posing',
  lifestyle: 'Lifestyle',
  training: 'Private Coaching',
}

const CATEGORY_ORDER = ['all', 'competition', 'online', 'posing', 'lifestyle', 'training']
const MIN_GALLERY_ITEMS = 18
const DESKTOP_SIZE_PX = { hero: 100, lg: 88, md: 74, sm: 62 }
const MOBILE_SIZE_PX = { hero: 82, lg: 72, md: 62, sm: 54 }

const REAL_RESULT_DETAILS = {
  1: {
    name: 'ANB champion with stage-ready control',
    location: 'Competition Preparation',
    duration: '16 Weeks',
    summary: 'A full prep result built around tighter presentation, clearer conditioning, and confidence when it mattered.',
    testimonial: {
      quote: 'Jake kept every part of prep organised, from the training adjustments to the stage details. I knew exactly what we were chasing each week.',
      author: 'ANB Champion',
      service: 'Competition Preparation',
      result: 'Gold Medal Stage Result',
    },
    stats: [
      { label: 'Service', value: 'Prep' },
      { label: 'Outcome', value: 'Gold', trend: 'up' },
      { label: 'Focus', value: 'Stage' },
    ],
  },
  2: {
    name: 'Stage ready in the bodybuilding division',
    location: 'Contest Prep',
    duration: '20 Weeks',
    summary: 'Conditioning, posing, and peak-week decisions brought together into one calm, executable show-day plan.',
    testimonial: {
      quote: 'I had competed before, but this was the first time the final weeks felt controlled instead of chaotic.',
      author: 'Returning Competitor',
      service: 'Competition Preparation',
      result: 'Best Conditioning Yet',
    },
    stats: [
      { label: 'Division', value: 'Bodybuilding' },
      { label: 'Prep', value: 'Complete', trend: 'up' },
      { label: 'Focus', value: 'Peak Week' },
    ],
  },
  3: {
    name: 'Peak conditioning with sharper stage presence',
    location: 'Competition Preparation',
    duration: '18 Weeks',
    summary: 'A detail-led contest prep result focused on holding shape, tightening the final look, and presenting clearly.',
    testimonial: {
      quote: 'The difference was the detail. Nothing felt random, and every change had a reason behind it.',
      author: 'Contest Prep Client',
      service: 'Competition Preparation',
      result: 'Peak Conditioning',
    },
    stats: [
      { label: 'Focus', value: 'Condition' },
      { label: 'Support', value: 'Weekly' },
      { label: 'Result', value: 'Sharper', trend: 'up' },
    ],
  },
  4: {
    name: 'Presentation that translated under lights',
    location: 'Posing Coaching',
    duration: '8 Weeks',
    summary: 'A posing-focused result built around angles, transitions, breathing, and making the physique read from the judging table.',
    testimonial: {
      quote: 'Jake helped me understand how to show my strengths instead of just hitting poses. That changed everything.',
      author: 'Posing Client',
      service: 'Posing',
      result: 'Stage Presence Transformation',
    },
    stats: [
      { label: 'Service', value: 'Posing' },
      { label: 'Focus', value: 'Angles' },
      { label: 'Confidence', value: 'Higher', trend: 'up' },
    ],
  },
  5: {
    name: 'Best shape brought into show condition',
    location: 'Competition Preparation',
    duration: '20 Weeks',
    summary: 'A complete prep pathway balancing structure, accountability, and the final details needed for a polished stage look.',
    testimonial: {
      quote: 'Jake treated my goal like it mattered. The accountability was firm, but it always felt personal.',
      author: 'Comp Prep Client',
      service: 'Competition Preparation',
      result: 'Best Shape Yet',
    },
    stats: [
      { label: 'Program', value: 'Full Prep' },
      { label: 'Check-ins', value: 'Weekly' },
      { label: 'Shape', value: 'Best', trend: 'up' },
    ],
  },
  6: {
    name: 'Mandatory posing with better control',
    location: 'Posing Coaching',
    duration: '6 Weeks',
    summary: 'A presentation result focused on cleaner transitions, stronger abdominal control, and confident mandatory poses.',
    testimonial: {
      quote: 'The posing work made me look more composed and more prepared. I stopped rushing and started owning the routine.',
      author: 'Presentation Client',
      service: 'Posing',
      result: 'Routine Confidence',
    },
    stats: [
      { label: 'Service', value: 'Posing' },
      { label: 'Focus', value: 'Control' },
      { label: 'Stage', value: 'Cleaner', trend: 'up' },
    ],
  },
}

// Temporary royalty-free fallback images until Jake supplies enough Dropbox assets.
const FALLBACK_RESULTS = [
  {
    id: 'fallback-online-1',
    src: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete training with a barbell in a gym',
    caption: 'Remote Structure - Training Block',
    category: 'online',
    name: 'Remote structure that keeps momentum',
    location: 'Online Coaching',
    summary: 'Programming, nutrition targets, and check-ins shaped around a real schedule rather than a generic template.',
    testimonial: {
      quote: 'The plan finally felt like it was built around my week, not someone else\'s template.',
      author: 'Online Coaching Client',
      service: 'Online Coaching',
      result: 'Consistent Training Rhythm',
    },
    stats: [
      { label: 'Check-ins', value: 'Weekly', trend: 'up' },
      { label: 'Support', value: 'Online' },
    ],
  },
  {
    id: 'fallback-training-1',
    src: 'https://images.unsplash.com/photo-1571019613914-85f342c6a11e?auto=format&fit=crop&w=900&q=80',
    alt: 'Coach assisting a client with strength training',
    caption: 'Private Coaching - Technique First',
    category: 'training',
    name: 'Hands-on coaching for cleaner movement',
    location: 'Melbourne',
    summary: 'A private coaching pathway focused on immediate feedback, better loading patterns, and cleaner execution.',
    testimonial: {
      quote: 'Small technical changes made every session feel more confident and controlled.',
      author: 'Private Coaching Client',
      service: 'Personal Training',
      result: 'Better Movement Quality',
    },
    stats: [
      { label: 'Format', value: '1:1' },
      { label: 'Focus', value: 'Technique', trend: 'up' },
    ],
  },
  {
    id: 'fallback-lifestyle-1',
    src: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete stretching after a training session',
    caption: 'Lifestyle - Sustainable Training',
    category: 'lifestyle',
    name: 'A routine that fits real life',
    location: 'Lifestyle Coaching',
    summary: 'A sustainable coaching result centred on habits, structure, and consistency outside of a competition timeline.',
    testimonial: {
      quote: 'The biggest shift was having structure that did not collapse as soon as life got busy.',
      author: 'Lifestyle Client',
      service: 'Lifestyle Coaching',
      result: 'Sustainable Routine',
    },
    stats: [
      { label: 'Routine', value: 'Stable', trend: 'up' },
      { label: 'Focus', value: 'Habits' },
    ],
  },
  {
    id: 'fallback-posing-1',
    src: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete standing under dramatic gym lighting',
    caption: 'Presentation - Confidence Under Lights',
    category: 'posing',
    name: 'Presentation that reads clearly',
    location: 'Stage Skills',
    summary: 'A posing-focused result built around calm transitions, stronger lines, and confidence under bright lights.',
    testimonial: {
      quote: 'Learning how to present the physique changed how confident I felt under pressure.',
      author: 'Posing Client',
      service: 'Posing',
      result: 'Stage Confidence',
    },
    stats: [
      { label: 'Focus', value: 'Stage' },
      { label: 'Presence', value: 'Sharper', trend: 'up' },
    ],
  },
  {
    id: 'fallback-competition-1',
    src: 'https://images.unsplash.com/photo-1549476464-37392f717541?auto=format&fit=crop&w=900&q=80',
    alt: 'Bodybuilder training in a focused gym environment',
    caption: 'Contest Prep - Detail Driven',
    category: 'competition',
    name: 'Prep decisions with a clear standard',
    location: 'Contest Prep',
    summary: 'A prep result built on clear decision-making, accountability, and sharper execution as show day approaches.',
    testimonial: {
      quote: 'Having a coach watch the details took the guesswork out of the hardest weeks.',
      author: 'Contest Prep Client',
      service: 'Competition Preparation',
      result: 'More Confident Prep',
    },
    stats: [
      { label: 'Service', value: 'Prep' },
      { label: 'Standard', value: 'Clear', trend: 'up' },
    ],
  },
  {
    id: 'fallback-online-2',
    src: 'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete training with dumbbells in a gym',
    caption: 'Online Coaching - Progressive Plan',
    category: 'online',
    name: 'Progress you can actually track',
    location: 'Remote Coaching',
    summary: 'Online coaching that turns training, nutrition, and accountability into visible weekly progress.',
    testimonial: {
      quote: 'The check-ins made progress obvious, even when the week felt messy.',
      author: 'Remote Client',
      service: 'Online Coaching',
      result: 'Better Accountability',
    },
    stats: [
      { label: 'Check-ins', value: 'Weekly' },
      { label: 'Progress', value: 'Tracked', trend: 'up' },
    ],
  },
  {
    id: 'fallback-training-2',
    src: 'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete performing a controlled strength movement',
    caption: 'Private Coaching - Stronger Sessions',
    category: 'training',
    name: 'In-person feedback that lands fast',
    location: 'Private Coaching',
    summary: 'Direct coaching for clients who want better movement, stronger sessions, and faster technical correction.',
    testimonial: {
      quote: 'The immediate feedback helped me understand what good reps should feel like.',
      author: 'Training Client',
      service: 'Personal Training',
      result: 'Stronger Sessions',
    },
    stats: [
      { label: 'Format', value: '1:1' },
      { label: 'Feedback', value: 'Direct', trend: 'up' },
    ],
  },
  {
    id: 'fallback-lifestyle-2',
    src: 'https://images.unsplash.com/photo-1554344728-77cf90d9ed26?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete preparing for a workout with gym equipment nearby',
    caption: 'Lifestyle - Repeatable Habits',
    category: 'lifestyle',
    name: 'Habits that carry the physique',
    location: 'Lifestyle Coaching',
    summary: 'A lifestyle coaching result focused on making training and nutrition repeatable without all-or-nothing swings.',
    testimonial: {
      quote: 'The structure made training and nutrition feel repeatable instead of all-or-nothing.',
      author: 'Lifestyle Client',
      service: 'Lifestyle Coaching',
      result: 'Repeatable Habits',
    },
    stats: [
      { label: 'Habits', value: 'Built', trend: 'up' },
      { label: 'Support', value: 'Flexible' },
    ],
  },
  {
    id: 'fallback-posing-2',
    src: 'https://images.unsplash.com/photo-1599058917765-a780eda07a3e?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete posing in a gym mirror',
    caption: 'Posing - Better Angles',
    category: 'posing',
    name: 'Sharper angles and transitions',
    location: 'Posing Coaching',
    summary: 'Presentation work focused on better angles, more confident transitions, and a stronger stage rhythm.',
    testimonial: {
      quote: 'The difference was learning how to show what I had already built.',
      author: 'Presentation Client',
      service: 'Posing',
      result: 'Sharper Presence',
    },
    stats: [
      { label: 'Angles', value: 'Sharper', trend: 'up' },
      { label: 'Routine', value: 'Cleaner' },
    ],
  },
  {
    id: 'fallback-competition-2',
    src: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete training intensely with gym lighting',
    caption: 'Contest Prep - Peak Focus',
    category: 'competition',
    name: 'A clearer path into show day',
    location: 'Competition Prep',
    summary: 'A contest prep result designed to keep the final phase purposeful, calm, and detail-driven.',
    testimonial: {
      quote: 'Every adjustment had a reason, which made prep feel calmer and more controlled.',
      author: 'Prep Client',
      service: 'Competition Preparation',
      result: 'Show Day Confidence',
    },
    stats: [
      { label: 'Phase', value: 'Peak' },
      { label: 'Readiness', value: 'Higher', trend: 'up' },
    ],
  },
  {
    id: 'fallback-online-3',
    src: 'https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete using battle ropes during conditioning',
    caption: 'Online Coaching - Flexible Accountability',
    category: 'online',
    name: 'Coaching that adapts to the week',
    location: 'Online Coaching',
    summary: 'Remote coaching that keeps structure intact when work, travel, or training availability changes.',
    testimonial: {
      quote: 'When my schedule changed, the plan changed with it instead of falling apart.',
      author: 'Online Client',
      service: 'Online Coaching',
      result: 'Flexible Consistency',
    },
    stats: [
      { label: 'Plan', value: 'Adaptive', trend: 'up' },
      { label: 'Support', value: 'Remote' },
    ],
  },
  {
    id: 'fallback-training-3',
    src: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete lifting in a strength gym',
    caption: 'Private Coaching - Load With Confidence',
    category: 'training',
    name: 'Confidence under load',
    location: 'Private Coaching',
    summary: 'In-person coaching that improves confidence, execution, and intent through every working set.',
    testimonial: {
      quote: 'I stopped second-guessing the lift because I finally knew what Jake wanted me to feel.',
      author: 'Private Coaching Client',
      service: 'Personal Training',
      result: 'Better Confidence',
    },
    stats: [
      { label: 'Format', value: '1:1' },
      { label: 'Confidence', value: 'Higher', trend: 'up' },
    ],
  },
  {
    id: 'fallback-lifestyle-3',
    src: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete warming up in a training studio',
    caption: 'Lifestyle - Better Training Rhythm',
    category: 'lifestyle',
    name: 'Training that fits the week',
    location: 'Lifestyle Coaching',
    summary: 'A lifestyle result focused on making sessions, meals, and recovery feel realistic enough to repeat.',
    testimonial: {
      quote: 'Jake helped me stop chasing perfect weeks and start building consistent ones.',
      author: 'Lifestyle Coaching Client',
      service: 'Lifestyle Coaching',
      result: 'Consistent Weekly Rhythm',
    },
    stats: [
      { label: 'Rhythm', value: 'Weekly', trend: 'up' },
      { label: 'Focus', value: 'Consistency' },
    ],
  },
  {
    id: 'fallback-competition-3',
    src: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete training back under dramatic gym lighting',
    caption: 'Contest Prep - Back Detail',
    category: 'competition',
    name: 'More detail where judging notices',
    location: 'Competition Preparation',
    summary: 'A contest prep result built around shape, condition, and making the back shots hold up under judging conditions.',
    testimonial: {
      quote: 'The feedback was specific enough that I knew exactly what needed to improve each week.',
      author: 'Physique Competitor',
      service: 'Competition Preparation',
      result: 'Improved Stage Detail',
    },
    stats: [
      { label: 'Focus', value: 'Detail' },
      { label: 'Condition', value: 'Sharper', trend: 'up' },
    ],
  },
  {
    id: 'fallback-online-4',
    src: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete training in a spacious gym',
    caption: 'Online Coaching - Structured Weeks',
    category: 'online',
    name: 'Structured weeks without guesswork',
    location: 'Online Coaching',
    summary: 'A remote coaching result where programming, accountability, and nutrition targets made the next step obvious.',
    testimonial: {
      quote: 'I always knew what the priority was, which made training easier to execute.',
      author: 'Online Coaching Client',
      service: 'Online Coaching',
      result: 'Clear Weekly Priorities',
    },
    stats: [
      { label: 'Plan', value: 'Clear', trend: 'up' },
      { label: 'Mode', value: 'Remote' },
    ],
  },
  {
    id: 'fallback-posing-3',
    src: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete holding a controlled gym pose',
    caption: 'Posing - Stronger Lines',
    category: 'posing',
    name: 'Cleaner lines and calmer transitions',
    location: 'Posing Coaching',
    summary: 'A posing result focused on slowing the routine down, finding better angles, and making each transition deliberate.',
    testimonial: {
      quote: 'I stopped feeling rushed once the routine had structure and the transitions made sense.',
      author: 'Posing Client',
      service: 'Posing',
      result: 'Cleaner Routine',
    },
    stats: [
      { label: 'Lines', value: 'Cleaner', trend: 'up' },
      { label: 'Focus', value: 'Routine' },
    ],
  },
  {
    id: 'fallback-training-4',
    src: 'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete preparing dumbbells before a working set',
    caption: 'Private Coaching - Better Execution',
    category: 'training',
    name: 'Better execution every set',
    location: 'Private Coaching',
    summary: 'A hands-on coaching result where in-person cues made training feel stronger, safer, and more deliberate.',
    testimonial: {
      quote: 'Having Jake there to correct the small things made every set feel more productive.',
      author: 'Private Coaching Client',
      service: 'Personal Training',
      result: 'Better Execution',
    },
    stats: [
      { label: 'Format', value: '1:1' },
      { label: 'Execution', value: 'Better', trend: 'up' },
    ],
  },
  {
    id: 'fallback-competition-4',
    src: 'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&w=900&q=80',
    alt: 'Athlete training shoulders in a gym',
    caption: 'Contest Prep - Complete Support',
    category: 'competition',
    name: 'Prep support from training to stage',
    location: 'Contest Prep',
    summary: 'A competition result shaped by training, nutrition, presentation, and the final details that bring prep together.',
    testimonial: {
      quote: 'The value was having one clear process instead of trying to piece everything together myself.',
      author: 'Competition Prep Client',
      service: 'Competition Preparation',
      result: 'Complete Prep Support',
    },
    stats: [
      { label: 'Support', value: 'Complete', trend: 'up' },
      { label: 'Service', value: 'Prep' },
    ],
  },
]

function honeycombLayout(count, spacing = 96) {
  if (count <= 0) return []

  const cells = [{ q: 0, r: 0, ring: 0 }]
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]

  for (let ring = 1; cells.length < count; ring += 1) {
    let q = -ring
    let r = ring

    for (let side = 0; side < 6; side += 1) {
      for (let step = 0; step < ring && cells.length < count; step += 1) {
        cells.push({ q, r, ring })
        q += dirs[side][0]
        r += dirs[side][1]
      }
    }
  }

  return cells.map(({ q, r, ring }, index) => ({
    x: spacing * (q + r / 2),
    y: spacing * 0.866 * r,
    ring,
    index,
  }))
}

function ringSize(ring, index) {
  if (index === 0) return 'hero'
  if (ring === 1) return 'lg'
  if (ring === 2) return 'md'
  return 'sm'
}

function resolveItemSrc(item, resolveAsset) {
  return item?.src ? resolveAsset(item.src) : ''
}

function displayTitle(item) {
  return item?.name || item?.caption || 'Team JD result'
}

function completeResultItem(item, index = 0) {
  const categoryLabel = CATEGORY_LABELS[item.category] || 'Coaching'
  const service = item.testimonial?.service || categoryLabel

  return {
    ...item,
    name: item.name || item.caption || `${categoryLabel} result`,
    location: item.location || service,
    summary: item.summary || `A Team JD ${categoryLabel.toLowerCase()} result built around clear structure, accountability, and a coaching plan matched to the client.`,
    testimonial: item.testimonial || {
      quote: 'The structure, feedback, and accountability made the process feel personal from the first check-in.',
      author: `${categoryLabel} Client`,
      service,
      result: 'Coaching Progress',
    },
    stats: Array.isArray(item.stats) && item.stats.length > 0
      ? item.stats
      : [
          { label: 'Service', value: categoryLabel },
          { label: 'Support', value: index % 2 === 0 ? 'Weekly' : 'Personal' },
          { label: 'Result', value: 'Progress', trend: 'up' },
        ],
  }
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function TrendIcon({ trend }) {
  if (!trend) return null

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {trend === 'down' ? (
        <>
          <path d="M12 5v14" />
          <path d="m6 13 6 6 6-6" />
        </>
      ) : (
        <>
          <path d="M12 19V5" />
          <path d="m6 11 6-6 6 6" />
        </>
      )}
    </svg>
  )
}

function StoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 5.75A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.4 17.4 0 0 1-2.4 3.1" />
      <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" />
      <path d="M6.6 6.6C4.1 8.35 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.8 9.8 0 0 0 4.8-1.3" />
      <path d="m3 3 18 18" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2.5-6 5 12 2.5-6H21" />
    </svg>
  )
}

// Pick a footer icon for a result stat. Explicit `stat.icon` wins, then an
// upward/downward trend, then a light keyword inference, falling back to a dot.
function StatIcon({ stat }) {
  if (stat.trend) return <TrendIcon trend={stat.trend} />

  const key = stat.icon || `${stat.label || ''} ${stat.value || ''}`.toLowerCase()

  if (/calendar|program|prep|phase|cycle|plan|week|division|format|service|mode/.test(key)) {
    return <CalendarIcon />
  }
  if (/check|support|accountab/.test(key)) {
    return <CheckCircleIcon />
  }
  if (/confiden|presence|execution|movement|feedback|habit|rhythm|consist|pulse/.test(key)) {
    return <PulseIcon />
  }
  if (/focus|standard|detail|angle|line|routine|target|readiness|priorit/.test(key)) {
    return <TargetIcon />
  }
  return <CheckCircleIcon />
}

function WatchGridItem({ item, src, size, left, top, sizePx, isActive, shouldReduce, index, onClick }) {
  return (
    <motion.button
      type="button"
      className={`watch-grid-item watch-grid-item--${size} ${isActive ? 'active' : ''}`}
      data-category={item.category}
      onClick={() => onClick(item)}
      aria-label={`Open result: ${displayTitle(item)}`}
      aria-pressed={isActive}
      style={{ left: `${left - sizePx / 2}px`, top: `${top - sizePx / 2}px`, width: sizePx, height: sizePx }}
      initial={shouldReduce ? false : { opacity: 0, scale: 0.48 }}
      animate={shouldReduce ? {} : { opacity: 1, scale: 1 }}
      exit={shouldReduce ? {} : { opacity: 0, scale: 0.58 }}
      transition={{ duration: 0.34, ease: 'easeOut', delay: Math.min(index * 0.025, 0.25) }}
      whileHover={shouldReduce ? {} : { scale: 1.1 }}
      whileTap={shouldReduce ? {} : { scale: 0.96 }}
    >
      <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
    </motion.button>
  )
}

function ResultOverlayBody({ item, titleId }) {
  const title = displayTitle(item)

  return (
    <div className="result-overlay-body">
      <h3 id={titleId} className="result-detail-title">{title}</h3>

      {item.location && (
        <div className="result-detail-location">
          <PinIcon />
          <span>{item.location}</span>
          {item.duration && <span className="result-detail-meta-sep">{item.duration}</span>}
        </div>
      )}

      {item.summary && (
        <p className="result-detail-summary">{item.summary}</p>
      )}

      {item.testimonial && (
        <figure className="result-detail-testimonial" data-category={item.category}>
          <span className="result-detail-quote-mark" aria-hidden="true">&ldquo;</span>
          <blockquote>{item.testimonial.quote}</blockquote>
          <figcaption>
            <strong>{item.testimonial.author}</strong>
            {item.testimonial.result && ` · ${item.testimonial.result}`}
          </figcaption>
        </figure>
      )}
    </div>
  )
}

function ResultOverlayFooter({ stats }) {
  if (!Array.isArray(stats) || stats.length === 0) return null

  return (
    <div className="result-overlay-footer" aria-label="Result attributes">
      {stats.map((stat, index) => (
        <div
          className="result-footer-stat"
          key={`${stat.label}-${index}`}
          data-trend={stat.trend || undefined}
        >
          <span className="result-footer-icon">
            <StatIcon stat={stat} />
          </span>
          <span className="result-footer-text">
            <span className="result-footer-value">{stat.value}</span>
            <span className="result-footer-label">{stat.label}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function ResultPreview({ item, src, open, onClose, onReopen, previewRef }) {
  const shouldReduce = useReducedMotion()
  if (!item) return null

  const titleId = `result-preview-title-${item.id}`

  const overlayMotion = shouldReduce
    ? { initial: false, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 18 },
        transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      }

  return (
    <section
      className="result-preview"
      aria-label={`Selected result: ${displayTitle(item)}`}
      ref={previewRef}
    >
      <div className="result-preview-media">
        <AnimatePresence initial={false}>
          <motion.img
            key={item.id}
            className="result-preview-img"
            src={src}
            alt={item.alt}
            loading="eager"
            decoding="async"
            draggable={false}
            initial={shouldReduce ? false : { opacity: 0, scale: 1.05 }}
            animate={shouldReduce ? {} : { opacity: 1, scale: 1 }}
            exit={shouldReduce ? {} : { opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            className="result-preview-scrim"
            aria-hidden="true"
            initial={shouldReduce ? false : { opacity: 0 }}
            animate={shouldReduce ? {} : { opacity: 1 }}
            exit={shouldReduce ? {} : { opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            className="result-preview-overlay"
            role="group"
            aria-labelledby={titleId}
            {...overlayMotion}
          >
            <div className="result-overlay-glass" aria-hidden="true" />

            <div className="result-overlay-header">
              <span className="result-detail-badge" data-category={item.category}>
                {CATEGORY_LABELS[item.category] || item.category}
              </span>
              <button
                type="button"
                className="result-preview-close"
                aria-label="Dismiss result details"
                onClick={onClose}
              >
                &times;
              </button>
            </div>

            <div className="result-overlay-scroll">
              <ResultOverlayBody item={item} titleId={titleId} />
            </div>

            <ResultOverlayFooter stats={item.stats} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!open && (
          <motion.button
            key="reopen"
            type="button"
            className="result-preview-reopen"
            onClick={onReopen}
            initial={shouldReduce ? false : { opacity: 0, y: 10 }}
            animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
            exit={shouldReduce ? {} : { opacity: 0, y: 10 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <StoryIcon />
            Show Story
          </motion.button>
        )}
      </AnimatePresence>
    </section>
  )
}

function ResultModal({ item, src, open, onClose }) {
  const shouldReduce = useReducedMotion()
  const [detailsOpen, setDetailsOpen] = useState(true)

  useEffect(() => {
    if (item?.id) setDetailsOpen(true)
  }, [item?.id])

  if (!open || !item) return null

  const titleId = `result-modal-title-${item.id}`

  const backdropMotion = shouldReduce
    ? { initial: false, animate: {}, exit: {} }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.24, ease: 'easeOut' },
      }

  const dialogMotion = shouldReduce
    ? { initial: false, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, y: 28, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 18, scale: 0.98 },
        transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      }

  return (
    <motion.div
      className="result-modal-backdrop"
      onClick={onClose}
      {...backdropMotion}
    >
      <motion.section
        className="result-modal-dialog result-preview result-preview--modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        {...dialogMotion}
      >
        <div className="result-preview-media">
          <motion.img
            key={item.id}
            className="result-preview-img"
            src={src}
            alt={item.alt}
            loading="eager"
            decoding="async"
            draggable={false}
            initial={shouldReduce ? false : { opacity: 0, scale: 1.04 }}
            animate={shouldReduce ? {} : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        </div>

        <AnimatePresence>
          {detailsOpen && (
            <motion.div
              key="modal-scrim"
              className="result-preview-scrim"
              aria-hidden="true"
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={shouldReduce ? {} : { opacity: 1 }}
              exit={shouldReduce ? {} : { opacity: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        <button
          type="button"
          className="result-preview-close"
          aria-label="Close result details"
          onClick={onClose}
        >
          &times;
        </button>

        <AnimatePresence>
          {detailsOpen && (
            <motion.div
              key="modal-overlay"
              className="result-preview-overlay"
              role="document"
              aria-labelledby={titleId}
              initial={shouldReduce ? false : { opacity: 0, y: 18 }}
              animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
              exit={shouldReduce ? {} : { opacity: 0, y: 18 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <div className="result-overlay-glass" aria-hidden="true" />

              <div className="result-overlay-header">
                <span className="result-detail-badge" data-category={item.category}>
                  {CATEGORY_LABELS[item.category] || item.category}
                </span>
                <button
                  type="button"
                  className="result-preview-hide"
                  aria-label="Hide result details"
                  onClick={() => setDetailsOpen(false)}
                >
                  <EyeOffIcon />
                  <span>Hide</span>
                </button>
              </div>

              <div className="result-overlay-scroll">
                <ResultOverlayBody item={item} titleId={titleId} />
              </div>

              <ResultOverlayFooter stats={item.stats} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!detailsOpen && (
            <motion.button
              key="modal-reopen"
              type="button"
              className="result-preview-reopen result-preview-reopen--modal"
              aria-label="Show result details"
              onClick={() => setDetailsOpen(true)}
              initial={shouldReduce ? false : { opacity: 0, y: 10 }}
              animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
              exit={shouldReduce ? {} : { opacity: 0, y: 10 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
            >
              <EyeIcon />
              Show
            </motion.button>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  )
}

export default function AppleWatchGallery() {
  const { data: results } = useJSON('/content/results.json')
  const { data: testimonials } = useJSON('/content/testimonials.json')
  const resolveAsset = useAssets()
  const shouldReduce = useReducedMotion()
  const viewportRef = useRef(null)
  const previewRef = useRef(null)
  const canvasX = useMotionValue(0)
  const canvasY = useMotionValue(0)

  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedItem, setSelectedItem] = useState(null)
  const [overlayOpen, setOverlayOpen] = useState(true)
  const [mobileModalOpen, setMobileModalOpen] = useState(false)
  const [isPhoneResultsLayout, setIsPhoneResultsLayout] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 768px)').matches
      : false
  ))
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })

  const enrichedItems = useMemo(() => {
    const sourceResults = results || []
    const serviceToCategory = {
      'Competition Preparation': 'competition',
      'Online Coaching': 'online',
      'Personal Training': 'training',
      Posing: 'posing',
      'Posing Only': 'posing',
      'Lifestyle Coaching': 'lifestyle',
    }

    const testimonialsByCategory = {}
    ;(testimonials || []).forEach((testimonial) => {
      const category = serviceToCategory[testimonial.service] || 'lifestyle'
      if (!testimonialsByCategory[category]) testimonialsByCategory[category] = []
      testimonialsByCategory[category].push(testimonial)
    })

    const usedTestimonials = new Set()
    const realItems = sourceResults.map((result) => {
      const detail = REAL_RESULT_DETAILS[result.id] || {}
      const pool = testimonialsByCategory[result.category] || []
      const testimonial = pool.find((entry) => !usedTestimonials.has(entry.id)) || null
      if (testimonial) usedTestimonials.add(testimonial.id)

      return completeResultItem({
        ...result,
        ...detail,
        id: `real-${result.id}`,
        testimonial: detail.testimonial || testimonial,
      }, result.id)
    })

    const fallbackNeeded = Math.max(0, MIN_GALLERY_ITEMS - realItems.length)
    return [...realItems, ...FALLBACK_RESULTS.slice(0, fallbackNeeded)].map(completeResultItem)
  }, [results, testimonials])

  const categories = useMemo(() => {
    const available = new Set(enrichedItems.map((item) => item.category))
    return CATEGORY_ORDER.filter((category) => category === 'all' || available.has(category))
  }, [enrichedItems])

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return enrichedItems
    return enrichedItems.filter((item) => item.category === activeFilter)
  }, [activeFilter, enrichedItems])

  const sizeMap = viewportSize.w > 0 && viewportSize.w <= 480 ? MOBILE_SIZE_PX : DESKTOP_SIZE_PX

  const canvas = useMemo(() => {
    const spacing = viewportSize.w > 0 && viewportSize.w <= 480 ? 78 : 104
    const rawPositions = honeycombLayout(filteredItems.length, spacing)

    if (rawPositions.length === 0) {
      return { positions: [], width: 0, height: 0 }
    }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    rawPositions.forEach((position, index) => {
      const size = ringSize(position.ring, index)
      const half = sizeMap[size] / 2
      minX = Math.min(minX, position.x - half)
      maxX = Math.max(maxX, position.x + half)
      minY = Math.min(minY, position.y - half)
      maxY = Math.max(maxY, position.y + half)
    })

    const pad = viewportSize.w > 0 && viewportSize.w <= 480 ? 34 : 58
    const clusterWidth = maxX - minX
    const clusterHeight = maxY - minY
    const shouldExplore = filteredItems.length > 8
    const panSlackX = shouldExplore && viewportSize.w ? Math.min(260, Math.max(120, viewportSize.w * 0.16)) : 0
    const panSlackY = shouldExplore && viewportSize.h ? Math.min(200, Math.max(100, viewportSize.h * 0.15)) : 0
    const width = Math.max(clusterWidth + pad * 2, viewportSize.w ? viewportSize.w + panSlackX : clusterWidth + pad * 2)
    const height = Math.max(clusterHeight + pad * 2, viewportSize.h ? viewportSize.h + panSlackY : clusterHeight + pad * 2)
    const offsetX = (width - clusterWidth) / 2 - minX
    const offsetY = (height - clusterHeight) / 2 - minY
    const positions = rawPositions.map((position) => ({
      ...position,
      x: position.x + offsetX,
      y: position.y + offsetY,
    }))

    return { positions, width, height }
  }, [filteredItems.length, sizeMap, viewportSize.h, viewportSize.w])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return undefined

    const update = () => setViewportSize({ w: el.clientWidth, h: el.clientHeight })
    update()

    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const query = window.matchMedia('(max-width: 768px)')
    const update = () => setIsPhoneResultsLayout(query.matches)
    update()

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    }

    query.addListener(update)
    return () => query.removeListener(update)
  }, [])

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedItem(null)
      return
    }

    if (!selectedItem || !filteredItems.some((item) => item.id === selectedItem.id)) {
      setSelectedItem(filteredItems[0])
    }
  }, [filteredItems, selectedItem])

  // Re-open the overlay whenever the selected result changes.
  useEffect(() => {
    if (selectedItem?.id) setOverlayOpen(true)
  }, [selectedItem?.id])

  useEffect(() => {
    if (!isPhoneResultsLayout) setMobileModalOpen(false)
  }, [isPhoneResultsLayout])

  useEffect(() => {
    if (!isPhoneResultsLayout || !mobileModalOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMobileModalOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPhoneResultsLayout, mobileModalOpen])

  useEffect(() => {
    const el = viewportRef.current
    if (!el || !shouldReduce) return
    el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
    el.scrollTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2)
  }, [activeFilter, canvas.height, canvas.width, shouldReduce])

  const slackX = Math.max(0, (canvas.width - viewportSize.w) / 2)
  const slackY = Math.max(0, (canvas.height - viewportSize.h) / 2)
  const canPan = !shouldReduce && (slackX > 1 || slackY > 1)
  const dragConstraints = { left: -slackX, right: slackX, top: -slackY, bottom: slackY }

  useEffect(() => {
    if (shouldReduce) return
    canvasX.set(-slackX)
    canvasY.set(-slackY)
  }, [activeFilter, canvas.height, canvas.width, canvasX, canvasY, shouldReduce, slackX, slackY])

  // The draggable canvas sets `touch-action: none`, which makes trackpad/wheel
  // gestures over the frame stop scrolling the page. Forward wheel deltas to the
  // window so the user is never trapped inside the honeycomb while scrolling.
  useEffect(() => {
    const el = viewportRef.current
    if (!el || !canPan) return undefined
    const handleWheel = (event) => {
      window.scrollBy({ top: event.deltaY, left: 0, behavior: 'instant' })
    }
    el.addEventListener('wheel', handleWheel, { passive: true })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [canPan])

  const handleFilterChange = useCallback((filter) => {
    setActiveFilter(filter)
  }, [])

  const handleOpen = useCallback((item) => {
    setSelectedItem(item)
    setOverlayOpen(true)
    if (isPhoneResultsLayout) {
      setMobileModalOpen(true)
      return
    }

    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches) {
      previewRef.current?.scrollIntoView({
        behavior: shouldReduce ? 'auto' : 'smooth',
        block: 'nearest',
      })
    }
  }, [isPhoneResultsLayout, shouldReduce])

  const previewSrc = selectedItem ? resolveItemSrc(selectedItem, resolveAsset) : ''

  return (
    <>
      <section
        className="section home-section results-gallery-section"
        aria-labelledby="results-heading"
      >
        <div className="container">
          <SectionReveal>
            <div className="results-header">
              <span className="eyebrow">Real Results</span>
              <h2 id="results-heading">
                Clients<br />Who Showed Up.
              </h2>
              <p>
                Browse the proof in motion. Tap a client to inspect the result, the story,
                and the kind of coaching behind it.
              </p>
            </div>
          </SectionReveal>

          <div className="results-filter-bar" aria-label="Filter results by service">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`results-filter-pill ${activeFilter === category ? 'active' : ''}`}
                onClick={() => handleFilterChange(category)}
                aria-pressed={activeFilter === category}
              >
                {category === 'all' ? 'All Results' : CATEGORY_LABELS[category] || category}
              </button>
            ))}
          </div>

          <div className="results-gallery-grid">
            <div className="results-browser">
              <div
                className={`watch-grid-viewport ${shouldReduce ? 'watch-grid-viewport--scroll' : ''} ${canPan ? 'watch-grid-viewport--pannable' : ''}`}
                ref={viewportRef}
              >
                {filteredItems.length > 0 ? (
                  <motion.div
                    key={activeFilter}
                    className="watch-grid-canvas"
                    style={shouldReduce ? { width: canvas.width, height: canvas.height } : { width: canvas.width, height: canvas.height, x: canvasX, y: canvasY }}
                    drag={canPan}
                    dragConstraints={dragConstraints}
                    dragElastic={0.08}
                    dragMomentum={false}
                    initial={shouldReduce ? false : { opacity: 0, scale: 0.98 }}
                    animate={shouldReduce ? {} : { opacity: 1, scale: 1 }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                  >
                    <AnimatePresence>
                      {filteredItems.map((item, index) => {
                        const position = canvas.positions[index]
                        const size = ringSize(position.ring, index)

                        return (
                          <WatchGridItem
                            key={item.id}
                            item={item}
                            src={resolveItemSrc(item, resolveAsset)}
                            size={size}
                            left={position.x}
                            top={position.y}
                            sizePx={sizeMap[size]}
                            isActive={selectedItem?.id === item.id}
                            shouldReduce={shouldReduce}
                            index={index}
                            onClick={handleOpen}
                          />
                        )
                      })}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <p className="watch-grid-empty">No results in this category yet.</p>
                )}
              </div>
            </div>

            {selectedItem && !isPhoneResultsLayout && (
              <ResultPreview
                item={selectedItem}
                src={previewSrc}
                open={overlayOpen}
                onClose={() => setOverlayOpen(false)}
                onReopen={() => setOverlayOpen(true)}
                previewRef={previewRef}
              />
            )}
          </div>

          <div className="results-cta-wrap">
            <Link to="/results" className="btn btn-outline">
              View All Results &rarr;
            </Link>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selectedItem && isPhoneResultsLayout && mobileModalOpen && (
          <ResultModal
            key={selectedItem.id}
            item={selectedItem}
            src={previewSrc}
            open={mobileModalOpen}
            onClose={() => setMobileModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

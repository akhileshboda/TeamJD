import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const motionState = { allowed: false }
const smoothScroll = vi.fn()

vi.mock('../motion/useLandingMotion', () => ({
  useMotionAllowed: () => motionState.allowed,
  useSmoothScroll: (enabled) => smoothScroll(enabled),
  useRefreshOnSettle: () => {},
}))

const SERVICES = [
  { id: 'competition-prep', name: 'Competition Preparation', slug: 'competition-preparation', hero_image: 'jake-stage' },
  { id: 'online-coaching', name: 'Online Coaching', slug: 'online-coaching', hero_image: 'service-online-coaching' },
  { id: 'personal-training', name: 'Personal Training', slug: 'personal-training', hero_image: 'service-personal-training' },
  { id: 'posing-only', name: 'Posing', slug: 'posing-only', hero_image: 'service-posing' },
]
const FAQS = [
  { id: 'faq-1', question: 'Who is Team JD coaching for?', answer: 'Anyone serious about results.' },
  { id: 'faq-2', question: 'How do I get started?', answer: 'Use Find Your Fit.' },
]

vi.mock('../hooks/useContent', () => ({
  useContent: (collection) => ({
    data: { services: SERVICES, faqs: FAQS, results: [] }[collection] ?? null,
    loading: false,
    error: null,
  }),
  isPreviewWindow: () => false,
}))

vi.mock('../hooks/useAssets', () => ({
  useMedia: () => (slotId, fallbackPath, fallbackAlt = '') => ({
    slotId,
    src: `/api/assets/${String(fallbackPath).replace('/api/assets/', '')}`,
    alt: fallbackAlt,
    ready: true,
    replaced: false,
  }),
  framedBackgroundPosition: () => undefined,
  framedImageStyle: () => undefined,
}))

vi.mock('../hooks/usePageMeta', () => ({ usePageMeta: () => {} }))

// The results gallery has its own suite; here it only needs to be present.
vi.mock('../components/AppleWatchGallery', () => ({
  default: () => <section aria-label="Results gallery stub" />,
}))

import Home from './Home'
import { MotionPreferenceProvider, MOTION_STORAGE_KEY } from '../motion/MotionPreference'

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <MotionPreferenceProvider>
        <Home />
      </MotionPreferenceProvider>
    </MemoryRouter>,
  )
}

// Motion's in-view reveals (FAQ items, the final call to action) need an observer.
beforeAll(() => {
  window.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
})

describe('landing page', () => {
  afterEach(cleanup)

  beforeEach(() => {
    motionState.allowed = false
    smoothScroll.mockClear()
  })

  it('renders the hero headline and calls to action', () => {
    renderHome()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/unlock your\s*true potential/i)
    const hero = screen.getByRole('region', { name: 'Hero' })
    expect(within(hero).getByRole('link', { name: 'Find Your Fit' })).toBeInTheDocument()
    expect(within(hero).getByRole('link', { name: 'View Services' })).toHaveAttribute('href', '/services')
    expect(hero).toHaveAttribute('data-cms-section', 'home.hero-video')
  })

  it('renders every section heading', () => {
    renderHome()
    for (const name of [
      /find the coaching that fits your next move/i,
      /bring jake the goal/i,
      /i'm jake/i,
      /got questions/i,
    ]) {
      expect(screen.getAllByRole('heading', { name }).length).toBeGreaterThan(0)
    }
  })

  it('keeps each coaching pathway linked, tracked and editable', () => {
    renderHome()
    const expected = [
      ['competition-prep', 'competition-preparation', 'Getting stage-ready: explore Competition Preparation'],
      ['online-coaching', 'online-coaching', 'Building structure online: explore Online Coaching'],
      ['personal-training', 'personal-training', 'Training in person: explore Personal Training'],
      ['posing-only', 'posing-only', 'Sharpening presentation: explore Posing'],
    ]
    for (const [id, slug, label] of expected) {
      const link = screen.getByRole('link', { name: label })
      expect(link).toHaveAttribute('href', `/services/${slug}`)
      expect(link).toHaveAttribute('data-analytics-event', 'service_discovery')
      expect(link).toHaveAttribute('data-analytics-location', 'home_service_pathways')
      expect(link).toHaveAttribute('data-analytics-id', id)
      expect(link).toHaveAttribute('data-cms-section', `services.${slug}.hero`)
    }
  })

  it('shows the credentials once to assistive technology', () => {
    renderHome()
    const band = screen.getByRole('region', { name: 'Credentials' })
    // The looping copy of the band is aria-hidden, so it is not counted here.
    const items = within(band).getAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items[0]).toHaveTextContent('Pro Physique Competitor')
  })

  it('keeps the dashboard hooks on the about photo and FAQs', () => {
    const { container } = renderHome()
    expect(screen.getByRole('img', { name: /Jake Dedert/ })).toHaveAttribute('data-cms-section', 'home.about-photo')
    expect(container.querySelector('[data-cms-section="faqs"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Who is Team JD coaching for?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'How do I get started?' })).toBeInTheDocument()
  })

  it('keeps the final call to action and its analytics', () => {
    const { container } = renderHome()
    const finalLinks = container.querySelectorAll('.lp-final [data-analytics-event="final_cta_click"]')
    expect([...finalLinks].map((link) => link.getAttribute('data-analytics-id'))).toEqual([
      'explore_services',
      'find_your_fit',
    ])
  })

  it('with motion reduced, starts no smooth scrolling and hides nothing', () => {
    window.localStorage.setItem(MOTION_STORAGE_KEY, 'reduce')
    const { container } = renderHome()
    expect(smoothScroll).toHaveBeenCalledWith(false)
    expect(container.querySelector('.lp')).not.toHaveAttribute('data-lp-motion')
    const hidden = [...container.querySelectorAll('.lp *')].filter(
      (el) => el.style.opacity === '0' || el.style.visibility === 'hidden',
    )
    expect(hidden).toHaveLength(0)
    window.localStorage.removeItem(MOTION_STORAGE_KEY)
  })

  it('with motion allowed, asks for smooth scrolling', () => {
    motionState.allowed = true
    renderHome()
    expect(smoothScroll).toHaveBeenCalledWith(true)
  })
})

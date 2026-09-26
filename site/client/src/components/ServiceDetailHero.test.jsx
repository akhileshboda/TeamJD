import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import services from '../../../public/content/services.json'
import ServiceDetailHero from './ServiceDetailHero'
import {
  FIND_YOUR_FIT_SESSION_KEY,
  FIND_YOUR_FIT_SESSION_VERSION,
  FindYourFitSessionProvider,
} from '../context/FindYourFitSession'

const prepService = services.find((service) => service.slug === 'competition-preparation')
const bookableService = services.find((service) => service.slug === 'online-coaching')

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
})

function seedQualifyingResult() {
  window.sessionStorage.setItem(FIND_YOUR_FIT_SESSION_KEY, JSON.stringify({
    version: FIND_YOUR_FIT_SESSION_VERSION,
    competitionPrepPageBypass: false,
    outcome: {
      status: 'recommended',
      recommendationSlug: prepService.slug,
      qualifiesSlug: prepService.slug,
      reason: 'Competition Preparation is the match.',
      evidence: [],
    },
  }))
}

function renderHero(service) {
  return render(
    <MemoryRouter initialEntries={[`/services/${service.slug}`]}>
      <FindYourFitSessionProvider>
        <ServiceDetailHero service={service} services={services} />
      </FindYourFitSessionProvider>
    </MemoryRouter>,
  )
}

describe('ServiceDetailHero', () => {
  it('sends an unqualified visitor through the application checkpoint', () => {
    renderHero(prepService)

    const cta = screen.getByRole('button', { name: /Apply for Competition Prep/ })
    fireEvent.click(cta)

    expect(screen.getByRole('dialog', { name: /Complete Find Your Fit before applying/ })).toBeInTheDocument()
  })

  it('links a qualified visitor straight to the application', () => {
    seedQualifyingResult()
    renderHero(prepService)

    expect(screen.getByRole('link', { name: /Apply for Competition Prep/ })).toHaveAttribute(
      'href',
      prepService.application_url,
    )
  })

  it('keeps the in-page review affordance without linking off-site', () => {
    renderHero(prepService)

    expect(screen.getByRole('link', { name: /See what Jake assesses first/ })).toHaveAttribute(
      'href',
      '#service-fit-check',
    )
  })

  it('never renders a Calendly link for the application service', () => {
    renderHero(prepService)
    expect(document.querySelectorAll('a[href*="calendly.com"]')).toHaveLength(0)

    cleanup()
    seedQualifyingResult()
    renderHero(prepService)
    expect(document.querySelectorAll('a[href*="calendly.com"]')).toHaveLength(0)
  })

  it('leaves a directly bookable service pointing at its Calendly link', () => {
    renderHero(bookableService)

    expect(screen.getByRole('link', { name: new RegExp(bookableService.cta_text) })).toHaveAttribute(
      'href',
      bookableService.cta_url,
    )
    expect(screen.queryByRole('button', { name: /Apply/ })).not.toBeInTheDocument()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import services from '../../../public/content/services.json'
import ServiceDetailHero from './ServiceDetailHero'
import ServiceReadinessGate from './ServiceReadinessGate'
import { FindYourFitSessionProvider } from '../context/FindYourFitSession'
import ServiceDetailPage from '../pages/ServiceDetailPage'

const pricingMessage =
  'Every coaching plan is built around you. Book a consult to discuss the right support and investment for your goals.'

function getService(slug) {
  return services.find((service) => service.slug === slug)
}

function renderWithSession(ui) {
  return render(
    <FindYourFitSessionProvider>{ui}</FindYourFitSessionProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('tailored pricing messaging', () => {
  it('configures tailored pricing only for Competition Preparation and Online Coaching', () => {
    expect(getService('competition-preparation').pricing_message).toBe(pricingMessage)
    expect(getService('online-coaching').pricing_message).toBe(pricingMessage)
    expect(getService('personal-training').pricing_message).toBeUndefined()
    expect(getService('posing-only').pricing_message).toBeUndefined()
  })

  it('shows tailored pricing before the hero booking action when configured', () => {
    const onlineCoaching = getService('online-coaching')
    renderWithSession(
      <MemoryRouter>
        <ServiceDetailHero service={onlineCoaching} />
      </MemoryRouter>,
    )

    const message = screen.getByText(pricingMessage)
    const bookingAction = screen.getByRole('link', { name: onlineCoaching.cta_text })

    expect(message.compareDocumentPosition(bookingAction)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('shows tailored pricing in the Competition Preparation booking checkpoint', () => {
    const competitionPrep = getService('competition-preparation')
    renderWithSession(
      <MemoryRouter>
        <ServiceReadinessGate service={competitionPrep} services={services} />
      </MemoryRouter>,
    )

    expect(screen.getByText(pricingMessage)).toBeInTheDocument()
  })

  it('shows tailored pricing in the final Online Coaching booking section', async () => {
    vi.stubGlobal('fetch', vi.fn((path) => Promise.resolve({
      ok: true,
      json: async () => String(path).includes('/content/services.json') ? services : { assets: {} },
    })))

    renderWithSession(
      <MemoryRouter initialEntries={['/services/online-coaching']}>
        <Routes>
          <Route path="/services/:slug" element={<ServiceDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const bookingSection = await screen.findByRole('region', { name: 'Ready to get started?' })
    expect(within(bookingSection).getByText(pricingMessage)).toBeInTheDocument()
    expect(within(bookingSection).getByRole('link', { name: /Book Online Coaching Consult/ }))
      .toHaveAttribute('href', getService('online-coaching').cta_url)
  })
})

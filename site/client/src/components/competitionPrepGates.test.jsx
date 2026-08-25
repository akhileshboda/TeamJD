import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import services from '../../../public/content/services.json'
import { CONSULTATION_PRICING_COPY } from '../utils/servicePricing'
import CompetitionPrepAccessGate from './CompetitionPrepAccessGate'
import ServiceReadinessGate from './ServiceReadinessGate'
import StickyBookBar from './StickyBookBar'
import {
  FIND_YOUR_FIT_SESSION_KEY,
  FIND_YOUR_FIT_SESSION_VERSION,
  FindYourFitSessionProvider,
  readFindYourFitSession,
  useFindYourFitSession,
} from '../context/FindYourFitSession'

const prepService = services.find((service) => service.slug === 'competition-preparation')

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
})

function seedSession(outcome, competitionPrepPageBypass = false) {
  window.sessionStorage.setItem(FIND_YOUR_FIT_SESSION_KEY, JSON.stringify({
    version: FIND_YOUR_FIT_SESSION_VERSION,
    outcome,
    competitionPrepPageBypass,
  }))
}

function GateHarness() {
  const { canViewCompetitionPrep } = useFindYourFitSession()

  if (!canViewCompetitionPrep) {
    return <CompetitionPrepAccessGate service={prepService} services={services} />
  }

  return (
    <>
      <h1>Competition Preparation service details</h1>
      <StickyBookBar service={prepService} services={services} />
    </>
  )
}

function renderGate() {
  return render(
    <MemoryRouter initialEntries={['/services/competition-preparation']}>
      <FindYourFitSessionProvider>
        <GateHarness />
      </FindYourFitSessionProvider>
    </MemoryRouter>,
  )
}

function renderReadinessGate() {
  return render(
    <MemoryRouter initialEntries={['/services/competition-preparation']}>
      <FindYourFitSessionProvider>
        <ServiceReadinessGate service={prepService} services={services} />
      </FindYourFitSessionProvider>
    </MemoryRouter>,
  )
}

describe('Competition Preparation soft gates', () => {
  it('hides page content until the visitor completes or bypasses the access checkpoint', () => {
    const view = renderGate()

    expect(screen.getByRole('heading', { name: /Find your fit before exploring/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Competition Preparation service details' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Service next step' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'View Competition Preparation anyway' }))
    expect(screen.getByRole('heading', { name: 'Competition Preparation service details' })).toBeInTheDocument()
    expect(readFindYourFitSession().competitionPrepPageBypass).toBe(true)

    view.unmount()
    renderGate()
    expect(screen.getByRole('heading', { name: 'Competition Preparation service details' })).toBeInTheDocument()
  })

  it('uses a valid prep result for both page access and a direct application link', () => {
    seedSession({
      status: 'recommended',
      recommendationSlug: prepService.slug,
      qualifiesSlug: prepService.slug,
      reason: 'Competition Preparation is the right match.',
      evidence: [],
    })

    renderGate()

    expect(screen.getByRole('heading', { name: 'Competition Preparation service details' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Apply now/ })).toHaveAttribute(
      'href',
      prepService.application_url,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps a different-service result gated and names that recommendation', () => {
    seedSession({
      status: 'recommended',
      recommendationSlug: 'online-coaching',
      qualifiesSlug: null,
      reason: 'Online Coaching is the better starting point.',
      evidence: [],
    })

    renderGate()

    expect(screen.getByRole('heading', { name: 'Online Coaching is your current match.' })).toBeInTheDocument()
    expect(screen.getByText('Your current match')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Competition Preparation service details' })).not.toBeInTheDocument()
  })

  it('does not let a remembered page bypass skip the application checkpoint', async () => {
    seedSession(null, true)
    renderGate()

    const bookingTrigger = screen.getByRole('button', { name: /Apply now/ })
    fireEvent.click(bookingTrigger)

    expect(screen.getByRole('dialog', { name: /Complete Find Your Fit before applying/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Start Find Your Fit/ })).toHaveAttribute(
      'href',
      '/services/competition-preparation#find-your-fit',
    )
    expect(screen.getByRole('link', { name: /Continue to the application anyway/ })).toHaveAttribute(
      'href',
      prepService.application_url,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bookingTrigger).toHaveFocus()

    fireEvent.click(bookingTrigger)
    expect(screen.getByRole('dialog', { name: /Complete Find Your Fit before applying/ })).toBeInTheDocument()
  })

  it('closes the application checkpoint with Escape and restores focus', async () => {
    seedSession(null, true)
    renderGate()

    const bookingTrigger = screen.getByRole('button', { name: /Apply now/ })
    fireEvent.click(bookingTrigger)
    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bookingTrigger).toHaveFocus()
  })

  it('keeps tailored pricing directly with the final prep checkpoint actions', () => {
    renderReadinessGate()

    const pricing = screen.getByText(CONSULTATION_PRICING_COPY)
    const action = screen.getByRole('button', { name: /Apply for Competition Prep/ })
    expect(pricing.compareDocumentPosition(action)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByText('04', { selector: '.service-content-block-heading span' })).toBeInTheDocument()
  })
})

// The hard gate is enforced by the absence of the booking destination, not by
// blocking the visitor. These pin that invariant across every session state so a
// later refactor cannot quietly reintroduce a Calendly escape hatch.
describe('Competition Preparation application destination', () => {
  const SESSION_STATES = [
    ['no Find Your Fit result', null, true],
    [
      'a consult outcome',
      { status: 'consult', recommendationSlug: null, qualifiesSlug: null, reason: 'Talk first.', evidence: [] },
      true,
    ],
    [
      'another service recommended',
      { status: 'recommended', recommendationSlug: 'online-coaching', qualifiesSlug: null, reason: 'Online Coaching first.', evidence: [] },
      true,
    ],
    [
      'a qualifying prep result',
      { status: 'recommended', recommendationSlug: 'competition-preparation', qualifiesSlug: 'competition-preparation', reason: 'Prep is the match.', evidence: [] },
      false,
    ],
  ]

  function renderPrepSurfaces() {
    return render(
      <MemoryRouter initialEntries={['/services/competition-preparation']}>
        <FindYourFitSessionProvider>
          <ServiceReadinessGate service={prepService} services={services} />
          <StickyBookBar service={prepService} services={services} />
        </FindYourFitSessionProvider>
      </MemoryRouter>,
    )
  }

  function openAnyCheckpoint() {
    const trigger = screen.queryAllByRole('button', { name: /Apply/ })[0]
    if (trigger) fireEvent.click(trigger)
  }

  it.each(SESSION_STATES)('renders no Calendly link with %s', (_label, outcome, bypass) => {
    seedSession(outcome, bypass)
    renderPrepSurfaces()

    expect(document.querySelectorAll('a[href*="calendly.com"]')).toHaveLength(0)
    openAnyCheckpoint()
    expect(document.querySelectorAll('a[href*="calendly.com"]')).toHaveLength(0)
  })

  it.each(SESSION_STATES)('points every outbound action at the application with %s', (_label, outcome, bypass) => {
    seedSession(outcome, bypass)
    renderPrepSurfaces()
    openAnyCheckpoint()

    const outbound = Array.from(document.querySelectorAll('a[target="_blank"]'))
    expect(outbound.length).toBeGreaterThan(0)
    outbound.forEach((link) => {
      expect(link.getAttribute('href')).toBe(prepService.application_url)
    })
  })

  it('restores body scroll when the checkpoint unmounts while open', async () => {
    const previousOverflow = document.body.style.overflow
    seedSession(null, true)
    const view = renderGate()

    fireEvent.click(screen.getByRole('button', { name: /Apply now/ }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(document.body.style.overflow).toBe('hidden')

    view.unmount()
    expect(document.body.style.overflow).toBe(previousOverflow)
  })
})

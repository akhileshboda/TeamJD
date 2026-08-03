import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import services from '../../../public/content/services.json'
import FindYourFitLink from './FindYourFitLink'
import ServiceFinder from './ServiceFinder'
import ServiceFinderBanner from './ServiceFinderBanner'
import ScrollToTop from './ScrollToTop'
import StickyBookBar from './StickyBookBar'
import {
  FIND_YOUR_FIT_SESSION_KEY,
  FIND_YOUR_FIT_SESSION_VERSION,
  FindYourFitSessionProvider,
  readFindYourFitSession,
} from '../context/FindYourFitSession'

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
})

function getService(slug) {
  return services.find((service) => service.slug === slug)
}

function LocationProbe() {
  const location = useLocation()
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  )
}

function BrowserBackButton() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>Browser Back</button>
}

function NavigateButton({ to }) {
  const navigate = useNavigate()
  return <button onClick={() => navigate(to)}>Navigate</button>
}

function renderWithSession(ui) {
  return rtlRender(
    <FindYourFitSessionProvider>
      {ui}
    </FindYourFitSessionProvider>,
  )
}

function answerFinderQuestion(label) {
  fireEvent.click(screen.getByLabelText(label, { exact: true }))
  const continueButton = screen.queryByRole('button', { name: 'Continue' })
  fireEvent.click(continueButton || screen.getByRole('button', { name: 'Show My Best Match' }))
}

describe('StickyBookBar', () => {
  const service = getService('competition-preparation')

  it('opens a booking checkpoint without a valid result', () => {
    renderWithSession(
      <MemoryRouter>
        <StickyBookBar service={service} services={services} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /Book now/ }))
    expect(screen.getByRole('dialog', { name: /Complete Find Your Fit/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Continue to Calendly anyway/ })).toHaveAttribute(
      'href',
      service.cta_url,
    )
  })

  it('books directly after a valid Find Your Fit result', () => {
    window.sessionStorage.setItem(FIND_YOUR_FIT_SESSION_KEY, JSON.stringify({
      version: FIND_YOUR_FIT_SESSION_VERSION,
      competitionPrepPageBypass: false,
      outcome: {
        status: 'recommended',
        recommendationSlug: service.slug,
        qualifiesSlug: service.slug,
        reason: 'Competition Preparation is the match.',
        evidence: [],
      },
    }))

    renderWithSession(
      <MemoryRouter>
        <StickyBookBar service={service} services={services} />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /Book now/ })).toHaveAttribute('href', service.cta_url)
  })

  it('books a non-competition service directly without a fit check', () => {
    const directService = getService('online-coaching')
    renderWithSession(
      <MemoryRouter>
        <StickyBookBar service={directService} services={services} />
      </MemoryRouter>
    )

    expect(screen.getByText('Booking available')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Book now/ })).toHaveAttribute(
      'href',
      directService.cta_url,
    )
  })
})

describe('ServiceFinder', () => {
  it('keeps navigation outside the dedicated questionnaire scroll region', () => {
    renderWithSession(
      <MemoryRouter initialEntries={['/services#find-your-fit']}>
        <ServiceFinder services={services} />
      </MemoryRouter>
    )

    const scrollRegion = screen.getByRole('region', { name: 'Question 1 of 4' })
    const continueButton = screen.getByRole('button', { name: 'Continue' })

    expect(scrollRegion).toHaveClass('service-finder-scroll-region')
    expect(scrollRegion).not.toContainElement(continueButton)
    expect(continueButton.closest('.service-finder-step-actions')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('updates overflow affordances at the top, middle, and bottom of the question', async () => {
    renderWithSession(
      <MemoryRouter initialEntries={['/services#find-your-fit']}>
        <ServiceFinder services={services} />
      </MemoryRouter>
    )

    const scrollRegion = screen.getByRole('region', { name: 'Question 1 of 4' })
    const scrollShell = scrollRegion.closest('.service-finder-scroll-shell')
    Object.defineProperties(scrollRegion, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 600 },
      scrollTop: { configurable: true, value: 0, writable: true },
    })

    fireEvent.scroll(scrollRegion)
    await waitFor(() => {
      expect(scrollShell).toHaveAttribute('data-overflowing', 'true')
      expect(scrollShell).toHaveAttribute('data-scrolled-from-start', 'false')
      expect(scrollShell).toHaveAttribute('data-more-below', 'true')
    })
    expect(screen.getByText('More options below')).toBeInTheDocument()

    scrollRegion.scrollTop = 150
    fireEvent.scroll(scrollRegion)
    await waitFor(() => {
      expect(scrollShell).toHaveAttribute('data-scrolled-from-start', 'true')
      expect(scrollShell).toHaveAttribute('data-more-below', 'true')
    })

    scrollRegion.scrollTop = 300
    fireEvent.scroll(scrollRegion)
    await waitFor(() => {
      expect(scrollShell).toHaveAttribute('data-scrolled-from-start', 'true')
      expect(scrollShell).toHaveAttribute('data-more-below', 'false')
    })
    expect(screen.queryByText('More options below')).not.toBeInTheDocument()
  })

  it('resets questionnaire scroll and focuses new steps without moving the shell', async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus')

    try {
      renderWithSession(
        <MemoryRouter initialEntries={['/services#find-your-fit']}>
          <ServiceFinder services={services} />
        </MemoryRouter>
      )

      const scrollRegion = screen.getByRole('region', { name: 'Question 1 of 4' })
      Object.defineProperty(scrollRegion, 'scrollTop', {
        configurable: true,
        value: 180,
        writable: true,
      })

      fireEvent.click(
        screen.getByLabelText('Improve my training technique in person', { exact: true }),
      )
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

      const nextRegion = await screen.findByRole('region', { name: 'Question 2 of 4' })
      expect(nextRegion).toBe(scrollRegion)
      await waitFor(() => expect(nextRegion.scrollTop).toBe(0))
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
    } finally {
      focusSpy.mockRestore()
    }
  })

  it('recommends a detail page without exposing Calendly', async () => {
    renderWithSession(
      <MemoryRouter initialEntries={['/services']}>
        <ServiceFinderBanner />
        <ServiceFinder services={services} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('link', { name: /Find My Best Match/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Question 1 of 4')).toBeInTheDocument()
    answerFinderQuestion('Improve my training technique in person')
    expect(screen.getByText('Question 2 of 4')).toBeInTheDocument()
    answerFinderQuestion('Face-to-face sessions and technique feedback')
    answerFinderQuestion('I can train in person in Adelaide')
    answerFinderQuestion('Ready — I can commit to the process')

    expect(await screen.findByRole('heading', { name: 'Personal Training' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Review Personal Training/ })).toHaveAttribute(
      'href',
      '/services/personal-training'
    )
    expect(document.querySelector('a[href^="https://calendly.com/team-jd"]')).not.toBeInTheDocument()
  })

  it('uses the six-question path to qualify a competition-prep recommendation', async () => {
    renderWithSession(
      <MemoryRouter initialEntries={['/services#find-your-fit']}>
        <ServiceFinder services={services} />
      </MemoryRouter>
    )

    answerFinderQuestion('Prepare to compete on stage')
    expect(screen.getByText('Question 2 of 6')).toBeInTheDocument()
    answerFinderQuestion('An ongoing training and nutrition plan')
    answerFinderQuestion('I need remote or flexible coaching')
    answerFinderQuestion('Ready — I can commit to the process')
    answerFinderQuestion('One to two years')
    answerFinderQuestion('Yes — readiness comes first')

    expect(
      await screen.findByRole('heading', { name: 'Competition Preparation' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Why this is your next step')).toHaveTextContent(
      'at least one year of consistent, structured training',
    )
    expect(readFindYourFitSession().outcome).toMatchObject({
      status: 'recommended',
      recommendationSlug: 'competition-preparation',
      qualifiesSlug: 'competition-preparation',
    })
  })

  it('restores a completed result without storing answers and restarts safely', () => {
    window.sessionStorage.setItem(FIND_YOUR_FIT_SESSION_KEY, JSON.stringify({
      version: FIND_YOUR_FIT_SESSION_VERSION,
      competitionPrepPageBypass: false,
      outcome: {
        status: 'recommended',
        recommendationSlug: 'competition-preparation',
        qualifiesSlug: 'competition-preparation',
        reason: 'Competition Preparation is the right match.',
        evidence: ['Ready for the prep assessment.'],
      },
    }))

    renderWithSession(
      <MemoryRouter initialEntries={['/about#find-your-fit']}>
        <ServiceFinder services={services} />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Competition Preparation' })).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Change answers' }))
    expect(screen.getByRole('region', { name: 'Question 1 of 4' })).toBeInTheDocument()
    expect(readFindYourFitSession().outcome).toBeNull()
  })

  it('offers a preselected personal enquiry when coaching readiness is uncertain', async () => {
    renderWithSession(
      <MemoryRouter initialEntries={['/services#find-your-fit']}>
        <ServiceFinder services={services} />
      </MemoryRouter>
    )

    answerFinderQuestion('I need help deciding what support I need')
    answerFinderQuestion('I want Jake to guide me to the right starting point')
    answerFinderQuestion('I need remote or flexible coaching')
    answerFinderQuestion('I need to talk through what coaching would require')

    expect(await screen.findByRole('heading', { name: 'Talk it through with Jake' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ask Jake Directly/ })).toHaveAttribute(
      'href',
      '/contact?service=unsure#contact-enquiry',
    )
    expect(screen.queryByText('Your recommended path')).not.toBeInTheDocument()
  })

  it('opens from a direct hash route and removes the hash with Escape', async () => {
    renderWithSession(
      <MemoryRouter initialEntries={['/services#find-your-fit']}>
        <ServiceFinder services={services} />
        <LocationProbe />
      </MemoryRouter>
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByTestId('location')).toHaveTextContent('/services')
    })
  })

  it('opens over the current page and restores its exact URL and focus on close', async () => {
    renderWithSession(
      <MemoryRouter initialEntries={['/contact?source=footer#contact-services']}>
        <h1>Contact page stays mounted</h1>
        <FindYourFitLink>Find Your Fit</FindYourFitLink>
        <ServiceFinder services={services} />
        <LocationProbe />
      </MemoryRouter>
    )

    const trigger = screen.getByRole('link', { name: 'Find Your Fit' })
    expect(trigger).toHaveAttribute('href', '/contact?source=footer#find-your-fit')

    fireEvent.click(trigger)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contact page stays mounted' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/contact?source=footer#find-your-fit',
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/contact?source=footer#contact-services',
      )
      expect(trigger).toHaveFocus()
    })
  })

  it('closes on browser Back and when the overlay is clicked', async () => {
    const { container } = renderWithSession(
      <MemoryRouter initialEntries={['/results']}>
        <FindYourFitLink>Find Your Fit</FindYourFitLink>
        <BrowserBackButton />
        <ServiceFinder services={services} />
        <LocationProbe />
      </MemoryRouter>
    )

    const trigger = screen.getByRole('link', { name: 'Find Your Fit' })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Browser Back' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByTestId('location')).toHaveTextContent('/results')
    })

    fireEvent.click(trigger)
    const overlay = container.ownerDocument.querySelector('.service-finder-modal-overlay')
    fireEvent.mouseDown(overlay)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByTestId('location')).toHaveTextContent('/results')
    })
  })

  it('preserves answers when reopened on the same page', async () => {
    renderWithSession(
      <MemoryRouter initialEntries={['/about']}>
        <FindYourFitLink>Find Your Fit</FindYourFitLink>
        <ServiceFinder services={services} />
      </MemoryRouter>
    )

    const trigger = screen.getByRole('link', { name: 'Find Your Fit' })
    fireEvent.click(trigger)
    const selectedAnswer = screen.getByLabelText('Improve my training technique in person', { exact: true })
    fireEvent.click(selectedAnswer)
    expect(selectedAnswer).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Close Find Your Fit' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    fireEvent.click(trigger)
    expect(screen.getByLabelText('Improve my training technique in person', { exact: true })).toBeChecked()
  })

  it('resets answers after the underlying pathname changes', async () => {
    renderWithSession(
      <MemoryRouter initialEntries={['/about']}>
        <FindYourFitLink>Find Your Fit</FindYourFitLink>
        <NavigateButton to="/contact" />
        <ServiceFinder services={services} />
      </MemoryRouter>
    )

    const trigger = screen.getByRole('link', { name: 'Find Your Fit' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByLabelText('Improve my training technique in person', { exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Close Find Your Fit' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }))
    fireEvent.click(trigger)

    expect(screen.getByLabelText('Improve my training technique in person', { exact: true })).not.toBeChecked()
  })

  it('offers a Services recovery route when recommendation data fails to load', async () => {
    renderWithSession(
      <MemoryRouter initialEntries={['/#find-your-fit']}>
        <ServiceFinder services={[]} error={new Error('Service data unavailable')} />
      </MemoryRouter>
    )

    answerFinderQuestion('Improve my training technique in person')
    answerFinderQuestion('Face-to-face sessions and technique feedback')
    answerFinderQuestion('I can train in person in Adelaide')
    answerFinderQuestion('Ready — I can commit to the process')

    expect(await screen.findByRole('link', { name: /View All Services/ })).toHaveAttribute(
      'href',
      '/services',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'We could not load the service details.',
    )
  })

  it('does not scroll the underlying page when the finder opens or closes', async () => {
    const scrollIntoView = vi.fn()
    const originalScrollIntoView = Element.prototype.scrollIntoView
    const originalScrollTo = window.scrollTo
    Element.prototype.scrollIntoView = scrollIntoView
    window.scrollTo = vi.fn()

    try {
      renderWithSession(
        <MemoryRouter initialEntries={['/contact']}>
          <FindYourFitLink>Find Your Fit</FindYourFitLink>
          <ServiceFinder services={services} />
          <ScrollToTop />
        </MemoryRouter>
      )

      window.scrollTo.mockClear()
      const trigger = screen.getByRole('link', { name: 'Find Your Fit' })
      fireEvent.click(trigger)
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Close Find Your Fit' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      expect(window.scrollTo).not.toHaveBeenCalled()
      expect(scrollIntoView).not.toHaveBeenCalled()
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView
      window.scrollTo = originalScrollTo
    }
  })
})

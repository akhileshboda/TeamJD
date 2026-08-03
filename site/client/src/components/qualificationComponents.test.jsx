import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import services from '../../../public/content/services.json'
import FindYourFitLink from './FindYourFitLink'
import ServiceFinder from './ServiceFinder'
import ServiceFinderBanner from './ServiceFinderBanner'
import ServiceQualification from './ServiceQualification'
import ScrollToTop from './ScrollToTop'
import StickyBookBar from './StickyBookBar'
import { getQualificationStorageKey } from '../utils/qualification'

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

function renderQualification(slug, props = {}) {
  const service = getService(slug)
  return render(
    <MemoryRouter>
      <ServiceQualification service={service} services={services} {...props} />
    </MemoryRouter>
  )
}

function choosePassingAnswers(slug) {
  getService(slug).qualification.questions.forEach((question) => {
    const option = question.options.find((candidate) => candidate.qualifies)
    fireEvent.click(screen.getByLabelText(option.label, { exact: true }))
  })
}

function answerFinderQuestion(label) {
  fireEvent.click(screen.getByLabelText(label, { exact: true }))
  const continueButton = screen.queryByRole('button', { name: 'Continue' })
  fireEvent.click(continueButton || screen.getByRole('button', { name: 'Show My Best Match' }))
}

describe('ServiceQualification', () => {
  it('does not render Calendly before the fit check passes', () => {
    const { container } = renderQualification('competition-preparation')

    expect(container.querySelector('a[href^="https://calendly.com/team-jd"]')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check My Fit' })).toBeInTheDocument()
  })

  it('reveals the correct service booking only after passing and remembers the unlock', async () => {
    const service = getService('competition-preparation')
    const { container } = renderQualification(service.slug)

    choosePassingAnswers(service.slug)
    fireEvent.click(screen.getByRole('button', { name: 'Check My Fit' }))

    const booking = await screen.findByRole('link', { name: /Request Prep Assessment/ })
    expect(booking).toHaveAttribute('href', service.cta_url)
    expect(container.querySelectorAll('a[href^="https://calendly.com/team-jd"]')).toHaveLength(1)
    expect(window.sessionStorage.getItem(getQualificationStorageKey(service.slug))).toBe('qualified')
  })

  it('keeps booking locked and recommends the better service after a mismatch', async () => {
    const service = getService('competition-preparation')
    const { container } = renderQualification(service.slug)

    fireEvent.click(screen.getByLabelText('Less than one year', { exact: true }))
    fireEvent.click(screen.getByLabelText('Yes — readiness comes first', { exact: true }))
    fireEvent.click(screen.getByLabelText('Yes — I am ready for that standard', { exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Check My Fit' }))

    expect(await screen.findByRole('heading', { name: 'Competition prep is not the right next booking yet.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Explore Online Coaching/ })).toHaveAttribute(
      'href',
      '/services/online-coaching'
    )
    expect(container.querySelector('a[href^="https://calendly.com/team-jd"]')).not.toBeInTheDocument()
  })

  it('re-locks booking when a visitor chooses to review the fit check', async () => {
    const service = getService('competition-preparation')
    const { container } = renderQualification(service.slug)

    choosePassingAnswers(service.slug)
    fireEvent.click(screen.getByRole('button', { name: 'Check My Fit' }))
    expect(await screen.findByRole('link', { name: /Request Prep Assessment/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Review fit check' }))
    expect(screen.getByRole('button', { name: 'Check My Fit' })).toBeInTheDocument()
    expect(container.querySelector('a[href^="https://calendly.com/team-jd"]')).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem(getQualificationStorageKey(service.slug))).toBeNull()
  })

  it('restores a previously qualified session without retaining answers', () => {
    const service = getService('competition-preparation')
    renderQualification(service.slug, { initialQualified: true })

    expect(screen.getByRole('link', { name: /Request Prep Assessment/ })).toHaveAttribute(
      'href',
      service.cta_url
    )
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})

describe('StickyBookBar', () => {
  const service = getService('competition-preparation')

  it('links to the fit check while locked', () => {
    const { container } = render(
      <MemoryRouter>
        <StickyBookBar service={service} qualificationState={{ status: 'locked' }} />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /Check your fit/ })).toHaveAttribute('href', '#service-fit-check')
    expect(container.querySelector('a[href^="https://calendly.com/team-jd"]')).not.toBeInTheDocument()
  })

  it('reveals booking after qualification', () => {
    render(
      <MemoryRouter>
        <StickyBookBar service={service} qualificationState={{ status: 'qualified' }} />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /Book now/ })).toHaveAttribute('href', service.cta_url)
  })

  it('links to the recommended service after a mismatch', () => {
    const recommendation = getService('online-coaching')
    render(
      <MemoryRouter>
        <StickyBookBar
          service={service}
          qualificationState={{ status: 'redirect' }}
          recommendation={recommendation}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /View match/ })).toHaveAttribute(
      'href',
      '/services/online-coaching'
    )
  })

  it('books a non-competition service directly without a fit check', () => {
    const directService = getService('online-coaching')
    render(
      <MemoryRouter>
        <StickyBookBar service={directService} qualificationState={{ status: 'locked' }} />
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
  it('recommends a detail page without exposing Calendly', async () => {
    render(
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
    render(
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
    expect(
      window.sessionStorage.getItem(getQualificationStorageKey('competition-preparation')),
    ).toBe('qualified')
  })

  it('offers a preselected personal enquiry when coaching readiness is uncertain', async () => {
    render(
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
    render(
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
    render(
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
    const { container } = render(
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
    render(
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
    render(
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
    render(
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
      render(
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

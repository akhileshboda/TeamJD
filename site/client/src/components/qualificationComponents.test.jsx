import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import services from '../../../public/content/services.json'
import ServiceFinder from './ServiceFinder'
import ServiceQualification from './ServiceQualification'
import StickyBookBar from './StickyBookBar'
import { getQualificationStorageKey } from '../utils/qualification'

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
})

function getService(slug) {
  return services.find((service) => service.slug === slug)
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
      <MemoryRouter>
        <ServiceFinder services={services} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /Find My Best Match/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Train with Jake in person', { exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.queryByLabelText('Train with Jake in person', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('I can train in Adelaide', { exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Show My Best Match' }))

    expect(await screen.findByRole('heading', { name: 'Personal Training' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Review Personal Training/ })).toHaveAttribute(
      'href',
      '/services/personal-training'
    )
    expect(document.querySelector('a[href^="https://calendly.com/team-jd"]')).not.toBeInTheDocument()
  })

  it('opens from the shared hash route and closes with Escape', async () => {
    render(
      <MemoryRouter initialEntries={['/services#find-your-fit']}>
        <ServiceFinder services={services} />
      </MemoryRouter>
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})

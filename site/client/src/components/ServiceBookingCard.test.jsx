import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import services from '../../../server/seed/services.json'
import ServiceBookingCard from './ServiceBookingCard'

const getService = (slug) => services.find((service) => service.slug === slug)

const renderCard = (slug) =>
  render(
    <ServiceBookingCard
      id="service-booking"
      service={getService(slug)}
      heading="Ready to get started?"
      headingId="service-booking-title"
      className="service-direct-booking"
    >
      <div className="service-readiness-gate-body">
        <p>Review the service details above.</p>
        <a href="https://example.com" className="btn btn-primary">Book</a>
      </div>
    </ServiceBookingCard>,
  )

afterEach(cleanup)

describe('ServiceBookingCard', () => {
  it('titles the card once, at section level', () => {
    renderCard('posing-only')

    const heading = screen.getByRole('heading', { name: 'Ready to get started?' })

    // The card used to nest an h2 (the service name) inside this h3, which both
    // inverted the document outline and gave one card two competing titles.
    expect(heading.tagName).toBe('H2')
    expect(screen.queryByRole('heading', { name: 'Posing' })).not.toBeInTheDocument()
    expect(document.querySelectorAll('h2, h3, h4')).toHaveLength(1)
  })

  it('carries the step number and section class the card inset and tests key off', () => {
    renderCard('posing-only')

    const section = document.querySelector('#service-booking')

    expect(section.className).toContain('service-content-block--readiness')
    expect(section.className).toContain('service-direct-booking')
    expect(screen.getByText('04', { selector: '.service-content-block-heading span' }))
      .toBeInTheDocument()
  })

  it('leaves the section heading as the only eyebrow above the price', () => {
    renderCard('posing-only')

    // Three eyebrows used to stack here: the section kicker, the pricing label and a
    // "Booking available" line. Only the kicker and the pricing label remain, and the
    // pricing label is the one that belongs to the price beneath it.
    expect(document.querySelectorAll('.eyebrow')).toHaveLength(0)
    expect(screen.getByText('Your next step')).toBeInTheDocument()
  })
})

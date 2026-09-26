import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import services from '../../../public/content/services.json'
import ServicePricingConversion from './ServicePricingConversion'
import { CONSULTATION_PRICING_COPY } from '../utils/servicePricing'

const getService = (slug) => services.find((service) => service.slug === slug)

afterEach(cleanup)

describe('ServicePricingConversion', () => {
  it('shows the lowest Personal Training entry price in the hero signal before its CTA', () => {
    render(
      <ServicePricingConversion service={getService('personal-training')} placement="hero">
        <a href="https://example.com">Book Personal Training Consult</a>
      </ServicePricingConversion>,
    )

    const signal = screen.getByRole('region', { name: /Session investment/i })
    const price = within(signal).getByText('$75')
    const cta = screen.getByRole('link', { name: 'Book Personal Training Consult' })
    expect(signal).toHaveClass('service-pricing-conversion--hero', 'service-pricing-conversion--priced')
    expect(within(signal).getByText('From')).toBeInTheDocument()
    expect(within(signal).getByText('per person, per session')).toBeInTheDocument()
    expect(price.compareDocumentPosition(cta)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('keeps final fixed-price tiers semantic, ordered, and directly paired with the CTA', () => {
    render(
      <ServicePricingConversion service={getService('personal-training')} placement="final">
        <a href="https://example.com">Book Personal Training Consult</a>
      </ServicePricingConversion>,
    )

    const dock = screen.getByRole('region', { name: /Session investment/i })
    const tiers = dock.querySelector('dl')
    const solo = within(tiers).getByText('Solo sessions')
    const joint = within(tiers).getByText('Joint sessions')
    const cta = screen.getByRole('link', { name: 'Book Personal Training Consult' })

    expect(dock).toHaveClass('service-pricing-conversion--final', 'service-pricing-conversion--priced')
    expect(within(tiers).getByText('$85')).toBeInTheDocument()
    expect(within(tiers).getByText('$75')).toBeInTheDocument()
    expect(solo.compareDocumentPosition(joint)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(dock.querySelector('.service-pricing-conversion-action')).toContainElement(cta)
  })

  it('states a single-tier price once instead of summarising the only tier above itself', () => {
    render(
      <ServicePricingConversion service={getService('posing-only')} placement="final">
        <a href="https://example.com">Book Posing Session</a>
      </ServicePricingConversion>,
    )

    // The summary for a one-tier service is built from that tier, so rendering the
    // tier table as well printed the same price and the same label twice in one card.
    expect(screen.getAllByText('$120')).toHaveLength(1)
    expect(screen.getAllByText('Posing session')).toHaveLength(1)
    expect(screen.getAllByText('per session')).toHaveLength(1)
  })

  it('lets the tier table own the numbers so the multi-tier summary cannot repeat one', () => {
    render(
      <ServicePricingConversion service={getService('personal-training')} placement="final">
        <a href="https://example.com">Book Personal Training Consult</a>
      </ServicePricingConversion>,
    )

    // "From $85" above a table whose first row is $85 stated the same price twice.
    expect(screen.getAllByText('$85')).toHaveLength(1)
    expect(screen.getAllByText('$75')).toHaveLength(1)
    expect(screen.queryByText('From')).not.toBeInTheDocument()
  })

  it('uses the approved tailored-pricing consultation signal before a consultation CTA', () => {
    render(
      <ServicePricingConversion service={getService('online-coaching')} placement="hero">
        <a href="https://example.com">Book Online Coaching Consult</a>
      </ServicePricingConversion>,
    )

    const message = screen.getByText(CONSULTATION_PRICING_COPY)
    const cta = screen.getByRole('link', { name: 'Book Online Coaching Consult' })
    expect(screen.getByRole('region', { name: 'Tailored pricing' })).toHaveClass(
      'service-pricing-conversion--consultation',
    )
    expect(message.compareDocumentPosition(cta)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})

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

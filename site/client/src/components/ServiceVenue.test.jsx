import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import services from '../../../public/content/services.json'
import ServiceVenue from './ServiceVenue'

const personalTraining = services.find((service) => service.slug === 'personal-training')

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ assets: {} }),
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Personal Training service details', () => {
  it('uses Jake’s dedicated Personal Training Calendly link', () => {
    expect(personalTraining.cta_url).toBe('https://calendly.com/team-jd/train-with-jd')
  })

  it('identifies Form First Studio and renders its three accessible venue images', () => {
    render(<ServiceVenue venue={personalTraining.venue} />)

    expect(screen.getByRole('heading', { name: 'Train at Form First Studio.' })).toBeInTheDocument()
    expect(screen.getByText('6/22 Ware Street, Thebarton SA 5031')).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })
})

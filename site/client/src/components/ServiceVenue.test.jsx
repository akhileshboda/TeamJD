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
  it('uses Jake’s dedicated Personal Training Calendly link and correctly priced session options', () => {
    expect(personalTraining.cta_url).toBe('https://calendly.com/team-jd/train-with-jd')
    expect(personalTraining.session_options).toEqual([
      expect.objectContaining({ title: 'Solo sessions', price: '$85 per session' }),
      expect.objectContaining({ title: 'Joint sessions', price: '$75 per person, per session' }),
    ])
  })

  it('identifies Form First Studio and renders its three accessible venue images', () => {
    render(
      <ServiceVenue
        venue={personalTraining.venue}
        sessionOptions={personalTraining.session_options}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Train at Form First Studio.' })).toBeInTheDocument()
    expect(screen.getByText('6/22 Ware Street, Thebarton SA 5031')).toBeInTheDocument()
    expect(screen.getByText('$85 per session')).toBeInTheDocument()
    expect(screen.getByText('$75 per person, per session')).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })
})

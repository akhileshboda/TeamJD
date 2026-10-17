import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomeStats, { changeLabel, pageLabel } from './HomeStats'

vi.mock('../../hooks/useJSON', () => ({
  useJSON: () => ({ data: [{ slug: 'posing-only', name: 'Posing' }], loading: false, error: null }),
}))

function stats(overrides = {}) {
  const daily = Array.from({ length: 7 }, (_, index) => ({
    date: `2026-10-0${index + 1}`,
    visits: index,
    pageViews: index * 2,
    previousVisits: 1,
  }))
  return {
    range: '7d',
    current: { visits: 21, pageViews: 42 },
    previous: { visits: 7, pageViews: 9 },
    daily,
    topPages: [{ path: '/services/posing-only', count: 20 }, { path: '/', count: 12 }],
    sources: [{ source: 'Instagram', count: 15 }, { source: 'Direct', count: 6 }],
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Home stats', () => {
  it('shows visits, the change on the period before, and the ranked lists', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(stats()), { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
    render(<MemoryRouter><HomeStats /></MemoryRouter>)

    expect(await screen.findByText('21')).toBeInTheDocument()
    expect(screen.getByText('Up 200% on the period before')).toBeInTheDocument()
    expect(screen.getByText('Posing')).toBeInTheDocument()
    expect(screen.getByText('Instagram')).toBeInTheDocument()
    expect(screen.getByText('2.0')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Daily visits/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '7 days' }))
    expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/stats?range=7d', expect.anything())
  })

  it('explains an empty log instead of drawing a flat chart', async () => {
    const empty = stats({ current: { visits: 0, pageViews: 0 }, previous: { visits: 0, pageViews: 0 }, topPages: [], sources: [] })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(empty), { status: 200 }))))
    render(<MemoryRouter initialEntries={['/admin?range=90d']}><HomeStats /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '90 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText(/No visits counted yet/)).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Daily visits/ })).not.toBeInTheDocument()
  })
})

describe('stat helpers', () => {
  it('names pages the way Jake knows them', () => {
    expect(pageLabel('/')).toBe('Home')
    expect(pageLabel('/services/posing-only', [{ slug: 'posing-only', name: 'Posing' }])).toBe('Posing')
    expect(pageLabel('/services/new-thing')).toBe('new thing')
  })

  it('describes change against the period before', () => {
    expect(changeLabel(12, 10)).toEqual({ tone: 'up', text: 'Up 20% on the period before' })
    expect(changeLabel(5, 10)).toEqual({ tone: 'down', text: 'Down 50% on the period before' })
    expect(changeLabel(10, 10).tone).toBe('neutral')
    expect(changeLabel(3, 0).text).toBe('No visits in the period before')
    expect(changeLabel(0, 0)).toBeNull()
  })
})

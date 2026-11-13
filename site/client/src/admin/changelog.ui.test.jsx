import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import WhatsNew from './components/WhatsNew'
import ChangelogSection from './sections/ChangelogSection'

const mockState = vi.hoisted(() => ({ value: { entries: null, error: '' } }))
vi.mock('./useChangelog', () => ({ useChangelog: () => mockState.value }))

afterEach(() => {
  cleanup()
  mockState.value = { entries: null, error: '' }
})

const entries = [
  { date: '2026-10-27', text: 'Added a booking button to the Services page.' },
  { date: '2026-10-24', text: 'Fixed result cards on the About page.' },
  { date: '2026-10-18', text: 'Jake can now replace photos and videos.' },
  { date: '2026-09-02', text: 'Faster loading on phones.' },
]

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<WhatsNew />} />
        <Route path="/admin/changelog" element={<ChangelogSection />} />
      </Routes>
    </MemoryRouter>,
  )
}

const listedText = () => screen.getAllByRole('listitem').map((item) => item.textContent)

describe('What’s new on Home', () => {
  it('shows the three latest updates and a link to see them all', () => {
    mockState.value = { entries, error: '' }
    renderAt('/admin')

    expect(listedText()).toHaveLength(3)
    expect(screen.queryByText('Faster loading on phones.')).not.toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'What’s new' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View all \(4\)/ })).toHaveAttribute('href', '/admin/changelog')
  })

  it('has no link when nothing has been posted', () => {
    mockState.value = { entries: [], error: '' }
    renderAt('/admin')

    expect(screen.getByText('Nothing posted yet.')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('fails quietly, without an alert over Home', () => {
    mockState.value = { entries: null, error: 'Could not reach the server.' }
    renderAt('/admin')

    expect(screen.getByText('The latest updates could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Change log page', () => {
  it('lists every update newest first, with a count and a way back', () => {
    mockState.value = { entries, error: '' }
    renderAt('/admin/changelog')

    expect(screen.getByRole('heading', { name: 'Change log' })).toBeInTheDocument()
    expect(listedText()).toHaveLength(4)
    expect(listedText()[0]).toContain('27 Oct 2026')
    expect(screen.getByText('4 updates')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to Home/ })).toHaveAttribute('href', '/admin')
  })

  it('searches updates and dates, and says when nothing matches', () => {
    mockState.value = { entries, error: '' }
    renderAt('/admin/changelog')

    fireEvent.change(screen.getByLabelText('Search updates'), { target: { value: 'oct photos' } })
    expect(listedText()).toHaveLength(1)
    expect(screen.getByText('1 of 4 updates')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search updates'), { target: { value: 'zebra' } })
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(screen.getByText(/No updates match “zebra”/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(listedText()).toHaveLength(4)
    expect(screen.getByLabelText('Search updates')).toHaveValue('')
  })

  it('sorts oldest first', () => {
    mockState.value = { entries, error: '' }
    renderAt('/admin/changelog')

    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'oldest' } })
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText('2 Sept 2026')).toBeInTheDocument()
    expect(within(items.at(-1)).getByText('27 Oct 2026')).toBeInTheDocument()
  })

  it('restores search and sort from the address', () => {
    mockState.value = { entries, error: '' }
    renderAt('/admin/changelog?q=oct&sort=oldest')

    expect(screen.getByLabelText('Search updates')).toHaveValue('oct')
    expect(screen.getByLabelText('Sort')).toHaveValue('oldest')
    expect(listedText()[0]).toContain('18 Oct 2026')
  })

  it('shows a plain message when the updates cannot load', () => {
    mockState.value = { entries: null, error: 'Could not reach the server.' }
    renderAt('/admin/changelog')

    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server.')
    expect(screen.queryByLabelText('Search updates')).not.toBeInTheDocument()
  })
})

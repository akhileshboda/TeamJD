import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import results from '../test/fixtures/resultsLibrary.js'
import Results from './Results'

const library = vi.hoisted(() => ({ data: null, preview: false }))

vi.mock('../hooks/useContent', () => ({
  useContent: () => ({ data: library.data, loading: false, error: null }),
  isPreviewWindow: () => library.preview,
}))

vi.mock('../hooks/useAssets', () => ({
  useAssets: () => (path) => path,
}))

vi.mock('../components/SectionReveal', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

beforeEach(() => {
  library.data = results
  library.preview = false
})

afterEach(() => cleanup())

function renderResults(path = '/results') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/results" element={<Results />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Results page library', () => {
  it('only offers the categories the published library contains, and no type filter', () => {
    library.data = results.slice(0, 6)
    renderResults()

    expect(screen.queryByLabelText('Content type')).not.toBeInTheDocument()
    const chips = screen.getAllByRole('button', { name: /, \d+ results$/ })
    expect(chips.map((chip) => chip.textContent.replace(/\d+$/, ''))).toEqual(['All', 'Competition Prep', 'Posing'])
  })

  it('opens a result straight from a ?view= link', () => {
    library.data = results.slice(0, 6)
    renderResults('/results?view=2')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('in the dashboard preview, keeps a ?view= result the published library lacks until the draft arrives', () => {
    library.preview = true
    library.data = results.slice(0, 6)
    const view = render(
      <MemoryRouter initialEntries={['/results?view=brand-new&cmsPreview=1']}>
        <Routes><Route path="/results" element={<Results />} /></Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    library.data = [{ ...results[0], id: 'brand-new', name: 'Brand new result' }, ...results.slice(0, 6)]
    view.rerender(
      <MemoryRouter initialEntries={['/results?view=brand-new&cmsPreview=1']}>
        <Routes><Route path="/results" element={<Results />} /></Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Brand new result' })).toBeInTheDocument()
  })

  it('renders only 24 cards at once and pages through the full library', () => {
    renderResults()

    expect(screen.getAllByRole('button', { name: /^View / })).toHaveLength(24)
    expect(screen.getByText('Showing 1–24 of 120 results')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Next/ }))

    expect(screen.getAllByRole('button', { name: /^View / })).toHaveLength(24)
    expect(screen.getByText('Showing 25–48 of 120 results')).toBeInTheDocument()
  })

  it('restores URL filters, defaults to newest first and ignores old type links', () => {
    renderResults('/results?type=representative&category=training&sort=caption')

    expect(screen.queryByLabelText('Content type')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Sort results')).toHaveValue('caption')
    expect(screen.getByRole('option', { name: 'Newest' })).toHaveValue('newest')
    expect(screen.queryByText(/curated collection/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Personal Training, 24 results' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Showing 1–24 of 24 results')).toBeInTheDocument()
  })

  it('can hide and restore the entire browse toolbar without changing active library filters', () => {
    renderResults('/results?q=posing')

    const toggle = screen.getByRole('button', { name: 'Hide' })
    expect(screen.getByLabelText('Search the library')).toHaveValue('posing')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle.querySelector('svg')).toBeInTheDocument()

    fireEvent.click(toggle)

    expect(screen.queryByLabelText('Search the library')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Content type')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter by category' })).not.toBeInTheDocument()
    const reveal = screen.getByRole('button', { name: 'Show search' })
    expect(reveal).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(reveal.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText('Showing 1–24 of 27 results')).toBeInTheDocument()

    fireEvent.click(reveal)

    expect(screen.getByLabelText('Search the library')).toHaveValue('posing')
  })
})

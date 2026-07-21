import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import results from '../../../public/content/results-library.json'
import Results from './Results'

vi.mock('../hooks/useJSON', () => ({
  useJSON: () => ({ data: results, loading: false, error: null }),
}))

vi.mock('../hooks/useAssets', () => ({
  useAssets: () => (path) => path,
}))

vi.mock('../components/SectionReveal', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

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
  it('renders only 24 cards at once and pages through the full library', () => {
    renderResults()

    expect(screen.getAllByRole('button', { name: /^View / })).toHaveLength(24)
    expect(screen.getByText('Showing 1–24 of 120 results')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Next/ }))

    expect(screen.getAllByRole('button', { name: /^View / })).toHaveLength(24)
    expect(screen.getByText('Showing 25–48 of 120 results')).toBeInTheDocument()
  })

  it('restores URL filters and exposes an honest representative-image mode', () => {
    renderResults('/results?type=representative&category=training')

    expect(screen.getByLabelText('Content type')).toHaveValue('representative')
    expect(screen.getByRole('button', { name: 'Personal Training, 24 results' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Showing 1–24 of 24 results')).toBeInTheDocument()
  })
})

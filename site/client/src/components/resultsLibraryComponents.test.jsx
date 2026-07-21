import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ResultCard from './ResultCard'
import ResultsViewer from './ResultsViewer'

vi.mock('../hooks/useAssets', () => ({
  useAssets: () => (path) => path,
}))

afterEach(() => cleanup())

const result = {
  id: 'reference-training-01',
  src: 'https://images.example.com/training.jpg',
  alt: 'Athlete training with a coach',
  caption: 'Personal Training Reference — Guided strength work',
  category: 'training',
  kind: 'representative',
}

describe('ResultCard', () => {
  it('opens from a semantic button and exposes persistent metadata', () => {
    const onOpen = vi.fn()
    render(<ResultCard result={result} onOpen={onOpen} />)

    const card = screen.getByRole('button', { name: /View Personal Training Reference/ })
    expect(screen.getByText('Reference')).toBeInTheDocument()
    expect(screen.getByText('Personal Training')).toBeInTheDocument()

    fireEvent.click(card)
    expect(onOpen).toHaveBeenCalledWith(result, card)
  })
})

describe('ResultsViewer', () => {
  it('supports arrow navigation and Escape without changing the shared lightbox', () => {
    const onNext = vi.fn()
    const onClose = vi.fn()

    render(
      <ResultsViewer
        result={result}
        position={1}
        total={2}
        previousResult={null}
        nextResult={{ ...result, id: 'reference-training-02' }}
        onPrevious={vi.fn()}
        onNext={onNext}
        onClose={onClose}
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onNext).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

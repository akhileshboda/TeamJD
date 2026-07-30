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

  it('uses the same rich story structure as the homepage preview', () => {
    const clientResult = {
      ...result,
      id: 'client-training-01',
      kind: 'client',
      name: 'Stronger movement with direct coaching',
      location: 'Personal Training',
      duration: '12 Weeks',
      summary: 'A structured strength result built around movement quality.',
      testimonial: {
        quote: 'Every session had a clear purpose.',
        author: 'Training Client',
        result: 'Stronger Technique',
      },
    }

    const { rerender } = render(
      <ResultsViewer
        result={clientResult}
        position={1}
        total={1}
        previousResult={null}
        nextResult={null}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: clientResult.name })).toBeInTheDocument()
    expect(screen.getByText('12 Weeks')).toBeInTheDocument()
    expect(screen.getByText(clientResult.summary)).toBeInTheDocument()
    expect(screen.getByText(clientResult.testimonial.quote)).toBeInTheDocument()
    expect(screen.getByText('Training Client').closest('figcaption')).toHaveTextContent(
      'Training Client · Stronger Technique',
    )

    rerender(
      <ResultsViewer
        result={result}
        position={1}
        total={1}
        previousResult={null}
        nextResult={null}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText(/not presented as a Team JD client outcome/)).toBeInTheDocument()
    expect(document.querySelector('.result-story-testimonial')).not.toBeInTheDocument()
  })
})

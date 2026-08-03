import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ResultCard from './ResultCard'
import ResultMedia from './ResultMedia'
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

describe('ResultMedia', () => {
  it('keeps an uncurated subject complete inside a square ambient frame', () => {
    render(<ResultMedia result={result} src={result.src} />)

    const media = document.querySelector('.result-media')
    const foreground = screen.getByRole('img', { name: result.alt })

    expect(media).toHaveAttribute('data-fit', 'contain')
    expect(media).toHaveStyle({
      '--result-focus-x': '50%',
      '--result-focus-y': '50%',
    })
    expect(document.querySelector('.result-media-ambient')).toHaveAttribute('aria-hidden', 'true')
    expect(foreground).toHaveClass('result-media-foreground')

    fireEvent.load(foreground)
    expect(media).toHaveAttribute('data-loaded', 'true')
  })

  it('applies curated cover focal points without duplicating meaningful alt text', () => {
    const coverResult = {
      ...result,
      presentation: {
        fit: 'cover',
        focus: { x: 28, y: 36 },
      },
    }

    render(<ResultMedia result={coverResult} src={coverResult.src} />)

    const media = document.querySelector('.result-media')
    expect(media).toHaveAttribute('data-fit', 'cover')
    expect(media).toHaveStyle({
      '--result-focus-x': '28%',
      '--result-focus-y': '36%',
    })
    expect(document.querySelector('.result-media-ambient')).not.toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(1)
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

  it('retains adaptive story geometry outside the homepage gallery', () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(min-width: 1025px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }))

    try {
      render(
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

      const presentation = document.querySelector('.results-viewer-presentation')
      const sheet = presentation.querySelector('.result-preview-overlay')
      const story = sheet.querySelector('.result-overlay-story-anchor')
      const scroll = sheet.querySelector('.result-overlay-scroll')

      Object.defineProperty(presentation, 'clientHeight', {
        configurable: true,
        value: 600,
      })
      Object.defineProperty(story, 'scrollHeight', {
        configurable: true,
        value: 480,
      })
      Object.defineProperty(scroll, 'clientHeight', {
        configurable: true,
        get: () => Number.parseFloat(sheet.style.height) || 330,
      })
      Object.defineProperty(scroll, 'scrollHeight', {
        configurable: true,
        value: 480,
      })

      fireEvent(window, new Event('resize'))

      expect(presentation).toHaveAttribute('data-story-frame', 'adaptive')
      expect(sheet).toHaveAttribute('data-scroll-mode', 'fit')
      expect(sheet).toHaveStyle({ height: '480px' })
      expect(sheet.querySelector('.result-overlay-header')).not.toBeInTheDocument()
      expect(scroll).toContainElement(sheet.querySelector('.result-story-badge'))
      expect(screen.getByRole('button', { name: 'Hide result story' })).toHaveTextContent(
        'Hide Story',
      )
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })

  it('keeps wheel input trapped in the modal at an internal scroll boundary', () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(min-width: 1025px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }))

    try {
      render(
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

      const presentation = document.querySelector('.results-viewer-presentation')
      const sheet = presentation.querySelector('.result-preview-overlay')
      const story = sheet.querySelector('.result-overlay-story-anchor')
      const scroll = sheet.querySelector('.result-overlay-scroll')

      Object.defineProperty(presentation, 'clientHeight', {
        configurable: true,
        value: 600,
      })
      Object.defineProperty(story, 'scrollHeight', {
        configurable: true,
        value: 800,
      })
      Object.defineProperty(scroll, 'clientHeight', {
        configurable: true,
        value: 600,
      })
      Object.defineProperty(scroll, 'scrollHeight', {
        configurable: true,
        value: 800,
      })

      fireEvent(window, new Event('resize'))
      scroll.scrollTop = 200

      const boundaryWheel = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: 80,
      })
      fireEvent(sheet, boundaryWheel)

      expect(sheet).toHaveAttribute('data-scroll-mode', 'overflow')
      expect(boundaryWheel.defaultPrevented).toBe(true)
      expect(scroll.scrollTop).toBe(200)
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })
})

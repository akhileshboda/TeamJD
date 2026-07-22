import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import AboutProcessCarousel from './AboutProcessCarousel'

const motionState = vi.hoisted(() => ({ shouldReduceMotion: false }))

vi.mock('motion/react', () => ({
  useReducedMotion: () => motionState.shouldReduceMotion,
}))

vi.mock('../hooks/useAssets', () => ({
  useAssets: () => (assetPath) => assetPath,
}))

const images = [
  { asset: 'one', alt: 'First process image' },
  { asset: 'two', alt: 'Second process image' },
  { asset: 'three', alt: 'Third process image' },
]

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  motionState.shouldReduceMotion = false
})

describe('AboutProcessCarousel', () => {
  it('renders three mapped images, dots, and side navigation arrows', () => {
    const { container } = render(
      <AboutProcessCarousel images={images} caption="A subtle caption" />,
    )

    expect(screen.getByRole('region', { name: 'How Team JD works' })).toBeInTheDocument()
    expect(container.querySelectorAll('img')).toHaveLength(3)
    expect(screen.getByAltText('First process image')).toHaveAttribute(
      'src',
      '/api/assets/one',
    )
    expect(screen.getByRole('button', { name: 'Show previous process image' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show next process image' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Show process image \d of 3/ })).toHaveLength(3)
    expect(screen.getByText('A subtle caption')).toBeInTheDocument()
  })

  it('moves between images using arrows and dots', () => {
    render(<AboutProcessCarousel images={images} caption="A subtle caption" />)

    fireEvent.click(screen.getByRole('button', { name: 'Show next process image' }))
    expect(screen.getByAltText('Second process image')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show process image 2 of 3' })).toHaveAttribute(
      'aria-current',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show process image 3 of 3' }))
    expect(screen.getByAltText('Third process image')).toBeInTheDocument()
  })

  it('does not auto-advance when reduced motion is requested', () => {
    vi.useFakeTimers()
    motionState.shouldReduceMotion = true
    render(<AboutProcessCarousel images={images} caption="A subtle caption" />)

    vi.advanceTimersByTime(10400)
    expect(screen.getByAltText('First process image')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show process image 1 of 3' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })
})

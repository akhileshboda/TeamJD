import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ContactSocialCarousel from './ContactSocialCarousel'

const motionState = vi.hoisted(() => ({ shouldReduceMotion: true }))

vi.mock('motion/react', () => ({
  useReducedMotion: () => motionState.shouldReduceMotion,
}))

vi.mock('../hooks/useAssets', () => ({
  useAssets: () => (assetPath) => assetPath,
}))

const POSTS = [
  {
    id: 'one',
    asset: 'gallery-social-one',
    href: 'https://www.facebook.com/photo/?fbid=1',
    date: '1 Jan 2022',
    label: 'Stage work',
    alt: 'Jake on stage',
  },
  {
    id: 'two',
    asset: 'gallery-social-two',
    href: 'https://www.facebook.com/photo/?fbid=2',
    date: '2 Jan 2022',
    label: 'Training',
    alt: 'Jake training',
  },
]

afterEach(() => {
  cleanup()
  motionState.shouldReduceMotion = true
})

describe('ContactSocialCarousel', () => {
  it('renders mapped post media as secure external links', () => {
    const { container } = render(<ContactSocialCarousel posts={POSTS} />)

    expect(screen.getByAltText('Jake on stage')).toHaveAttribute(
      'src',
      '/api/assets/gallery-social-one',
    )
    expect(screen.getByAltText('Jake training')).toHaveAttribute(
      'src',
      '/api/assets/gallery-social-two',
    )
    expect(container.querySelector('[data-social-carousel-duplicate]')).not.toBeInTheDocument()

    screen.getAllByRole('link').forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  it('offers pause and resume controls when motion is enabled', () => {
    motionState.shouldReduceMotion = false
    const { container } = render(<ContactSocialCarousel posts={POSTS} />)

    expect(container.querySelector('[data-social-carousel-duplicate]')).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Pause' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: 'Resume' })).toHaveAttribute('aria-pressed', 'true')
  })
})

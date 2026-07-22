import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ContactMediaReel from './ContactMediaReel'

const motionState = vi.hoisted(() => ({ shouldReduceMotion: false }))

vi.mock('motion/react', () => ({
  useReducedMotion: () => motionState.shouldReduceMotion,
}))

const originalMatchMedia = window.matchMedia
const originalConnection = Object.getOwnPropertyDescriptor(navigator, 'connection')

function setMobileViewport(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === '(max-width: 640px)' ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function setSaveData(saveData) {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: {
      saveData,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  })
}

const defaultProps = {
  youtubeId: 'GbQomqb28os',
  poster: '/poster.webp',
  credit: 'Nike',
  creditHref: 'https://www.youtube.com/watch?v=GbQomqb28os',
}

describe('ContactMediaReel', () => {
  beforeEach(() => {
    motionState.shouldReduceMotion = false
    setMobileViewport(false)
    setSaveData(false)
  })

  afterEach(() => {
    cleanup()
    window.matchMedia = originalMatchMedia
    if (originalConnection) {
      Object.defineProperty(navigator, 'connection', originalConnection)
    } else {
      delete navigator.connection
    }
  })

  it('loads the official privacy-enhanced YouTube embed on larger screens', () => {
    const { container } = render(<ContactMediaReel {...defaultProps} />)

    const embed = screen.getByTitle("You Can't Stop Us — cinematic athlete reel")
    expect(embed).toHaveAttribute(
      'src',
      expect.stringContaining('https://www.youtube-nocookie.com/embed/GbQomqb28os'),
    )
    expect(embed.getAttribute('src')).toContain('autoplay=1')
    expect(embed.getAttribute('src')).toContain('mute=1')
    expect(embed.getAttribute('src')).toContain('loop=1')
    expect(embed.getAttribute('src')).toContain('playlist=GbQomqb28os')
    expect(embed.getAttribute('src')).toContain('enablejsapi=1')
    expect(embed).toHaveAttribute('loading', 'eager')
    expect(embed).toHaveAttribute('allow', expect.stringContaining('autoplay'))
    expect(container.querySelector('.contact-media-reel')).toHaveAttribute(
      'data-video-enabled',
      'true',
    )
  })

  it('includes a subtle secure credit link to the original upload', () => {
    render(<ContactMediaReel {...defaultProps} />)

    const credit = screen.getByRole('link', { name: /Film: Nike/i })
    expect(credit).toHaveAttribute('href', defaultProps.creditHref)
    expect(credit).toHaveAttribute('target', '_blank')
    expect(credit).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it.each([
    ['mobile', () => setMobileViewport(true)],
    ['reduced motion', () => {
      motionState.shouldReduceMotion = true
    }],
    ['save-data', () => setSaveData(true)],
  ])('keeps a poster-only presentation for %s', (_condition, configure) => {
    configure()
    const { container } = render(<ContactMediaReel {...defaultProps} />)

    expect(container.querySelector('iframe')).not.toBeInTheDocument()
    expect(container.querySelector('.contact-media-reel-poster')).toHaveAttribute(
      'src',
      '/poster.webp',
    )
    expect(container.querySelector('.contact-media-reel')).toHaveAttribute(
      'data-video-enabled',
      'false',
    )
  })

  it('falls back to the poster when the embed fails', () => {
    const { container } = render(<ContactMediaReel {...defaultProps} />)

    fireEvent.error(container.querySelector('iframe'))

    expect(container.querySelector('iframe')).not.toBeInTheDocument()
    expect(container.querySelector('.contact-media-reel-poster')).toBeInTheDocument()
  })
})

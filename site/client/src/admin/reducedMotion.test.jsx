import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ImageFramer from './components/ImageFramer'
import VideoTrimmer from './components/VideoTrimmer'
import VisitsChart from './components/VisitsChart'

// jsdom has no matchMedia; stand in for a device that does or doesn't ask for less motion.
function setReducedMotion(reduce) {
  window.matchMedia = vi.fn((query) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

// jsdom doesn't implement media playback.
HTMLMediaElement.prototype.pause = () => {}

afterEach(() => {
  cleanup()
  delete window.matchMedia
})

describe('video previews and reduced motion', () => {
  it('play by themselves normally', () => {
    setReducedMotion(false)
    const { container } = render(<VideoTrimmer src="/a.mp4" poster="/a.jpg" duration={10} value={null} onChange={() => {}} />)
    expect(container.querySelector('video').autoplay).toBe(true)
    expect(container.querySelector('video').controls).toBe(false)
  })

  it('stay on the first frame with play controls when the device asks for less motion', () => {
    setReducedMotion(true)
    const { container } = render(<VideoTrimmer src="/a.mp4" poster="/a.jpg" duration={10} value={null} onChange={() => {}} />)
    const video = container.querySelector('video')
    expect(video.autoplay).toBe(false)
    expect(video.controls).toBe(true)
    expect(video.getAttribute('poster')).toBe('/a.jpg')
  })

  it('framer: no autoplay, and a button plays the preview', () => {
    setReducedMotion(true)
    const play = vi.fn(() => Promise.resolve())
    const { container } = render(<ImageFramer src="/a.mp4" poster="/a.jpg" video value={null} onChange={() => {}} />)
    const video = container.querySelector('video')
    expect(video.autoplay).toBe(false)
    video.play = play
    fireEvent.click(screen.getByRole('button', { name: 'Play preview' }))
    expect(play).toHaveBeenCalled()
  })

  it('framer: autoplays and has no play button normally', () => {
    setReducedMotion(false)
    const { container } = render(<ImageFramer src="/a.mp4" video value={null} onChange={() => {}} />)
    expect(container.querySelector('video').autoplay).toBe(true)
    expect(screen.queryByRole('button', { name: /preview/i })).toBeNull()
  })
})

describe('visits chart tooltip', () => {
  it('groups thousands the same way as the scoreboard', () => {
    const daily = [
      { date: '2026-11-01', visits: 1234, previousVisits: 2345 },
      { date: '2026-11-02', visits: 10, previousVisits: 20 },
    ]
    const { container } = render(<VisitsChart daily={daily} />)
    fireEvent.keyDown(container.querySelector('.jd-chart-plot'), { key: 'Home' })
    const tip = container.querySelector('.jd-chart-tooltip')
    expect(tip.textContent).toContain('1,234 visits')
    expect(tip.textContent).toContain('2,345')
    expect(container.querySelector('figcaption').textContent).toContain('1,234')
  })
})

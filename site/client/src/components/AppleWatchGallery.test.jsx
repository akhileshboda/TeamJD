import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import results from '../../../public/content/results-library.json'
import AppleWatchGallery, {
  getGalleryIconSize,
  getGalleryMagnificationScale,
  getPanGeometry,
  getStoryOverlayGeometry,
} from './AppleWatchGallery'

const motionPreference = vi.hoisted(() => ({ reduced: false }))
const originalMatchMedia = window.matchMedia

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal()),
  useReducedMotion: () => motionPreference.reduced,
}))

vi.mock('../hooks/useJSON', () => ({
  useJSON: (path) => ({
    data: path === '/content/results-library.json' ? results : null,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useAssets', () => ({
  useAssets: () => (path) => path,
}))

vi.mock('./SectionReveal', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

function mockViewport({ desktop = true, phone = false } = {}) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: (
      (query === '(min-width: 1025px)' && desktop)
      || (query === '(max-width: 768px)' && phone)
    ),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeEach(() => mockViewport())

afterEach(() => {
  motionPreference.reduced = false
  window.matchMedia = originalMatchMedia
  cleanup()
})

function mockStorySheetGeometry(sheet, {
  frameHeight = 600,
  storyHeight = 720,
} = {}) {
  const frame = sheet.closest('.result-presentation')
  const story = sheet.querySelector('.result-overlay-story-anchor')
  const scroll = sheet.querySelector('.result-overlay-scroll')

  Object.defineProperty(frame, 'clientHeight', {
    configurable: true,
    value: frameHeight,
  })
  Object.defineProperty(story, 'scrollHeight', {
    configurable: true,
    value: storyHeight,
  })
  Object.defineProperty(scroll, 'clientHeight', {
    configurable: true,
    get: () => Number.parseFloat(sheet.style.height) || frameHeight * 0.55,
  })
  Object.defineProperty(scroll, 'scrollHeight', {
    configurable: true,
    value: storyHeight,
  })

  fireEvent(window, new Event('resize'))
  return { frame, scroll, story }
}

function fireCancelableWheel(target, deltaY) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY,
  })
  fireEvent(target, event)
  return event
}

describe('AppleWatchGallery canonical library', () => {
  it('renders the complete shared library and labels representative imagery honestly', async () => {
    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('button', { name: /^Open result:/ })).toHaveLength(results.length)

    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Open result: Competition Prep Reference — Stage preparation',
      })[0],
    )

    expect(
      await screen.findByText(/It is not presented as a Team JD client outcome/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/made the process feel personal from the first check-in/),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Result attributes')).not.toBeInTheDocument()
  })

  it('omits result attributes from the phone modal', () => {
    mockViewport({ desktop: false, phone: true })

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getAllByRole('button', { name: /^Open result:/ })[0])

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByLabelText('Result attributes')).not.toBeInTheDocument()
  })

  it('renders every result at the same desktop size', () => {
    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const shells = document.querySelectorAll('.watch-grid-item-shell')
    expect(shells).toHaveLength(results.length)
    shells.forEach((shell) => {
      expect(shell).toHaveStyle({ width: '70px', height: '70px' })
    })
  })

  it('uses the selected uniform diameter at desktop and mobile widths', () => {
    expect(getGalleryIconSize(1512)).toBe(70)
    expect(getGalleryIconSize(481)).toBe(70)
    expect(getGalleryIconSize(480)).toBe(62)
    expect(getGalleryIconSize(390)).toBe(62)
  })

  it('uses native scrolling when reduced motion is requested', () => {
    motionPreference.reduced = true

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    expect(document.querySelector('.watch-grid-viewport')).toHaveClass('watch-grid-viewport--scroll')
    expect(document.querySelector('.watch-grid-viewport')).not.toHaveClass('watch-grid-viewport--pannable')
  })
})

describe('AppleWatchGallery full-story overlays', () => {
  it('derives fit and overflow modes from measured content', () => {
    expect(getStoryOverlayGeometry(600, 250)).toEqual({
      frameHeight: 600,
      storyHeight: 250,
      minimumHeight: 330,
      displayHeight: 330,
      hasOverflow: false,
    })
    expect(getStoryOverlayGeometry(600, 480)).toEqual({
      frameHeight: 600,
      storyHeight: 480,
      minimumHeight: 330,
      displayHeight: 480,
      hasOverflow: false,
    })
    expect(getStoryOverlayGeometry(600, 800)).toEqual({
      frameHeight: 600,
      storyHeight: 800,
      minimumHeight: 330,
      displayHeight: 600,
      hasOverflow: true,
    })
  })

  it('shows the complete client story immediately without enabling scrolling', () => {
    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 480 })

    expect(sheet).toHaveAttribute('data-scroll-mode', 'fit')
    expect(sheet).toHaveStyle({ height: '480px' })
    expect(sheet).not.toHaveAttribute('aria-expanded')
    expect(sheet).not.toHaveAttribute('tabindex')
  })

  it('retains the 55% minimum and does not capture fit-story gestures', () => {
    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 250 })

    expect(sheet).toHaveAttribute('data-scroll-mode', 'fit')
    expect(sheet).toHaveStyle({ height: '330px' })
    expect(fireCancelableWheel(sheet, 180).defaultPrevented).toBe(false)
    expect(sheet).toHaveAttribute('data-scroll-lock', 'false')
  })

  it('remeasures fit content after dismissing and reopening the story', () => {
    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    let sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 480 })
    expect(sheet).toHaveStyle({ height: '480px' })

    fireEvent.click(screen.getByRole('button', { name: 'Hide result story' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show Story' }))

    sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 460 })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'fit')
    expect(sheet).toHaveStyle({ height: '460px' })
  })

  it('switches to full-frame overflow mode after responsive remeasurement', () => {
    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 480 })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'fit')

    mockStorySheetGeometry(sheet, { storyHeight: 800 })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'overflow')
    expect(sheet).toHaveStyle({ height: '600px' })
    expect(sheet).toHaveAttribute('tabindex', '0')
  })

  it('locks overflow wheel momentum and hands off at both bounds on the next burst', () => {
    vi.useFakeTimers()

    try {
      render(
        <MemoryRouter>
          <AppleWatchGallery />
        </MemoryRouter>,
      )

      const sheet = screen.getByRole('group', {
        name: 'ANB champion with stage-ready control',
      })
      const { scroll } = mockStorySheetGeometry(sheet, { storyHeight: 800 })

      expect(fireCancelableWheel(sheet, 160).defaultPrevented).toBe(true)
      expect(scroll.scrollTop).toBe(160)
      expect(sheet).toHaveAttribute('data-scroll-lock', 'true')

      expect(fireCancelableWheel(sheet, 80).defaultPrevented).toBe(true)
      expect(scroll.scrollTop).toBe(200)

      act(() => {
        vi.advanceTimersByTime(121)
      })
      expect(sheet).toHaveAttribute('data-scroll-lock', 'false')
      expect(fireCancelableWheel(sheet, 80).defaultPrevented).toBe(false)

      act(() => {
        vi.advanceTimersByTime(121)
      })
      expect(fireCancelableWheel(sheet, -200).defaultPrevented).toBe(true)
      expect(scroll.scrollTop).toBe(0)
      expect(fireCancelableWheel(sheet, -80).defaultPrevented).toBe(true)

      act(() => {
        vi.advanceTimersByTime(121)
      })
      expect(fireCancelableWheel(sheet, -80).defaultPrevented).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('docks the complete story in the phone modal without capturing gestures', () => {
    mockViewport({ desktop: false, phone: true })

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open result: ANB champion with stage-ready control',
      }),
    )

    const sheet = screen.getByRole('document', {
      name: 'ANB champion with stage-ready control',
    })

    expect(sheet).toHaveAttribute('data-scroll-mode', 'docked')
    expect(sheet).not.toHaveAttribute('tabindex')
    expect(screen.queryByRole('button', { name: 'Hide result story' })).not.toBeInTheDocument()
    const closeButton = screen.getByRole('button', { name: 'Close result details' })
    expect(closeButton).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(closeButton).toHaveFocus()

    const touchMove = new TouchEvent('touchmove', {
      bubbles: true,
      cancelable: true,
      touches: [{ clientY: 120 }],
    })
    fireEvent(sheet, touchMove)
    expect(touchMove.defaultPrevented).toBe(false)
  })

  it('uses keyboard scrolling only for overflow stories', () => {
    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    const { scroll } = mockStorySheetGeometry(sheet, { storyHeight: 800 })

    fireEvent.keyDown(sheet, { key: 'PageDown' })
    expect(scroll.scrollTop).toBe(200)

    fireEvent.keyDown(sheet, { key: 'Home' })
    expect(scroll.scrollTop).toBe(0)
  })
})

describe('AppleWatchGallery magnification', () => {
  const desktopViewport = { viewportWidth: 1000, viewportHeight: 600 }

  it('uses the desktop peak, wider focus boundary, and stronger edge scale', () => {
    expect(getGalleryMagnificationScale({
      ...desktopViewport,
      iconX: 500,
      iconY: 300,
    })).toBeCloseTo(1.45)
    expect(getGalleryMagnificationScale({
      ...desktopViewport,
      iconX: 800,
      iconY: 300,
    })).toBeGreaterThan(1)
    expect(getGalleryMagnificationScale({
      ...desktopViewport,
      iconX: 875,
      iconY: 300,
    })).toBeCloseTo(1)
    expect(getGalleryMagnificationScale({
      ...desktopViewport,
      iconX: 1000,
      iconY: 300,
    })).toBeCloseTo(0.72)
    expect(getGalleryMagnificationScale({
      ...desktopViewport,
      iconX: 500,
      iconY: 600,
    })).toBeCloseTo(0.72)
  })

  it('clamps corners to the edge scale and remains symmetrical', () => {
    expect(getGalleryMagnificationScale({
      ...desktopViewport,
      iconX: 1000,
      iconY: 600,
    })).toBeCloseTo(0.72)

    const left = getGalleryMagnificationScale({
      ...desktopViewport,
      iconX: 200,
      iconY: 300,
    })
    const right = getGalleryMagnificationScale({
      ...desktopViewport,
      iconX: 800,
      iconY: 300,
    })
    expect(left).toBeCloseTo(right)
  })

  it('uses the adaptive mobile profile and disables scaling for reduced motion', () => {
    expect(getGalleryMagnificationScale({
      viewportWidth: 390,
      viewportHeight: 360,
      iconX: 195,
      iconY: 180,
      isMobile: true,
    })).toBeCloseTo(1.3)
    expect(getGalleryMagnificationScale({
      viewportWidth: 390,
      viewportHeight: 360,
      iconX: 390,
      iconY: 180,
      isMobile: true,
    })).toBeCloseTo(0.8)
    expect(getGalleryMagnificationScale({
      ...desktopViewport,
      iconX: 500,
      iconY: 300,
      reducedMotion: true,
    })).toBe(1)
  })
})

describe('AppleWatchGallery pan geometry', () => {
  it('exposes the full canvas overflow and starts from the midpoint', () => {
    expect(
      getPanGeometry(
        { width: 1322, height: 1258 },
        { width: 652, height: 540 },
      ),
    ).toEqual({
      overflowX: 670,
      overflowY: 718,
      canPan: true,
      constraints: {
        left: -670,
        right: 0,
        top: -718,
        bottom: 0,
      },
      initial: {
        x: -335,
        y: -359,
      },
    })
  })

  it('disables panning when the canvas fits inside the viewport', () => {
    expect(
      getPanGeometry(
        { width: 640, height: 480 },
        { width: 900, height: 600 },
      ),
    ).toEqual({
      overflowX: 0,
      overflowY: 0,
      canPan: false,
      constraints: {
        left: -0,
        right: 0,
        top: -0,
        bottom: 0,
      },
      initial: {
        x: -0,
        y: -0,
      },
    })
  })

  it('recalculates bounds when the viewport changes', () => {
    const desktop = getPanGeometry(
      { width: 1322, height: 1258 },
      { width: 652, height: 540 },
    )
    const tablet = getPanGeometry(
      { width: 1322, height: 1258 },
      { width: 900, height: 700 },
    )

    expect(tablet.constraints.left).toBeGreaterThan(desktop.constraints.left)
    expect(tablet.constraints.top).toBeGreaterThan(desktop.constraints.top)
    expect(tablet.initial.x).toBe(tablet.constraints.left / 2)
    expect(tablet.initial.y).toBe(tablet.constraints.top / 2)
  })
})

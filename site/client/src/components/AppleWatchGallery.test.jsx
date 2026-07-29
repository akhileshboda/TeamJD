import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import results from '../../../public/content/results-library.json'
import AppleWatchGallery, {
  getGalleryIconSize,
  getGalleryMagnificationScale,
  getPanGeometry,
} from './AppleWatchGallery'

const motionPreference = vi.hoisted(() => ({ reduced: false }))

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

afterEach(() => {
  motionPreference.reduced = false
  cleanup()
})

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

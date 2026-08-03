import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import results from '../../../public/content/results-library.json'
import AppleWatchGallery, {
  canUseEnhancedGalleryDrag,
  centerGalleryViewport,
  getGalleryIconSize,
  getGalleryMagnificationScale,
  getPanGeometry,
} from './AppleWatchGallery'
import {
  getBoundedStoryOverlayHeight,
  getProgressiveStoryOverlayGeometry,
  getStoryOverlayGeometry,
} from './ResultPresentation'

const motionPreference = vi.hoisted(() => ({ reduced: false }))
const motionAnimations = vi.hoisted(() => ({
  autoFinish: true,
  records: [],
}))
const originalMatchMedia = window.matchMedia
const originalIntersectionObserver = window.IntersectionObserver
const originalResizeObserver = globalThis.ResizeObserver
const originalScrollBy = window.scrollBy
const originalPointerEvent = window.PointerEvent
const originalUserAgentData = navigator.userAgentData
const hadOwnUserAgentData = Object.prototype.hasOwnProperty.call(navigator, 'userAgentData')

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal()),
  animate: (value, target, options = {}) => {
    const record = {
      value,
      target,
      options,
      stopped: false,
    }
    const controls = {
      stop: () => {
        record.stopped = true
      },
    }
    record.controls = controls
    motionAnimations.records.push(record)
    if (motionAnimations.autoFinish) {
      value.set(target)
      options.onComplete?.()
    }
    return controls
  },
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

function mockViewport({
  desktop = true,
  phone = false,
  finePointer = true,
  hover = true,
  coarsePointer = false,
} = {}) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: (
      (query === '(min-width: 1025px)' && desktop)
      || (query === '(max-width: 768px)' && phone)
      || (query === '(pointer: fine)' && finePointer)
      || (query === '(hover: hover)' && hover)
      || (query === '(any-pointer: coarse)' && coarsePointer)
    ),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }))
}

function mockUserAgentData(brands) {
  Object.defineProperty(navigator, 'userAgentData', {
    configurable: true,
    value: brands === undefined ? undefined : { brands },
  })
}

beforeEach(() => {
  motionAnimations.autoFinish = true
  motionAnimations.records = []
  mockViewport()
  mockUserAgentData([{ brand: 'Chromium', version: '140' }])
  window.PointerEvent = class PointerEvent extends Event {}
  window.scrollBy = vi.fn()
})

afterEach(() => {
  motionPreference.reduced = false
  window.matchMedia = originalMatchMedia
  window.IntersectionObserver = originalIntersectionObserver
  window.scrollBy = originalScrollBy
  window.PointerEvent = originalPointerEvent
  globalThis.ResizeObserver = originalResizeObserver
  if (hadOwnUserAgentData) {
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      value: originalUserAgentData,
    })
  } else {
    delete navigator.userAgentData
  }
  cleanup()
})

function mockGalleryFrame({ width = 620, height = 620 } = {}) {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(callback) {
      this.callback = callback
    }

    observe(element) {
      if (!element.classList.contains('watch-grid-viewport')) return
      Object.defineProperties(element, {
        clientWidth: { configurable: true, value: width },
        clientHeight: { configurable: true, value: height },
      })
      this.callback([{ target: element }])
    }

    disconnect() {}
  }
}

function mockStorySheetGeometry(sheet, {
  frameHeight = 600,
  storyHeight = 720,
  headerHeight = 56,
} = {}) {
  const frame = sheet.closest('.result-presentation')
  const header = sheet.querySelector('.result-overlay-header')
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
  if (header) {
    Object.defineProperty(header, 'clientHeight', {
      configurable: true,
      value: headerHeight,
    })
  }
  Object.defineProperty(scroll, 'clientHeight', {
    configurable: true,
    get: () => Math.max(
      0,
      (Number.parseFloat(sheet.style.height) || getBoundedStoryOverlayHeight(frameHeight))
        - headerHeight,
    ),
  })
  Object.defineProperty(scroll, 'scrollHeight', {
    configurable: true,
    value: storyHeight,
  })

  fireEvent(window, new Event('resize'))
  return { frame, scroll, story }
}

function mockDockedStoryGeometry(sheet, {
  frameHeight = 800,
  overlayHeight = 260,
  storyViewportHeight = 204,
  storyHeight = 200,
} = {}) {
  const frame = sheet.closest('.result-presentation')
  const overlay = sheet
  const story = sheet.querySelector('.result-overlay-story-anchor')
  const scroll = sheet.querySelector('.result-overlay-scroll')

  Object.defineProperties(frame, {
    clientHeight: { configurable: true, value: frameHeight },
  })
  Object.defineProperties(overlay, {
    clientHeight: { configurable: true, value: overlayHeight },
  })
  Object.defineProperties(story, {
    scrollHeight: { configurable: true, value: storyHeight },
  })
  Object.defineProperties(scroll, {
    clientHeight: { configurable: true, value: storyViewportHeight },
    scrollHeight: { configurable: true, value: storyHeight },
  })

  fireEvent(window, new Event('resize'))
  return { frame, overlay, scroll, story }
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

function progressMotionAnimation(record, value) {
  act(() => record.value.set(value))
}

function finishMotionAnimation(record) {
  act(() => {
    record.value.set(record.target)
    record.options.onComplete?.()
  })
}

describe('AppleWatchGallery capability policy', () => {
  const capableChromium = {
    brands: [{ brand: 'Chromium', version: '140' }],
    finePointer: true,
    hover: true,
    coarsePointer: false,
    pointerEvents: true,
    resizeObserver: true,
  }

  it('allows enhanced drag only for fully capable Chromium environments', () => {
    expect(canUseEnhancedGalleryDrag(capableChromium)).toBe(true)
  })

  it.each([
    ['iPad or touch-enabled Chromium', { coarsePointer: true }],
    ['touch-only Chromium', { finePointer: false, hover: false, coarsePointer: true }],
    ['Safari or Firefox', { brands: [] }],
    ['missing Client Hints', { brands: undefined }],
    ['missing Pointer Events', { pointerEvents: false }],
    ['missing ResizeObserver', { resizeObserver: false }],
  ])('defaults %s to native scrolling', (_label, override) => {
    expect(canUseEnhancedGalleryDrag({
      ...capableChromium,
      ...override,
    })).toBe(false)
  })

  it('switches from enhanced drag to native scrolling when coarse input appears', () => {
    mockGalleryFrame()
    let coarsePointer = false
    const capabilityListeners = new Set()

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      get matches() {
        if (query === '(min-width: 1025px)') return true
        if (query === '(max-width: 768px)') return false
        if (query === '(pointer: fine)') return true
        if (query === '(hover: hover)') return true
        if (query === '(any-pointer: coarse)') return coarsePointer
        return false
      },
      media: query,
      addEventListener: (_event, callback) => capabilityListeners.add(callback),
      removeEventListener: (_event, callback) => capabilityListeners.delete(callback),
      addListener: (callback) => capabilityListeners.add(callback),
      removeListener: (callback) => capabilityListeners.delete(callback),
    }))

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    expect(document.querySelector('.watch-grid-canvas')).toHaveAttribute('data-gallery-renderer', 'enhanced')

    act(() => {
      coarsePointer = true
      capabilityListeners.forEach((listener) => listener())
    })

    expect(document.querySelector('.watch-grid-viewport')).toHaveClass('watch-grid-viewport--scroll')
    expect(document.querySelector('.watch-grid-canvas')).toHaveAttribute('data-gallery-renderer', 'native')
  })
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

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.queryByLabelText('Result attributes')).not.toBeInTheDocument()
    expect(dialog.querySelector('.result-media-foreground')).toBeInTheDocument()
    expect(dialog.querySelector('.result-media-ambient')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders every result at the same desktop size', () => {
    mockGalleryFrame()

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
    expect(document.querySelector('.watch-grid-edge-overlay')).not.toBeInTheDocument()
  })

  it('uses the selected uniform diameter at desktop and mobile widths', () => {
    expect(getGalleryIconSize(1512)).toBe(70)
    expect(getGalleryIconSize(481)).toBe(70)
    expect(getGalleryIconSize(480)).toBe(62)
    expect(getGalleryIconSize(390)).toBe(62)
  })

  it('uses native scrolling when reduced motion is requested', () => {
    motionPreference.reduced = true
    mockGalleryFrame()

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    expect(document.querySelector('.watch-grid-viewport')).toHaveClass('watch-grid-viewport--scroll')
    expect(document.querySelector('.watch-grid-viewport')).not.toHaveClass('watch-grid-viewport--pannable')
    expect(document.querySelector('.watch-grid-edge-overlay')).toBeInTheDocument()
  })

  it('uses native scrolling and keeps the edge fade outside the scroll viewport on phones', () => {
    mockViewport({ desktop: false, phone: true })

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const viewport = document.querySelector('.watch-grid-viewport')
    const edgeOverlay = document.querySelector('.watch-grid-edge-overlay')

    expect(viewport).toHaveClass('watch-grid-viewport--scroll')
    expect(viewport).not.toHaveClass('watch-grid-viewport--pannable')
    expect(edgeOverlay).toBeInTheDocument()
    expect(viewport).not.toContainElement(edgeOverlay)
    expect(edgeOverlay.parentElement).toHaveClass('results-browser')
  })

  it('recenters the native gallery after a filter change', () => {
    mockViewport({ desktop: false, phone: true })

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const viewport = document.querySelector('.watch-grid-viewport')
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 300 },
      clientHeight: { configurable: true, value: 240 },
      scrollWidth: { configurable: true, value: 700 },
      scrollHeight: { configurable: true, value: 520 },
    })
    viewport.scrollLeft = 0
    viewport.scrollTop = 0

    fireEvent.click(screen.getByRole('button', { name: 'Posing' }))

    expect(viewport.scrollLeft).toBe(200)
    expect(viewport.scrollTop).toBe(140)
  })

  it('keeps only the closest center-zone result highlighted in native mode', () => {
    mockViewport({
      desktop: false,
      phone: false,
      finePointer: false,
      hover: false,
      coarsePointer: true,
    })
    let intersectionCallback

    window.IntersectionObserver = class IntersectionObserver {
      constructor(callback) {
        intersectionCallback = callback
      }

      observe() {}

      disconnect() {}
    }

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const shells = document.querySelectorAll('.watch-grid-item-shell')
    const rootBounds = { left: 0, top: 0, width: 100, height: 100 }

    act(() => {
      intersectionCallback([
        {
          target: shells[0],
          isIntersecting: true,
          boundingClientRect: { left: 0, top: 0, width: 10, height: 10 },
          rootBounds,
        },
        {
          target: shells[1],
          isIntersecting: true,
          boundingClientRect: { left: 45, top: 45, width: 10, height: 10 },
          rootBounds,
        },
      ])
    })

    expect(shells[1]).toHaveClass('is-native-focus')
    expect(shells[0]).not.toHaveClass('is-native-focus')

    act(() => {
      intersectionCallback([{
        target: shells[1],
        isIntersecting: false,
        boundingClientRect: { left: 45, top: 45, width: 10, height: 10 },
        rootBounds,
      }])
    })

    expect(shells[0]).toHaveClass('is-native-focus')
    expect(shells[1]).not.toHaveClass('is-native-focus')
  })

  it('uses the static native renderer for non-Chromium desktop browsers', async () => {
    mockGalleryFrame()
    mockUserAgentData(undefined)

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const viewport = document.querySelector('.watch-grid-viewport')
    const canvas = document.querySelector('.watch-grid-canvas')
    const shells = document.querySelectorAll('.watch-grid-item-shell')

    expect(viewport).toHaveClass('watch-grid-viewport--scroll')
    expect(viewport).not.toHaveClass('watch-grid-viewport--pannable')
    expect(canvas).toHaveAttribute('data-gallery-renderer', 'native')
    shells.forEach((shell) => {
      expect(shell).toHaveAttribute('data-gallery-renderer', 'native')
    })
    expect(document.querySelector('.watch-grid-edge-overlay')).toBeInTheDocument()
    expect(await screen.findByRole('note')).toHaveTextContent('Scroll to explore')
  })

  it('uses native rendering when a Chromium environment exposes a coarse pointer', () => {
    mockGalleryFrame()
    mockViewport({
      desktop: false,
      phone: false,
      finePointer: true,
      hover: true,
      coarsePointer: true,
    })

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    expect(document.querySelector('.watch-grid-viewport')).toHaveClass('watch-grid-viewport--scroll')
    expect(document.querySelector('.watch-grid-canvas')).toHaveAttribute('data-gallery-renderer', 'native')
    expect(document.querySelector('.watch-grid-item-shell')).toHaveAttribute('data-gallery-renderer', 'native')
  })

  it('shows a non-blocking drag affordance only after desktop overflow is measured', async () => {
    mockGalleryFrame()

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const viewport = document.querySelector('.watch-grid-viewport')
    const hint = await screen.findByRole('note')

    expect(viewport).toHaveClass('watch-grid-viewport--pannable')
    expect(document.querySelector('.watch-grid-canvas')).toHaveAttribute('data-gallery-renderer', 'enhanced')
    expect(document.querySelector('.watch-grid-item-shell')).toHaveAttribute('data-gallery-renderer', 'enhanced')
    expect(viewport).toHaveAttribute('aria-describedby', 'watch-grid-interaction-hint')
    expect(hint).toHaveTextContent('Drag to explore')
  })

  it('does not render the desktop affordance at tablet or mobile breakpoints', () => {
    mockGalleryFrame()
    mockViewport({ desktop: false, phone: false })

    const { unmount } = render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    unmount()

    mockViewport({ desktop: false, phone: true })
    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('uses native-scroll copy for reduced-motion desktop users', async () => {
    motionPreference.reduced = true
    mockGalleryFrame()

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('note')).toHaveTextContent('Scroll to explore')
    expect(document.querySelector('.watch-grid-viewport')).toHaveClass('watch-grid-viewport--scroll')
  })

  it.each([
    ['pointer input', (viewport) => fireEvent.pointerDown(viewport)],
    ['wheel input', (viewport) => fireEvent.wheel(viewport, { deltaY: 80 })],
    ['keyboard input', (viewport) => fireEvent.keyDown(viewport, { key: 'ArrowRight' })],
    ['thumbnail focus', () => fireEvent.focus(screen.getAllByRole('button', { name: /^Open result:/ })[0])],
  ])('dismisses the desktop affordance after %s', async (_label, interact) => {
    mockGalleryFrame()

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    await screen.findByRole('note')
    interact(document.querySelector('.watch-grid-viewport'))

    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument())
  })

  it('keeps the affordance dismissed through filtering', async () => {
    mockGalleryFrame()

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    await screen.findByRole('note')
    fireEvent.pointerDown(document.querySelector('.watch-grid-viewport'))
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Posing' }))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('preserves thumbnail selection and desktop panning when the hint dismisses', async () => {
    mockGalleryFrame()

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    await screen.findByRole('note')
    const viewport = document.querySelector('.watch-grid-viewport')
    const resultButtons = screen.getAllByRole('button', { name: /^Open result:/ })

    fireEvent.pointerDown(resultButtons[1])
    fireEvent.click(resultButtons[1])

    expect(resultButtons[1]).toHaveAttribute('aria-pressed', 'true')
    expect(viewport).toHaveClass('watch-grid-viewport--pannable')
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument())
  })
})

describe('AppleWatchGallery full-story overlays', () => {
  it('retains adaptive geometry for non-gallery presentations', () => {
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

  it('clamps the bounded desktop story frame to its parent', () => {
    expect(getBoundedStoryOverlayHeight(200)).toBe(200)
    expect(getBoundedStoryOverlayHeight(280)).toBeCloseTo(243.2)
    expect(getBoundedStoryOverlayHeight(600)).toBeCloseTo(307.2)
    expect(getBoundedStoryOverlayHeight(800)).toBeCloseTo(345.6)
  })

  it('derives progressive reveal and final overflow boundaries from content', () => {
    expect(getProgressiveStoryOverlayGeometry({
      frameHeight: 600,
      storyHeight: 480,
      headerHeight: 56,
    })).toMatchObject({
      restingHeight: 307.2,
      maximumHeight: 536,
      displayHeight: 307.2,
      canExpand: true,
      hasOverflow: false,
    })

    expect(getProgressiveStoryOverlayGeometry({
      frameHeight: 600,
      storyHeight: 800,
      headerHeight: 56,
      currentHeight: 600,
    })).toMatchObject({
      restingHeight: 307.2,
      maximumHeight: 600,
      displayHeight: 600,
      canExpand: false,
      hasOverflow: true,
    })
  })

  it('uses the same bounded frame for client and representative stories', () => {
    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 480 })

    expect(sheet).toHaveAttribute('data-scroll-mode', 'reveal')
    expect(sheet).toHaveAttribute('data-reveal-state', 'compact')
    expect(sheet).toHaveStyle({ height: '307.2px' })
    expect(sheet.querySelector('.result-overlay-header')).not.toBeNull()
    expect(sheet.querySelector('.result-overlay-scroll')).not.toContainElement(
      sheet.querySelector('.result-overlay-header'),
    )

    fireEvent.click(screen.getAllByRole('button', {
      name: 'Open result: Competition Prep Reference — Stage preparation',
    })[0])

    const representativeSheet = screen.getByRole('group', {
      name: 'Competition Prep Reference — Stage preparation',
    })
    mockStorySheetGeometry(representativeSheet, { storyHeight: 250 })

    expect(representativeSheet).toHaveAttribute('data-scroll-mode', 'fit')
    expect(representativeSheet).toHaveAttribute('data-reveal-state', 'revealed')
    expect(representativeSheet).toHaveStyle({ height: '307.2px' })
  })

  it('does not capture gestures when a short story fits the bounded body', () => {
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
    expect(sheet).toHaveStyle({ height: '307.2px' })
    expect(fireCancelableWheel(sheet, 180).defaultPrevented).toBe(false)
    expect(sheet).toHaveAttribute('data-scroll-lock', 'false')
  })

  it('resets the expanded frame after dismissing and reopening the story', () => {
    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    let sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 480 })
    fireCancelableWheel(sheet, 100)
    expect(sheet).toHaveStyle({ height: '407.2px' })
    expect(sheet).toHaveAttribute('data-reveal-state', 'expanding')

    fireEvent.click(screen.getByRole('button', { name: 'Hide result story' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show Story' }))

    sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 480 })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'reveal')
    expect(sheet).toHaveAttribute('data-reveal-state', 'compact')
    expect(sheet).toHaveStyle({ height: '307.2px' })
  })

  it('reveals the story before applying residual input to internal overflow', () => {
    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    const { scroll } = mockStorySheetGeometry(sheet, { storyHeight: 800 })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'reveal')
    expect(sheet).toHaveStyle({ height: '307.2px' })

    expect(fireCancelableWheel(sheet, 100).defaultPrevented).toBe(true)
    expect(sheet).toHaveStyle({ height: '407.2px' })
    expect(scroll.scrollTop).toBe(0)

    expect(fireCancelableWheel(sheet, 250).defaultPrevented).toBe(true)
    expect(sheet).toHaveAttribute('data-scroll-mode', 'overflow')
    expect(sheet).toHaveStyle({ height: '600px' })
    expect(scroll.scrollTop).toBeCloseTo(57.2)
    expect(sheet).toHaveAttribute('tabindex', '0')
  })

  it('smooths desktop reveal with the configured damped spring and retargets in flight', () => {
    motionAnimations.autoFinish = false

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 800 })

    fireCancelableWheel(sheet, 100)
    const firstReveal = motionAnimations.records.at(-1)
    expect(firstReveal.target).toBeCloseTo(407.2)
    expect(firstReveal.options).toMatchObject({
      type: 'spring',
      stiffness: 500,
      damping: 50,
      mass: 0.7,
      restDelta: 0.5,
      restSpeed: 10,
    })
    expect(sheet).toHaveStyle({ height: '307.2px' })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'reveal')

    progressMotionAnimation(firstReveal, 360)
    expect(sheet).toHaveStyle({ height: '360px' })

    fireCancelableWheel(sheet, 80)
    const retargetedReveal = motionAnimations.records.at(-1)
    expect(firstReveal.stopped).toBe(true)
    expect(retargetedReveal.target).toBeCloseTo(487.2)
    expect(sheet).toHaveStyle({ height: '360px' })

    finishMotionAnimation(retargetedReveal)
    expect(sheet).toHaveStyle({ height: '487.2px' })
    expect(sheet).toHaveAttribute('data-reveal-state', 'expanding')
  })

  it('queues overflow input until reveal settles, then smooths the story position', () => {
    motionAnimations.autoFinish = false

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    const { scroll } = mockStorySheetGeometry(sheet, { storyHeight: 800 })

    fireCancelableWheel(sheet, 350)
    const revealAnimation = motionAnimations.records.at(-1)
    expect(revealAnimation.target).toBe(600)
    expect(motionAnimations.records).toHaveLength(1)
    expect(sheet).toHaveAttribute('data-scroll-mode', 'reveal')
    expect(scroll.scrollTop).toBe(0)

    finishMotionAnimation(revealAnimation)
    const scrollAnimation = motionAnimations.records.at(-1)
    expect(motionAnimations.records).toHaveLength(2)
    expect(scrollAnimation.target).toBeCloseTo(57.2)
    expect(sheet).toHaveAttribute('data-scroll-mode', 'overflow')
    expect(scroll.scrollTop).toBe(0)

    progressMotionAnimation(scrollAnimation, 30)
    expect(scroll.scrollTop).toBe(30)
    finishMotionAnimation(scrollAnimation)
    expect(scroll.scrollTop).toBeCloseTo(57.2)
  })

  it('retargets smooth overflow when direction changes and hands off only after settling', () => {
    motionAnimations.autoFinish = false

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    const { scroll } = mockStorySheetGeometry(sheet, { storyHeight: 800 })

    fireCancelableWheel(sheet, 293)
    finishMotionAnimation(motionAnimations.records.at(-1))
    expect(sheet).toHaveAttribute('data-scroll-mode', 'overflow')

    fireCancelableWheel(sheet, 160)
    const downwardScroll = motionAnimations.records.at(-1)
    expect(downwardScroll.target).toBe(160)
    expect(scroll.scrollTop).toBe(0)

    fireCancelableWheel(sheet, -40)
    const reversedScroll = motionAnimations.records.at(-1)
    expect(downwardScroll.stopped).toBe(true)
    expect(reversedScroll.target).toBe(120)
    finishMotionAnimation(reversedScroll)
    expect(scroll.scrollTop).toBe(120)

    fireCancelableWheel(sheet, 200)
    const boundaryScroll = motionAnimations.records.at(-1)
    expect(boundaryScroll.target).toBe(256)
    expect(fireCancelableWheel(sheet, 80).defaultPrevented).toBe(true)
    const boundaryRetarget = motionAnimations.records.at(-1)
    finishMotionAnimation(boundaryRetarget)
    expect(scroll.scrollTop).toBe(256)
    expect(fireCancelableWheel(sheet, 80).defaultPrevented).toBe(false)
  })

  it('cancels active smoothing and restores exact values when the story resets', () => {
    motionAnimations.autoFinish = false

    const { unmount } = render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    const { scroll } = mockStorySheetGeometry(sheet, { storyHeight: 800 })
    fireCancelableWheel(sheet, 100)
    const revealAnimation = motionAnimations.records.at(-1)
    progressMotionAnimation(revealAnimation, 350)

    fireEvent.click(screen.getByRole('button', { name: 'Hide result story' }))
    expect(revealAnimation.stopped).toBe(true)
    expect(scroll.scrollTop).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Show Story' }))
    const reopenedSheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(reopenedSheet, { storyHeight: 800 })
    expect(reopenedSheet).toHaveStyle({ height: '307.2px' })
    expect(reopenedSheet).toHaveAttribute('data-reveal-state', 'compact')

    fireCancelableWheel(reopenedSheet, 100)
    const nextAnimation = motionAnimations.records.at(-1)
    unmount()
    expect(nextAnimation.stopped).toBe(true)
  })

  it('hands later input back to the page when the complete story fits after reveal', () => {
    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    const { scroll } = mockStorySheetGeometry(sheet, { storyHeight: 480 })

    expect(fireCancelableWheel(sheet, 300).defaultPrevented).toBe(true)
    expect(sheet).toHaveStyle({ height: '536px' })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'fit')
    expect(sheet).toHaveAttribute('data-reveal-state', 'revealed')
    expect(scroll.scrollTop).toBe(0)

    expect(fireCancelableWheel(sheet, 80).defaultPrevented).toBe(false)
  })

  it('locks moving overflow and hands off once each boundary has settled', () => {
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

      expect(fireCancelableWheel(sheet, 293).defaultPrevented).toBe(true)
      expect(sheet).toHaveStyle({ height: '600px' })
      expect(scroll.scrollTop).toBe(0)
      expect(sheet).toHaveAttribute('data-scroll-mode', 'overflow')

      expect(fireCancelableWheel(sheet, 160).defaultPrevented).toBe(true)
      expect(scroll.scrollTop).toBe(160)
      expect(sheet).toHaveAttribute('data-scroll-lock', 'true')

      expect(fireCancelableWheel(sheet, 80).defaultPrevented).toBe(true)
      expect(scroll.scrollTop).toBe(240)

      scroll.scrollTop = 256

      act(() => {
        vi.advanceTimersByTime(121)
      })
      expect(sheet).toHaveAttribute('data-scroll-lock', 'false')
      expect(fireCancelableWheel(sheet, 80).defaultPrevented).toBe(false)

      act(() => {
        vi.advanceTimersByTime(121)
      })
      scroll.scrollTop = 200
      expect(fireCancelableWheel(sheet, -200).defaultPrevented).toBe(true)
      expect(scroll.scrollTop).toBe(0)
      expect(fireCancelableWheel(sheet, -80).defaultPrevented).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reveals the desktop story before consuming touch movement', () => {
    motionAnimations.autoFinish = false

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    const { scroll } = mockStorySheetGeometry(sheet, { storyHeight: 800 })

    fireEvent.touchStart(sheet, { touches: [{ clientY: 300 }] })
    const move = new TouchEvent('touchmove', {
      bubbles: true,
      cancelable: true,
      touches: [{ clientY: 200 }],
    })
    fireEvent(sheet, move)

    expect(move.defaultPrevented).toBe(true)
    expect(sheet).toHaveStyle({ height: '407.2px' })
    expect(sheet).toHaveAttribute('data-reveal-state', 'expanding')
    expect(scroll.scrollTop).toBe(0)
    expect(motionAnimations.records).toHaveLength(0)
    fireEvent.touchEnd(sheet)
  })

  it('resets progressive reveal when filtering remounts the selected result', () => {
    motionAnimations.autoFinish = false

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    let sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 480 })
    fireCancelableWheel(sheet, 100)
    const activeReveal = motionAnimations.records.at(-1)
    progressMotionAnimation(activeReveal, 360)
    expect(sheet).toHaveStyle({ height: '360px' })

    fireEvent.click(screen.getByRole('button', { name: 'Competition Prep' }))
    expect(activeReveal.stopped).toBe(true)

    sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 480 })
    expect(sheet).toHaveStyle({ height: '307.2px' })
    expect(sheet).toHaveAttribute('data-reveal-state', 'compact')
  })

  it('resets progressive reveal after leaving and re-entering the desktop layout', () => {
    motionAnimations.autoFinish = false

    const mediaState = { desktop: true }
    const mediaQueries = new Map()
    window.matchMedia = vi.fn().mockImplementation((query) => {
      if (!mediaQueries.has(query)) {
        const listeners = new Set()
        mediaQueries.set(query, {
          get matches() {
            if (query === '(min-width: 1025px)') return mediaState.desktop
            if (query === '(max-width: 768px)') return false
            if (query === '(pointer: fine)') return true
            if (query === '(hover: hover)') return true
            return false
          },
          media: query,
          addEventListener: (_type, listener) => listeners.add(listener),
          removeEventListener: (_type, listener) => listeners.delete(listener),
          addListener: (listener) => listeners.add(listener),
          removeListener: (listener) => listeners.delete(listener),
          notify: () => listeners.forEach((listener) => listener()),
        })
      }
      return mediaQueries.get(query)
    })

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    let sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 480 })
    fireCancelableWheel(sheet, 100)
    const activeReveal = motionAnimations.records.at(-1)
    progressMotionAnimation(activeReveal, 360)
    expect(sheet).toHaveStyle({ height: '360px' })

    act(() => {
      mediaState.desktop = false
      mediaQueries.get('(min-width: 1025px)').notify()
    })
    expect(activeReveal.stopped).toBe(true)
    expect(sheet.closest('.result-presentation')).toHaveAttribute('data-story-layout', 'docked')

    act(() => {
      mediaState.desktop = true
      mediaQueries.get('(min-width: 1025px)').notify()
    })
    sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 480 })
    expect(sheet.closest('.result-presentation')).toHaveAttribute('data-story-layout', 'overlay')
    expect(sheet).toHaveStyle({ height: '307.2px' })
    expect(sheet).toHaveAttribute('data-reveal-state', 'compact')
  })

  it('uses the bounded header/body structure in the tablet preview', () => {
    mockViewport({
      desktop: false,
      phone: false,
      finePointer: false,
      hover: false,
      coarsePointer: true,
    })

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    const presentation = sheet.closest('.result-presentation')
    const header = sheet.querySelector('.result-overlay-header')

    expect(presentation).toHaveAttribute('data-story-layout', 'docked')
    expect(presentation).toHaveAttribute('data-story-frame', 'bounded')
    expect(header).toHaveTextContent('Competition Prep')
    expect(header.querySelector('.result-overlay-header-action')).toBeEmptyDOMElement()
    expect(sheet.querySelector('.result-overlay-scroll')).not.toContainElement(header)
  })

  it('keeps a short tablet story content-sized and scrolls only at its dynamic cap', () => {
    mockViewport({
      desktop: false,
      phone: false,
      finePointer: false,
      hover: false,
      coarsePointer: true,
    })

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })

    mockDockedStoryGeometry(sheet, {
      overlayHeight: 252,
      storyViewportHeight: 196,
      storyHeight: 194,
    })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'fit')
    expect(sheet).not.toHaveAttribute('tabindex')

    mockDockedStoryGeometry(sheet, {
      overlayHeight: 480,
      storyViewportHeight: 424,
      storyHeight: 700,
    })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'overflow')
    expect(sheet).not.toHaveAttribute('tabindex')
  })

  it('uses a bounded phone story with a fixed header without capturing gestures', () => {
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

    expect(sheet.closest('.result-presentation')).toHaveAttribute('data-story-frame', 'bounded')
    expect(sheet).not.toHaveAttribute('tabindex')
    expect(screen.queryByRole('button', { name: 'Hide result story' })).not.toBeInTheDocument()
    const closeButton = screen.getByRole('button', { name: 'Close result details' })
    const header = sheet.querySelector('.result-overlay-header')
    const scroll = sheet.querySelector('.result-overlay-scroll')
    expect(header).toContainElement(closeButton)
    expect(scroll).not.toContainElement(closeButton)
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

  it('keeps phone stories intrinsic until the half-frame cap creates overflow', () => {
    mockViewport({ desktop: false, phone: true })

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', {
      name: 'Open result: ANB champion with stage-ready control',
    }))

    const sheet = screen.getByRole('document', {
      name: 'ANB champion with stage-ready control',
    })

    mockDockedStoryGeometry(sheet, {
      frameHeight: 674,
      overlayHeight: 228,
      storyViewportHeight: 172,
      storyHeight: 170,
    })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'fit')

    mockDockedStoryGeometry(sheet, {
      frameHeight: 674,
      overlayHeight: 337,
      storyViewportHeight: 281,
      storyHeight: 520,
    })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'overflow')
  })

  it('uses the same fixed modal frame and resets story scrolling between results', () => {
    mockViewport({ desktop: false, phone: true })
    const representative = results.find((result) => result.kind === 'representative')

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', {
      name: `Open result: ${results[0].name}`,
    }))

    let dialog = screen.getByRole('dialog')
    let storyScroller = dialog.querySelector('.result-overlay-scroll')
    expect(dialog).toHaveClass('result-modal-dialog', 'result-preview--modal')
    expect(storyScroller).toBeInTheDocument()
    storyScroller.scrollTop = 180

    fireEvent.click(screen.getByRole('button', { name: 'Close result details' }))
    fireEvent.click(screen.getAllByRole('button', {
      name: `Open result: ${representative.caption}`,
    })[0])

    dialog = screen.getAllByRole('dialog').at(-1)
    storyScroller = dialog.querySelector('.result-overlay-scroll')
    expect(dialog).toHaveClass('result-modal-dialog', 'result-preview--modal')
    expect(storyScroller.scrollTop).toBe(0)
    expect(screen.getByText(/not presented as a Team JD client outcome/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Close result details' }).at(-1)).toHaveFocus()
  })

  it('uses keyboard input to reveal before scrolling overflow without upward collapse', () => {
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
    expect(sheet).toHaveStyle({ height: '508.16px' })
    expect(sheet).toHaveAttribute('data-reveal-state', 'expanding')
    expect(scroll.scrollTop).toBe(0)

    fireEvent.keyDown(sheet, { key: 'ArrowDown' })
    expect(sheet).toHaveStyle({ height: '556.16px' })
    expect(scroll.scrollTop).toBe(0)

    fireEvent.keyDown(sheet, { key: 'ArrowDown' })
    expect(sheet).toHaveStyle({ height: '600px' })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'overflow')
    expect(scroll.scrollTop).toBeCloseTo(4.16)

    fireEvent.keyDown(sheet, { key: 'Home' })
    expect(scroll.scrollTop).toBe(0)
    expect(sheet).toHaveStyle({ height: '600px' })
  })

  it('smooths keyboard reveal and applies reduced-motion input immediately', () => {
    motionAnimations.autoFinish = false

    const view = render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    let sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    mockStorySheetGeometry(sheet, { storyHeight: 800 })
    fireEvent.keyDown(sheet, { key: 'PageDown' })

    const keyboardReveal = motionAnimations.records.at(-1)
    expect(keyboardReveal.target).toBeCloseTo(508.16)
    expect(sheet).toHaveStyle({ height: '307.2px' })
    finishMotionAnimation(keyboardReveal)
    expect(sheet).toHaveStyle({ height: '508.16px' })

    view.unmount()
    motionAnimations.records = []
    motionPreference.reduced = true

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )
    sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    const { scroll } = mockStorySheetGeometry(sheet, { storyHeight: 800 })
    fireCancelableWheel(sheet, 350)

    expect(motionAnimations.records).toHaveLength(0)
    expect(sheet).toHaveStyle({ height: '600px' })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'overflow')
    expect(scroll.scrollTop).toBeCloseTo(57.2)
  })

  it('cancels active smoothing and synchronises the rendered height on resize', () => {
    motionAnimations.autoFinish = false

    render(
      <MemoryRouter>
        <AppleWatchGallery />
      </MemoryRouter>,
    )

    const sheet = screen.getByRole('group', {
      name: 'ANB champion with stage-ready control',
    })
    const { frame } = mockStorySheetGeometry(sheet, { storyHeight: 800 })
    fireCancelableWheel(sheet, 100)
    const activeReveal = motionAnimations.records.at(-1)
    progressMotionAnimation(activeReveal, 360)

    Object.defineProperty(frame, 'clientHeight', {
      configurable: true,
      value: 500,
    })
    fireEvent(window, new Event('resize'))

    expect(activeReveal.stopped).toBe(true)
    expect(sheet).toHaveStyle({ height: '407.2px' })
    expect(sheet).toHaveAttribute('data-scroll-mode', 'reveal')
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
  it('centers native overflow without producing negative scroll offsets', () => {
    const viewport = {
      clientWidth: 300,
      clientHeight: 240,
      scrollWidth: 700,
      scrollHeight: 520,
      scrollLeft: 0,
      scrollTop: 0,
    }

    centerGalleryViewport(viewport)
    expect(viewport.scrollLeft).toBe(200)
    expect(viewport.scrollTop).toBe(140)

    const fittingViewport = {
      clientWidth: 900,
      clientHeight: 700,
      scrollWidth: 700,
      scrollHeight: 520,
      scrollLeft: 10,
      scrollTop: 10,
    }
    centerGalleryViewport(fittingViewport)
    expect(fittingViewport.scrollLeft).toBe(0)
    expect(fittingViewport.scrollTop).toBe(0)
  })

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

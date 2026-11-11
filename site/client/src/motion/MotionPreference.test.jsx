import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const os = { reduced: false }

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal()),
  useReducedMotion: () => os.reduced,
}))

import {
  MOTION_STORAGE_KEY,
  MotionPreferenceProvider,
  readStoredPreference,
  resolveReduced,
  useReducedMotion,
} from './MotionPreference'
import MotionToggle from '../components/MotionToggle'
import SectionReveal from '../components/SectionReveal'

function Probe() {
  return <span data-testid="probe">{useReducedMotion() ? 'reduced' : 'moving'}</span>
}

function renderWithProvider(children = null) {
  return render(
    <MotionPreferenceProvider>
      <MotionToggle />
      <Probe />
      {children}
    </MotionPreferenceProvider>,
  )
}

describe('motion preference', () => {
  beforeEach(() => {
    os.reduced = false
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-motion')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('resolves explicit choices over the OS setting', () => {
    expect(resolveReduced('system', true)).toBe(true)
    expect(resolveReduced('system', false)).toBe(false)
    expect(resolveReduced('reduce', false)).toBe(true)
    expect(resolveReduced('full', true)).toBe(false)
  })

  it('follows the OS setting by default', () => {
    os.reduced = true
    renderWithProvider()
    expect(screen.getByTestId('probe')).toHaveTextContent('reduced')
    expect(screen.getByRole('button', { name: /Reduce motion/ })).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced')
  })

  it('toggles, marks the page, announces and remembers the choice', () => {
    renderWithProvider()
    const button = screen.getByRole('button', { name: /Reduce motion/ })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement).not.toHaveAttribute('data-motion')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('probe')).toHaveTextContent('reduced')
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced')
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe('reduce')
    expect(screen.getByRole('status')).toHaveTextContent('Motion reduced')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Motion on')
  })

  it('keeps the stored choice across a remount', () => {
    const first = renderWithProvider()
    fireEvent.click(screen.getByRole('button', { name: /Reduce motion/ }))
    first.unmount()

    renderWithProvider()
    expect(screen.getByTestId('probe')).toHaveTextContent('reduced')
  })

  it('stores an explicit opt-in to motion when the OS asks for less', () => {
    os.reduced = true
    renderWithProvider()
    fireEvent.click(screen.getByRole('button', { name: /Reduce motion/ }))
    expect(screen.getByTestId('probe')).toHaveTextContent('moving')
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe('full')
  })

  it('still works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readStoredPreference()).toBe('system')
    renderWithProvider()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Reduce motion/ }))
    })
    expect(screen.getByTestId('probe')).toHaveTextContent('reduced')
  })

  it('renders reveals as plain content when the visitor reduces motion', () => {
    window.localStorage.setItem(MOTION_STORAGE_KEY, 'reduce')
    renderWithProvider(
      <SectionReveal className="reveal-probe">
        <p>Visible copy</p>
      </SectionReveal>,
    )
    const wrapper = screen.getByText('Visible copy').parentElement
    expect(wrapper).toHaveClass('reveal-probe')
    expect(wrapper.getAttribute('style') || '').not.toMatch(/opacity/)
  })

  it('falls back to the OS setting outside the provider', () => {
    os.reduced = true
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('reduced')
  })
})

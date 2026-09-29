import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useDragScroll } from './useDragScroll'

function Rail({ onOpen }) {
  const viewportRef = useRef(null)
  const pausedRef = useRef(false)
  const dragScroll = useDragScroll(viewportRef, pausedRef)
  return (
    <div ref={viewportRef} data-testid="rail" {...dragScroll}>
      <button type="button" onClick={onOpen}>View result</button>
    </div>
  )
}

const pointer = (clientX) => ({ pointerId: 1, pointerType: 'mouse', clientX })

describe('useDragScroll', () => {
  afterEach(() => cleanup())

  beforeAll(() => {
    // jsdom has no pointer capture.
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.releasePointerCapture = vi.fn()
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true)
  })

  it('lets a plain click reach the card without capturing the pointer', () => {
    const onOpen = vi.fn()
    render(<Rail onOpen={onOpen} />)
    const card = screen.getByRole('button', { name: 'View result' })

    fireEvent.pointerDown(card, pointer(100))
    fireEvent.pointerMove(card, pointer(102))
    fireEvent.pointerUp(card, pointer(102))
    fireEvent.click(card)

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(HTMLElement.prototype.setPointerCapture).not.toHaveBeenCalled()
  })

  it('scrolls on a real drag and swallows the click that ends it', () => {
    const onOpen = vi.fn()
    render(<Rail onOpen={onOpen} />)
    const card = screen.getByRole('button', { name: 'View result' })
    const rail = screen.getByTestId('rail')

    fireEvent.pointerDown(card, pointer(300))
    fireEvent.pointerMove(card, pointer(200))
    fireEvent.pointerUp(card, pointer(200))
    fireEvent.click(card)

    expect(rail.scrollLeft).toBe(100)
    expect(onOpen).not.toHaveBeenCalled()

    fireEvent.click(card)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

import { useRef } from 'react'

const DRAG_THRESHOLD_PX = 6

// Mouse/pen drag-to-scroll for a horizontal rail of clickable cards. Capturing the
// pointer on press retargets the release to the rail, so a plain click never reaches
// the card; capture therefore starts only once the pointer really drags, and the click
// that ends a drag is swallowed so scrubbing the rail does not open a card.
export function useDragScroll(viewportRef, interactionPausedRef) {
  const pointerRef = useRef(null)
  const suppressClickRef = useRef(false)

  const onPointerDown = (event) => {
    if (event.pointerType === 'touch') return
    pointerRef.current = {
      id: event.pointerId,
      x: event.clientX,
      scrollLeft: viewportRef.current.scrollLeft,
      dragging: false,
    }
    interactionPausedRef.current = true
  }

  const onPointerMove = (event) => {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return
    const distance = event.clientX - pointer.x
    if (!pointer.dragging) {
      if (Math.abs(distance) < DRAG_THRESHOLD_PX) return
      pointer.dragging = true
      viewportRef.current.setPointerCapture(event.pointerId)
    }
    viewportRef.current.scrollLeft = pointer.scrollLeft - distance
  }

  const endPointer = (event) => {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return
    suppressClickRef.current = pointer.dragging
    pointerRef.current = null
    interactionPausedRef.current = false
    if (viewportRef.current.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId)
    }
  }

  const onClickCapture = (event) => {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  return { onPointerDown, onPointerMove, onPointerUp: endPointer, onPointerCancel: endPointer, onClickCapture }
}

import { forwardRef } from 'react'
import { Link, useLocation } from 'react-router-dom'

export const FIND_YOUR_FIT_HASH = '#find-your-fit'
export const FIND_YOUR_FIT_HISTORY_KEY = 'findYourFitOverlay'

let lastTrigger = null

export function getLastFindYourFitTrigger() {
  return lastTrigger
}

export function clearLastFindYourFitTrigger(trigger) {
  if (lastTrigger === trigger) lastTrigger = null
}

const FindYourFitLink = forwardRef(function FindYourFitLink(
  { children, onClick, ...props },
  ref,
) {
  const location = useLocation()
  const currentState =
    location.state && typeof location.state === 'object' ? location.state : {}

  return (
    <Link
      {...props}
      ref={ref}
      to={{
        pathname: location.pathname,
        search: location.search,
        hash: FIND_YOUR_FIT_HASH,
      }}
      state={{
        ...currentState,
        [FIND_YOUR_FIT_HISTORY_KEY]: true,
      }}
      data-find-your-fit-trigger
      onClick={(event) => {
        onClick?.(event)
        if (
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          lastTrigger = event.currentTarget
        }
      }}
    >
      {children}
    </Link>
  )
})

export default FindYourFitLink

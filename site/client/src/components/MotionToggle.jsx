import { useEffect, useRef, useState } from 'react'
import { useMotionPreference } from '../motion/MotionPreference'

// Lets a visitor calm the site down (no smooth scrolling, pinned sections, video
// or animated reveals). The choice is remembered in this browser.
//
// variant="icon" is the compact control in the desktop nav; "text" is used in the
// mobile menu and footer. Both are the same toggle button with aria-pressed.

function MotionIcon({ reduced }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      {reduced ? (
        <path d="M3 12h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path
          d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

export default function MotionToggle({ variant = 'text', className = '', onToggle }) {
  const preference = useMotionPreference()
  const [announcement, setAnnouncement] = useState('')
  const toggledRef = useRef(false)
  const reduced = Boolean(preference?.reduced)

  useEffect(() => {
    // Only the button that was pressed announces, so several toggles on the page
    // never read the change out twice.
    if (!toggledRef.current) return
    toggledRef.current = false
    setAnnouncement(reduced ? 'Motion reduced' : 'Motion on')
  }, [reduced])

  if (!preference) return null

  const handleClick = () => {
    toggledRef.current = true
    preference.toggleReduced()
    onToggle?.()
  }

  const isIcon = variant === 'icon'

  return (
    <>
      <button
        type="button"
        className={`motion-toggle motion-toggle--${variant}${reduced ? ' is-reduced' : ''} ${className}`.trim()}
        aria-pressed={reduced}
        aria-label={isIcon ? 'Reduce motion' : undefined}
        title={isIcon ? (reduced ? 'Motion reduced: click to turn motion back on' : 'Reduce motion') : undefined}
        onClick={handleClick}
        data-motion-toggle
      >
        <MotionIcon reduced={reduced} />
        {!isIcon && <span>Reduce motion</span>}
        {!isIcon && (
          <span className="motion-toggle-state" aria-hidden="true">
            {reduced ? 'On' : 'Off'}
          </span>
        )}
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  )
}

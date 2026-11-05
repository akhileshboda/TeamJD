// Plays only part of a video, over and over: the `trim` Jake chose in the
// dashboard ({ start, end } in seconds), or the whole file when there is none.
// Used by the Contact reel and the dashboard's trimmer, so both loop the same way.

// `#t=start` lets the browser fetch from the start of the loop straight away.
export function loopSrc(src, trim) {
  return trim && src ? `${src}#t=${trim.start}` : src
}

function play(video) {
  try {
    video.play()?.catch?.(() => {})
  } catch {
    // Autoplay can be refused; the poster stays in view.
  }
}

// Props for a <video>. Without a trim the browser loops it natively. With one,
// it starts at `start` and jumps back there at `end` (or if it is ever left
// before `start`, e.g. after the start moves). `ended` covers an `end` at the
// very last frame.
export function loopProps(trim) {
  if (!trim) return { loop: true }
  const toStart = (video) => {
    video.currentTime = trim.start
  }
  return {
    loop: false,
    onLoadedMetadata: (event) => toStart(event.currentTarget),
    onTimeUpdate: (event) => {
      const video = event.currentTarget
      if (video.currentTime >= trim.end || video.currentTime < trim.start - 0.25) toStart(video)
    },
    onEnded: (event) => {
      toStart(event.currentTarget)
      play(event.currentTarget)
    },
  }
}

export function formatSeconds(value) {
  const whole = Math.max(0, Math.round(value || 0))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

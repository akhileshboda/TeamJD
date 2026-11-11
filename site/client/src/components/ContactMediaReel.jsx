import { useReducedMotion } from '../motion/MotionPreference'
import { useEffect, useRef, useState } from 'react'
import { loopProps, loopSrc } from '../utils/videoLoop'

const MOBILE_MEDIA_QUERY = '(max-width: 640px)'
const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com'

function getInitialMobileState() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

function getSaveDataEnabled() {
  if (typeof navigator === 'undefined') return false
  return Boolean(navigator.connection?.saveData)
}

// `style` frames an uploaded reel (and its poster) the way Jake cropped it in the
// dashboard; `trim` ({ start, end } in seconds) is the part of it that loops.
export default function ContactMediaReel({ youtubeId, videoSrc, poster, credit, creditHref, style, trim }) {
  const shouldReduceMotion = useReducedMotion()
  const embedRef = useRef(null)
  const [isMobile, setIsMobile] = useState(getInitialMobileState)
  const [saveDataEnabled, setSaveDataEnabled] = useState(getSaveDataEnabled)
  const [embedFailed, setEmbedFailed] = useState(false)
  const canPlayVideo =
    Boolean(youtubeId || videoSrc) && !isMobile && !shouldReduceMotion && !saveDataEnabled && !embedFailed
  const embedSrc = canPlayVideo && youtubeId
    ? `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&disablekb=1&enablejsapi=1&fs=0&playsinline=1&rel=0&modestbranding=1`
    : ''

  const startPlayback = () => {
    const player = embedRef.current?.contentWindow
    if (!player) return

    player.postMessage(
      JSON.stringify({ event: 'command', func: 'mute', args: [] }),
      YOUTUBE_EMBED_ORIGIN,
    )
    player.postMessage(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
      YOUTUBE_EMBED_ORIGIN,
    )
  }

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const query = window.matchMedia(MOBILE_MEDIA_QUERY)
    const update = () => setIsMobile(query.matches)
    update()

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    }

    query.addListener(update)
    return () => query.removeListener(update)
  }, [])

  useEffect(() => {
    const embed = embedRef.current
    if (!embed) return undefined

    const handleError = () => setEmbedFailed(true)
    embed.addEventListener('error', handleError)
    return () => embed.removeEventListener('error', handleError)
  }, [canPlayVideo])

  useEffect(() => {
    if (typeof navigator === 'undefined') return undefined

    const connection = navigator.connection
    if (!connection) return undefined

    const update = () => setSaveDataEnabled(Boolean(connection.saveData))
    update()

    if (typeof connection.addEventListener === 'function') {
      connection.addEventListener('change', update)
      return () => connection.removeEventListener('change', update)
    }

    return undefined
  }, [])

  return (
    <figure className="contact-media-reel" data-video-enabled={canPlayVideo ? 'true' : 'false'} data-cms-section="contact.reel">
      <img
        className="contact-media-reel-poster"
        src={poster}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        width="1080"
        height="1920"
        style={style}
      />

      {canPlayVideo && videoSrc && (
        <video
          className="contact-media-reel-video"
          src={loopSrc(videoSrc, trim)}
          poster={poster}
          style={style}
          autoPlay
          muted
          {...loopProps(trim)}
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={() => setEmbedFailed(true)}
        />
      )}

      {canPlayVideo && youtubeId && (
        <iframe
          ref={embedRef}
          className="contact-media-reel-video contact-media-reel-embed"
          src={embedSrc}
          title="You Can't Stop Us — cinematic athlete reel"
          loading="eager"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          tabIndex="-1"
          aria-hidden="true"
          onLoad={startPlayback}
        />
      )}

      <span className="contact-media-reel-scrim" aria-hidden="true" />
      <figcaption>
        <span>In the work</span>
        {creditHref ? (
          <a href={creditHref} target="_blank" rel="noopener noreferrer">
            Film: {credit}<span aria-hidden="true"> ↗</span>
          </a>
        ) : (
          credit && <span>{credit}</span>
        )}
      </figcaption>
    </figure>
  )
}

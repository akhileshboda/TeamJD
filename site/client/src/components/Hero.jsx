import { useReducedMotion } from '../motion/MotionPreference'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fallbackHeroPosterUrl, fallbackHeroVideoUrl } from '../config/heroMedia'
import FindYourFitLink from './FindYourFitLink'
import { useMedia } from '../hooks/useAssets'

const MOBILE_HERO_QUERY = '(max-width: 640px)'

function getInitialMobileState() {
  if (typeof window === 'undefined') return true
  return window.matchMedia(MOBILE_HERO_QUERY).matches
}

function getSaveDataEnabled() {
  if (typeof navigator === 'undefined') return false
  return Boolean(navigator.connection?.saveData)
}

export default function Hero() {
  const shouldReduce = useReducedMotion()
  const videoRef = useRef(null)
  const [isMobileHero, setIsMobileHero] = useState(getInitialMobileState)
  const [saveDataEnabled, setSaveDataEnabled] = useState(getSaveDataEnabled)
  const [videoFailed, setVideoFailed] = useState(false)
  const [hasVideoEnded, setHasVideoEnded] = useState(false)
  const heroMedia = useMedia()('home.hero-video')
  const heroVideoUrl = heroMedia.replaced ? heroMedia.src : fallbackHeroVideoUrl
  const heroPosterUrl = heroMedia.replaced ? heroMedia.poster : fallbackHeroPosterUrl

  // Wait for the manifest so the built-in loop never starts only to be swapped for Jake's.
  const canUseVideo =
    heroMedia.ready &&
    Boolean(heroVideoUrl) &&
    !isMobileHero &&
    !shouldReduce &&
    !saveDataEnabled &&
    !videoFailed

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const query = window.matchMedia(MOBILE_HERO_QUERY)
    const update = () => setIsMobileHero(query.matches)
    update()

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    }

    query.addListener(update)
    return () => query.removeListener(update)
  }, [])

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

  useEffect(() => {
    if (!canUseVideo) {
      setHasVideoEnded(false)
      return
    }

    const video = videoRef.current
    if (!video) return

    setHasVideoEnded(false)
    video.muted = true

    const playPromise = video.play()
    if (playPromise?.catch) {
      playPromise.catch(() => {
        setVideoFailed(true)
      })
    }
  }, [canUseVideo])

  const handleVideoEnded = useCallback(() => {
    setHasVideoEnded(true)
  }, [])

  const handleVideoError = useCallback(() => {
    setVideoFailed(true)
    setHasVideoEnded(false)
  }, [])

  const handleReplay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    setHasVideoEnded(false)
    video.currentTime = 0

    const playPromise = video.play()
    if (playPromise?.catch) {
      playPromise.catch(() => {
        setVideoFailed(true)
      })
    }
  }, [])

  // Motion (load-in line reveal, the pinned scroll-away) is choreographed by the
  // landing page in pages/Home.jsx; this component only owns the media and copy.
  return (
    <section className="lp-hero" aria-label="Hero" data-cms-section="home.hero-video">
      <div className="lp-hero-stage">
        <div className="lp-hero-media">
          <div
            className="lp-hero-bg"
            style={{ backgroundImage: `url('${heroPosterUrl}')` }}
            aria-hidden="true"
          />
          {canUseVideo && (
            <video
              ref={videoRef}
              className="lp-hero-video"
              src={heroVideoUrl}
              poster={heroPosterUrl}
              autoPlay
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              onEnded={handleVideoEnded}
              onError={handleVideoError}
            />
          )}
          <div className="lp-hero-overlay" aria-hidden="true" />
        </div>

        {canUseVideo && hasVideoEnded && (
          <button
            type="button"
            className="hero-replay"
            onClick={handleReplay}
            aria-label="Replay hero video"
          >
            Replay
          </button>
        )}

        <div className="container lp-hero-content">
          <p className="lp-hero-eyebrow">
            <span className="lp-hero-eyebrow-rule" aria-hidden="true" />
            Team JD &mdash; Jake Dedert Fitness
          </p>

          <h1 className="lp-hero-title">
            <span className="lp-hero-line">Unlock your</span>
            <span className="lp-hero-line lp-hero-line--accent">true potential</span>
          </h1>

          <div className="lp-hero-foot">
            <p className="lp-hero-subtitle">
              Strong body, unstoppable mind. Let&apos;s build both. Personalised coaching
              tailored exclusively to you — competition prep, online coaching, and posing.
            </p>

            <div className="lp-hero-actions">
              <FindYourFitLink className="btn btn-primary btn-lg">
                Find Your Fit
              </FindYourFitLink>
              <Link to="/services" className="btn btn-secondary btn-lg">
                View Services
              </Link>
            </div>
          </div>
        </div>

        <div className="lp-hero-cue" aria-hidden="true">
          <span>Scroll</span>
          <span className="lp-hero-cue-line" />
        </div>
      </div>
    </section>
  )
}

import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fallbackHeroPosterUrl, fallbackHeroVideoUrl } from '../config/heroMedia'

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
}

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
  const heroVideoUrl = fallbackHeroVideoUrl
  const heroPosterUrl = fallbackHeroPosterUrl

  const canUseVideo =
    Boolean(heroVideoUrl) && !isMobileHero && !shouldReduce && !saveDataEnabled && !videoFailed

  const containerVariants = shouldReduce
    ? {}
    : {
        hidden: {},
        visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
      }

  const Item = shouldReduce ? 'div' : motion.div

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

  return (
    <section className="hero" aria-label="Hero">
      <div
        className="hero-bg"
        style={{ backgroundImage: `url('${heroPosterUrl}')` }}
        aria-hidden="true"
      />
      {canUseVideo && (
        <video
          ref={videoRef}
          className="hero-video"
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
      <div className="hero-overlay" />
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
      <div className="container hero-content">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <Item variants={itemVariants}>
            <p className="hero-eyebrow">Team JD &mdash; Jake Dedert Fitness</p>
          </Item>

          <Item variants={itemVariants}>
            <h1>
              UNLOCK YOUR
              <br />
              TRUE POTENTIAL
            </h1>
          </Item>

          <Item variants={itemVariants}>
            <p className="hero-subtitle">
              Strong body, unstoppable mind. Let&apos;s build both. Personalised coaching
              tailored exclusively to you — competition prep, online coaching, and posing.
            </p>
          </Item>

          <Item variants={itemVariants}>
            <div className="hero-actions">
              <Link to="/services#find-your-fit" className="btn btn-primary btn-lg">
                Find Your Fit
              </Link>
              <Link to="/services" className="btn btn-secondary btn-lg">
                View Services
              </Link>
            </div>
          </Item>
        </motion.div>
      </div>
    </section>
  )
}

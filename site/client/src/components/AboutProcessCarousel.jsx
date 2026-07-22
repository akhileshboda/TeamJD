import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useAssets } from '../hooks/useAssets'
import JourneyIcon from './JourneyIcon'

const AUTOPLAY_INTERVAL_MS = 5200

export default function AboutProcessCarousel({ images = [], caption }) {
  const resolveAsset = useAssets()
  const shouldReduceMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (shouldReduceMotion || isPaused || images.length < 2) return undefined

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length)
    }, AUTOPLAY_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [images.length, isPaused, shouldReduceMotion])

  const showSlide = (index) => {
    setActiveIndex((index + images.length) % images.length)
  }

  if (images.length === 0) return null

  return (
    <div
      className="about-process-carousel service-media-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="How Team JD works"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false)
      }}
    >
      <div
        className="service-media-carousel-track"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {images.map((image, index) => (
          <figure
            className="service-media-carousel-slide"
            aria-hidden={index !== activeIndex}
            key={image.asset}
          >
            <img
              src={resolveAsset(`/api/assets/${image.asset}`)}
              alt={index === activeIndex ? image.alt : ''}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              width="640"
              height="800"
            />
          </figure>
        ))}
      </div>

      <p className="about-process-carousel-caption">{caption}</p>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="service-media-carousel-arrow service-media-carousel-arrow--previous"
            aria-label="Show previous process image"
            onClick={() => showSlide(activeIndex - 1)}
          >
            <JourneyIcon name="arrowLeft" size={17} />
          </button>
          <button
            type="button"
            className="service-media-carousel-arrow service-media-carousel-arrow--next"
            aria-label="Show next process image"
            onClick={() => showSlide(activeIndex + 1)}
          >
            <JourneyIcon name="arrowRight" size={17} />
          </button>

          <div className="service-media-carousel-dots" aria-label="Choose process image">
            {images.map((image, index) => (
              <button
                type="button"
                className={index === activeIndex ? 'is-active' : ''}
                aria-label={`Show process image ${index + 1} of ${images.length}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => showSlide(index)}
                key={`${image.asset}-dot`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

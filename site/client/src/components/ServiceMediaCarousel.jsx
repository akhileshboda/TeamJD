import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useAssets } from '../hooks/useAssets'
import JourneyIcon from './JourneyIcon'

const AUTOPLAY_INTERVAL_MS = 5200

export default function ServiceMediaCarousel({ service }) {
  const resolveAsset = useAssets()
  const shouldReduceMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const images = (service.gallery_images?.length
    ? service.gallery_images
    : [service.body_image, service.hero_image]
  ).filter(Boolean).slice(0, 5)

  useEffect(() => {
    setActiveIndex(0)
  }, [service.slug])

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

  return (
    <div
      className="service-media-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label={`${service.name} gallery`}
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
            key={`${image}-${index}`}
          >
            <img
              src={resolveAsset(image)}
              alt={index === 0 ? service.body_alt ?? '' : `${service.name} coaching in action`}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          </figure>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="service-media-carousel-arrow service-media-carousel-arrow--previous"
            aria-label="Show previous image"
            onClick={() => showSlide(activeIndex - 1)}
          >
            <JourneyIcon name="arrowLeft" size={17} />
          </button>
          <button
            type="button"
            className="service-media-carousel-arrow service-media-carousel-arrow--next"
            aria-label="Show next image"
            onClick={() => showSlide(activeIndex + 1)}
          >
            <JourneyIcon name="arrowRight" size={17} />
          </button>

          <div className="service-media-carousel-dots" aria-label="Choose gallery image">
            {images.map((image, index) => (
              <button
                type="button"
                className={index === activeIndex ? 'is-active' : ''}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => showSlide(index)}
                key={`${image}-dot`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

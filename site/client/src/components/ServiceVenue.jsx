import { useMedia } from '../hooks/useAssets'

export default function ServiceVenue({ venue, slug }) {
  const media = useMedia()

  if (!venue) return null

  return (
    <section className="service-venue" aria-labelledby="service-venue-title">
      <div className="service-venue-copy">
        <span className="eyebrow">Training location</span>
        <h2 id="service-venue-title">Train at {venue.name}.</h2>
        <p>{venue.description}</p>
        <address>{venue.address}</address>
      </div>

      <div className="service-venue-gallery" aria-label={`${venue.name} gallery`}>
        {venue.images.map((image, index) => {
          const photo = media(`services.${slug}.venue-${index + 1}`, image.asset, image.alt)
          return (
            <figure key={image.asset}>
              <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
            </figure>
          )
        })}
      </div>
    </section>
  )
}

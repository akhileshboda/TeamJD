import { useAssets } from '../hooks/useAssets'

export default function ServiceVenue({ venue, sessionOptions = [] }) {
  const resolveAsset = useAssets()

  if (!venue) return null

  return (
    <section className="service-venue" aria-labelledby="service-venue-title">
      <div className="service-venue-copy">
        <span className="eyebrow">Training location</span>
        <h2 id="service-venue-title">Train at {venue.name}.</h2>
        <p>{venue.description}</p>
        <address>{venue.address}</address>

        {sessionOptions.length > 0 && (
          <div className="service-session-options" aria-label="Personal Training session options">
            {sessionOptions.map((option) => (
              <article key={option.title}>
                <span>{option.title}</span>
                <strong>{option.price}</strong>
                <p>{option.description}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="service-venue-gallery" aria-label={`${venue.name} gallery`}>
        {venue.images.map((image) => (
          <figure key={image.asset}>
            <img src={resolveAsset(image.asset)} alt={image.alt} loading="lazy" decoding="async" />
          </figure>
        ))}
      </div>
    </section>
  )
}

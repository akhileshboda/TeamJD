// Mobile-only persistent CTA pinned to the bottom of service detail pages so
// the booking action is always one tap away. Hidden on desktop via CSS.
export default function StickyBookBar({ service }) {
  if (!service) return null

  return (
    <div className="sticky-book-bar" role="region" aria-label="Book this service">
      <div className="sticky-book-bar-label">
        <span className="sticky-book-bar-name">{service.name}</span>
        {service.pricing && (
          <span className="sticky-book-bar-price">{service.pricing}</span>
        )}
      </div>
      <a
        href={service.cta_url}
        className="btn btn-primary"
        target="_blank"
        rel="noopener noreferrer"
      >
        {service.cta_text}
      </a>
    </div>
  )
}

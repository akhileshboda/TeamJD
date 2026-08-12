import { getServicePricingContext } from '../utils/servicePricing'

export default function ServicePricingConversion({ service, placement, children }) {
  const pricing = getServicePricingContext(service)
  if (!pricing) return children

  return (
    <section
      className={`service-pricing-conversion service-pricing-conversion--${placement} service-pricing-conversion--${pricing.mode}`}
      aria-label={pricing.eyebrow}
    >
      <div className="service-pricing-conversion-summary">
        <span>{pricing.eyebrow}</span>
        {pricing.mode === 'priced' ? (
          <div className="service-pricing-conversion-hero-price">
            {pricing.heroPrefix && <span>{pricing.heroPrefix}</span>}
            <strong>{pricing.heroPrice}</strong>
            <small>{pricing.heroUnit}</small>
          </div>
        ) : (
          <strong>{pricing.headline}</strong>
        )}
        <p>{pricing.heroDetail}</p>
      </div>

      {placement === 'final' && pricing.mode === 'priced' && (
        <dl className="service-pricing-conversion-tiers" aria-label={`${service.name} session options`}>
          {pricing.tiers.map((tier) => (
            <div key={tier.label}>
              <dt>{tier.label}</dt>
              <dd>
                <strong>{tier.price}</strong>
                <span>{tier.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="service-pricing-conversion-action">{children}</div>
    </section>
  )
}

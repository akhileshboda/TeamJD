import { getServicePricingContext } from '../utils/servicePricing'

export default function ServicePricingConversion({ service, placement, children }) {
  const pricing = getServicePricingContext(service)
  if (!pricing) return children

  /* The card states the price once. The tier table is the richer form, so where it
     renders it owns the numbers outright and the summary keeps only its eyebrow --
     otherwise the lowest tier printed both as "From $85" and as the table's first row.
     The hero never tables, so it always keeps the summary numeral. */
  const showTierList = placement === 'final' && pricing.showTierList
  const showSummary = !showTierList

  return (
    <section
      className={`service-pricing-conversion service-pricing-conversion--${placement} service-pricing-conversion--${pricing.mode}`}
      aria-label={pricing.eyebrow}
    >
      <div className="service-pricing-conversion-summary">
        <span>{pricing.eyebrow}</span>
        {showSummary && (
          <>
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
          </>
        )}
      </div>

      {showTierList && (
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

export const CONSULTATION_PRICING_COPY = 'Tailored pricing after your consultation.'

function compactUnit(unit = '') {
  if (unit === 'per person, per session') return '/ person'
  if (unit === 'per session') return '/ session'
  return unit ? `/ ${unit}` : ''
}

export function getServicePricingContext(service) {
  const pricing = service?.pricing
  if (!pricing) return null

  if (pricing.mode === 'consultation') {
    return {
      mode: 'consultation',
      eyebrow: 'Tailored pricing',
      headline: CONSULTATION_PRICING_COPY,
      compactLabel: 'Tailored pricing',
      heroPrefix: null,
      heroPrice: null,
      heroUnit: null,
      heroDetail: 'Your consultation determines the right level of support.',
      tiers: [],
    }
  }

  const tiers = pricing.tiers ?? []
  if (tiers.length === 0) return null

  const lowestTier = tiers.reduce((lowest, tier) => (
    Number(tier.price.replace(/[^\d.]/g, '')) < Number(lowest.price.replace(/[^\d.]/g, ''))
      ? tier
      : lowest
  ))

  return {
    mode: 'priced',
    eyebrow: 'Session investment',
    headline: tiers.length === 1 ? tiers[0].price : `From ${lowestTier.price}`,
    compactLabel: tiers.length === 1
      ? `${tiers[0].price} ${compactUnit(tiers[0].unit)}`
      : `From ${lowestTier.price}`,
    heroPrefix: tiers.length === 1 ? null : 'From',
    heroPrice: tiers.length === 1 ? tiers[0].price : lowestTier.price,
    heroUnit: tiers.length === 1 ? tiers[0].unit : lowestTier.unit,
    heroDetail: tiers.length === 1
      ? tiers[0].label
      : `${tiers.map((tier) => tier.label.replace(/ sessions?$/, '')).join(' and ')} session options`,
    tiers,
  }
}

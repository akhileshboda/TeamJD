export function isApplicationService(service) {
  return Boolean(service?.application_required)
}

// Single reader of the service destination fields. Application services
// (Competition Preparation) resolve to Jake's Typeform; every other service
// resolves to its Calendly booking link. Keeping this in one place is what
// guarantees a gated service can never render a booking URL.
export function resolveServiceAction(service) {
  if (isApplicationService(service)) {
    return {
      href: service.application_url ?? null,
      label: service.application_cta_text ?? service.cta_text ?? 'Apply now',
      shortLabel: 'Apply now',
      isApplication: true,
    }
  }

  return {
    href: service?.cta_url ?? null,
    label: service?.cta_text ?? 'Book now',
    shortLabel: 'Book now',
    isApplication: false,
  }
}

// Where an item lives in the dashboard, for links from lists, usage panels and
// the "not live" panel.
const SECTION_PATHS = { results: 'results', testimonials: 'testimonials', services: 'services', faqs: 'faqs' }

export function adminLinkFor(collection, id) {
  if (collection === 'placements') {
    // Slot ids are page.spot, or services.<slug>.spot for service pages.
    const [first, second] = String(id).split('.')
    return `/admin/pages/${first === 'services' ? second : first}`
  }
  return `/admin/${SECTION_PATHS[collection] || collection}/${id}`
}

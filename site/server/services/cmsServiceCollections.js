const path = require('path');

// Services and FAQs for the dashboard (registered in cmsCollections.js).
//
// A service keeps exactly the shape and key order public/content/services.json
// had, so every page that reads it is unchanged. Jake edits the words, prices,
// facts and booking links; the fields the site's code depends on stay locked:
// ids and slugs (hard-coded in the contact form, enquiry validation, Find Your Fit
// and the footer), theme colours, and image keys (photos are chosen in Pages).

const LOCKED_SERVICE_FIELDS = new Set([
  'id', 'slug', 'theme', 'hero_image', 'body_image', 'banner_image', 'gallery_images',
  'application_required', 'cta_secondary', 'cta_secondary_url'
]);

const PRICING_MODES = ['consultation', 'priced'];

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function textList(value, maxItems, maxLength) {
  return (Array.isArray(value) ? value : []).map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function isWebUrl(value) {
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch (_error) {
    return false;
  }
}

const SERVICE_FIELDS = {
  name: (value) => text(value, 60),
  tagline: (value) => text(value, 200),
  hero_alt: (value) => text(value, 300),
  body_alt: (value) => text(value, 300),
  short_description: (value) => text(value, 400),
  description: (value) => text(value, 3000),
  facts: (value) => (Array.isArray(value) ? value : []).slice(0, 6)
    .map((fact) => {
      const out = { label: text(fact?.label, 40), value: text(fact?.value, 120) };
      const url = text(fact?.url, 500);
      if (url) out.url = url;
      return out;
    })
    .filter((fact) => fact.label || fact.value),
  expectation_title: (value) => text(value, 160),
  expectation_lede: (value) => text(value, 600),
  expectations: (value) => textList(value, 8, 400),
  who_its_for: (value) => textList(value, 8, 300),
  // Each item keeps its icon; Jake edits the words of the items that exist.
  includes: (value, base) => base.map((item, index) => ({
    title: text(value?.[index]?.title ?? item.title, 120),
    description: text(value?.[index]?.description ?? item.description, 600),
    icon: item.icon
  })),
  venue: (value, base) => ({
    name: text(value?.name ?? base.name, 120),
    address: text(value?.address ?? base.address, 200),
    description: text(value?.description ?? base.description, 800),
    images: base.images.map((image, index) => ({ asset: image.asset, alt: text(value?.images?.[index]?.alt ?? image.alt, 300) }))
  }),
  federations: (value) => textList(value, 10, 60),
  pricing: (value) => ({
    mode: PRICING_MODES.includes(value?.mode) ? value.mode : 'consultation',
    tiers: (Array.isArray(value?.tiers) ? value.tiers : []).slice(0, 6)
      .map((tier) => ({
        label: text(tier?.label, 80),
        price: text(tier?.price, 20),
        unit: text(tier?.unit, 60),
        description: text(tier?.description, 300)
      }))
      .filter((tier) => tier.label || tier.price),
    note: text(value?.note, 300) || null
  }),
  application_cta_text: (value) => text(value, 60),
  application_url: (value) => text(value, 500),
  cta_text: (value) => text(value, 60),
  cta_url: (value) => text(value, 500)
};

// Rebuilds the service in its original key order: locked fields from the
// current version, editable ones from the input (falling back to current).
function normalizeService(input = {}, current = input) {
  const out = {};
  for (const key of Object.keys(current)) {
    if (LOCKED_SERVICE_FIELDS.has(key) || !SERVICE_FIELDS[key]) {
      out[key] = structuredClone(current[key]);
    } else {
      out[key] = SERVICE_FIELDS[key](key in input ? input[key] : current[key], current[key]);
    }
  }
  return out;
}

function validateService(draft) {
  const errors = {};
  for (const [field, message] of Object.entries({
    name: 'Give the service a name.',
    tagline: 'Add a one-line tagline.',
    short_description: 'Add a short description for the service cards.',
    cta_text: 'Add the booking button text.'
  })) {
    if (!draft[field]) errors[field] = message;
  }
  if (!isWebUrl(draft.cta_url)) errors.cta_url = 'Add a full booking link, starting with https://';
  if (draft.application_required && !isWebUrl(draft.application_url)) {
    errors.application_url = 'Add a full application form link, starting with https://';
  }
  if (draft.pricing.mode === 'priced' && !draft.pricing.tiers.some((tier) => tier.label && tier.price)) {
    errors.pricing = 'Add at least one price, or choose "Price set after a consultation".';
  }
  draft.facts.forEach((fact, index) => {
    if (fact.url && !isWebUrl(fact.url)) errors[`facts.${index}.url`] = 'Links need to start with https://';
  });
  return errors;
}

function summarizeService(record) {
  const { name, tagline, pricing } = record.draft;
  const prices = pricing.mode === 'priced' ? pricing.tiers.map((tier) => tier.price).filter(Boolean).join(' / ') : 'After consultation';
  return { title: name, subtitle: tagline, price: prices };
}

// ── FAQs ─────────────────────────────────────────────────────────────────────

function normalizeFaq(input = {}) {
  return { question: text(input.question, 300), answer: text(input.answer, 2000) };
}

function validateFaq(draft) {
  const errors = {};
  if (!draft.question) errors.question = 'Add the question.';
  if (!draft.answer) errors.answer = 'Add the answer.';
  return errors;
}

function summarizeFaq(record) {
  const { question, answer } = record.draft;
  return { title: question || 'New question', subtitle: answer.length > 90 ? `${answer.slice(0, 89).trimEnd()}…` : answer };
}

// ── Seed and public output ───────────────────────────────────────────────────

function seedServices({ now, seedDir, seedRecord }) {
  return require(path.join(seedDir, 'services.json')).map((service, index) => seedRecord({
    id: service.id, order: index + 1, draft: normalizeService(service, service), live: true, now
  }));
}

function seedFaqs({ now, seedDir, seedRecord }) {
  return require(path.join(seedDir, 'faqs.json')).map((faq, index) => seedRecord({
    id: String(faq.id), order: index + 1, draft: normalizeFaq(faq), live: true, now
  }));
}

const publicServices = (data, sortedLive) => sortedLive('services').map((record) => structuredClone(record.published));
const publicFaqs = (data, sortedLive) => sortedLive('faqs').map((record) => ({ id: record.id, ...record.published }));

module.exports = {
  LOCKED_SERVICE_FIELDS,
  normalizeFaq,
  normalizeService,
  publicFaqs,
  publicServices,
  seedFaqs,
  seedServices,
  summarizeFaq,
  summarizeService,
  validateFaq,
  validateService
};

const path = require('path');

// What each dashboard collection is: how a draft is cleaned on save, what must
// be true before it can go live, what the public site receives, how a list row
// is summarised, and how a brand-new store is seeded. cmsStore.js is generic
// over this registry; adding a collection means adding an entry here.
//
// normalizeDraft always builds keys in the same order, so a draft and its
// published copy can be compared with JSON.stringify.

const SEED_DIR = path.join(__dirname, '..', 'seed');

const RESULT_CATEGORIES = ['competition', 'posing', 'online', 'training', 'lifestyle'];
const RESULT_KINDS = ['client', 'representative'];
const RESULT_FITS = ['contain', 'cover'];

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function percent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number))) : 50;
}

function list(value, max) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function requireFields(draft, messages) {
  const errors = {};
  for (const [field, message] of Object.entries(messages)) {
    if (!draft[field]) errors[field] = message;
  }
  return errors;
}

// ── Results ──────────────────────────────────────────────────────────────────

function normalizeResult(input = {}) {
  const image = input.image || {};
  const presentation = input.presentation;
  return {
    caption: text(input.caption, 160),
    alt: text(input.alt, 300),
    category: oneOf(input.category, RESULT_CATEGORIES, 'competition'),
    kind: oneOf(input.kind, RESULT_KINDS, 'client'),
    featured: Boolean(input.featured),
    image: { assetId: text(image.assetId, 80) || null, src: text(image.src, 1000) },
    presentation: presentation
      ? {
          fit: oneOf(presentation.fit, RESULT_FITS, 'contain'),
          focus: { x: percent(presentation.focus?.x), y: percent(presentation.focus?.y) }
        }
      : null,
    name: text(input.name, 160),
    location: text(input.location, 120),
    duration: text(input.duration, 60),
    summary: text(input.summary, 1200),
    testimonialId: text(input.testimonialId, 80) || null,
    stats: list(input.stats, 6)
      .map((stat) => {
        const out = { label: text(stat?.label, 40), value: text(stat?.value, 40) };
        if (stat?.trend === 'up' || stat?.trend === 'down') out.trend = stat.trend;
        return out;
      })
      .filter((stat) => stat.label || stat.value),
    tags: [...new Set(list(input.tags, 20).map((tag) => text(tag, 40).toLowerCase()).filter(Boolean))]
  };
}

function findAsset(data, assetId) {
  return (data.media || []).find((asset) => asset.id === assetId) || null;
}

function validateResult(draft, data) {
  const errors = requireFields(draft, {
    caption: 'Add a short caption.',
    alt: 'Describe the photo for people who cannot see it.'
  });
  if (draft.image.assetId) {
    const asset = findAsset(data, draft.image.assetId);
    if (!asset) errors.image = 'That photo is no longer in the media library. Choose another.';
    else if (asset.kind !== 'image') errors.image = 'Results need a photo, not a video.';
  } else if (!draft.image.src) {
    errors.image = 'Choose a photo.';
  }
  return errors;
}

function resultImageSrc(version, data) {
  if (version.image.assetId) return findAsset(data, version.image.assetId)?.url || '';
  return version.image.src;
}

// The exact shape public/content/results-library.json had, so the site's results
// components need no changes. Optional fields appear only when set.
function toPublicResult(record, data) {
  const version = record.published;
  const out = {
    id: record.id,
    src: resultImageSrc(version, data),
    alt: version.alt,
    caption: version.caption,
    category: version.category,
    kind: version.kind,
    featured: version.featured
  };
  if (version.presentation) out.presentation = version.presentation;
  for (const field of ['name', 'location', 'duration', 'summary']) {
    if (version[field]) out[field] = version[field];
  }
  const testimonial = version.testimonialId
    && (data.collections.testimonials || []).find((item) => item.id === version.testimonialId);
  if (testimonial?.published) out.testimonial = toPublicTestimonial(testimonial);
  if (version.stats.length) out.stats = version.stats;
  out.tags = version.tags;
  out.order = record.order;
  return out;
}

function summarizeResult(record, data) {
  const version = record.draft;
  return {
    title: version.name || version.caption || 'Untitled result',
    subtitle: version.caption && version.name ? version.caption : '',
    thumbnail: resultImageSrc(version, data),
    category: version.category,
    kind: version.kind,
    featured: version.featured
  };
}

// ── Testimonials ─────────────────────────────────────────────────────────────

function normalizeTestimonial(input = {}) {
  return {
    quote: text(input.quote, 1200),
    author: text(input.author, 120),
    service: text(input.service, 120),
    result: text(input.result, 120)
  };
}

function validateTestimonial(draft) {
  return requireFields(draft, {
    quote: 'Add the quote.',
    author: 'Say who it is from. A first name or "Competition client" is fine.'
  });
}

function toPublicTestimonial(record) {
  const { quote, author, service, result } = record.published;
  return { quote, author, service, result };
}

// Results that show this testimonial (draft or live).
function testimonialUsage(data, record) {
  return (data.collections.results || [])
    .filter((result) => [result.draft, result.published].some((version) => version?.testimonialId === record.id))
    .map((result) => ({ collection: 'results', id: result.id, title: summarizeResult(result, data).title }));
}

function unlinkTestimonial(data, testimonialId, touch) {
  for (const result of data.collections.results || []) {
    let changed = false;
    for (const version of [result.draft, result.published]) {
      if (version?.testimonialId === testimonialId) {
        version.testimonialId = null;
        changed = true;
      }
    }
    if (changed) touch(result);
  }
}

function summarizeTestimonial(record) {
  const { quote, author, result } = record.draft;
  return {
    title: author || 'Unnamed client',
    subtitle: quote.length > 90 ? `${quote.slice(0, 89).trimEnd()}…` : quote,
    result
  };
}

// ── Placements ───────────────────────────────────────────────────────────────
// One record per media slot (mediaSlots.js) Jake has touched, keyed by slot id.
// assetId null means "use the site's built-in photo or video".

function normalizePlacement(input = {}) {
  return { assetId: text(input.assetId, 80) || null, alt: text(input.alt, 300) };
}

function validatePlacement(draft, data) {
  if (!draft.assetId) return {};
  const asset = findAsset(data, draft.assetId);
  if (!asset) return { assetId: 'That file is no longer in the media library. Choose another.' };
  if (asset.kind === 'image' && !draft.alt) return { alt: 'Describe the photo before it goes live.' };
  return {};
}

function summarizePlacement(record, data) {
  const asset = record.draft.assetId ? findAsset(data, record.draft.assetId) : null;
  return {
    title: record.label || record.id,
    subtitle: record.page || '',
    thumbnail: asset ? asset.posterUrl || asset.url : ''
  };
}

function publicSlots(data) {
  const slots = {};
  for (const record of data.collections.placements || []) {
    const asset = record.published?.assetId && findAsset(data, record.published.assetId);
    if (!asset) continue;
    slots[record.id] = { kind: asset.kind, url: asset.url, posterUrl: asset.posterUrl || null, alt: record.published.alt };
  }
  return slots;
}

// ── Media library usage ──────────────────────────────────────────────────────

function mediaUsage(data, assetId) {
  const uses = [];
  for (const record of data.collections.placements || []) {
    if ([record.draft, record.published].some((version) => version?.assetId === assetId)) {
      uses.push({ collection: 'placements', id: record.id, title: `${record.page ? `${record.page}: ` : ''}${record.label || record.id}` });
    }
  }
  for (const record of data.collections.results || []) {
    if ([record.draft, record.published].some((version) => version?.image?.assetId === assetId)) {
      uses.push({ collection: 'results', id: record.id, title: summarizeResult(record, data).title });
    }
  }
  return uses;
}

// ── Seed ─────────────────────────────────────────────────────────────────────
// A brand-new store starts from the JSON files the site used to serve. Real
// client results go live; stock "representative" images arrive hidden so Jake
// can delete or replace them. Testimonials embedded in results become their own
// records, linked back to the result.

function seedRecord({ id, order, draft, live, now }) {
  return {
    id,
    order,
    draft,
    published: live ? structuredClone(draft) : null,
    rev: 1,
    createdAt: now,
    updatedAt: now,
    updatedBy: 'seed',
    publishedAt: live ? now : null,
    hiddenAt: live ? null : now
  };
}

function readSeed(seedDir, file) {
  return require(path.join(seedDir, file));
}

function seedResults({ now, seedDir = SEED_DIR }) {
  return readSeed(seedDir, 'results-library.json').map((item) => {
    const id = String(item.id);
    const draft = normalizeResult({
      ...item,
      image: { src: item.src },
      testimonialId: item.testimonial ? `t-${id}` : null
    });
    return seedRecord({ id, order: item.order, draft, live: item.kind === 'client', now });
  });
}

function seedTestimonials({ now, seedDir = SEED_DIR }) {
  const linked = readSeed(seedDir, 'results-library.json')
    .filter((item) => item.testimonial)
    .map((item) => ({ id: `t-${item.id}`, draft: normalizeTestimonial(item.testimonial), live: true }));
  // Never shown on the site before; kept hidden in case Jake wants them.
  const unused = readSeed(seedDir, 'testimonials.json')
    .map((item) => ({ id: `legacy-${item.id}`, draft: normalizeTestimonial(item), live: false }));
  return [...linked, ...unused].map((item, index) => seedRecord({ ...item, order: index + 1, now }));
}

// Public outputs the site reads, built from live records only.
const PUBLIC_OUTPUTS = {
  results: (data, sortedLive) => sortedLive('results').map((record) => toPublicResult(record, data)),
  slots: (data) => publicSlots(data)
};

const COLLECTIONS = {
  results: {
    label: 'result',
    publicCollection: 'results',
    normalizeDraft: normalizeResult,
    validateForPublish: validateResult,
    summarize: summarizeResult,
    seed: seedResults
  },
  testimonials: {
    label: 'testimonial',
    // Testimonials appear on the site inside their result's story.
    publicCollection: 'results',
    normalizeDraft: normalizeTestimonial,
    validateForPublish: validateTestimonial,
    summarize: summarizeTestimonial,
    usage: testimonialUsage,
    onDelete: (data, record, touch) => unlinkTestimonial(data, record.id, touch),
    seed: seedTestimonials
  },
  placements: {
    label: 'photo spot',
    publicCollection: 'slots',
    // Records appear the first time Jake picks something for a slot.
    createOnSave: true,
    canCreate: false,
    canDelete: false,
    normalizeDraft: normalizePlacement,
    validateForPublish: validatePlacement,
    summarize: summarizePlacement,
    seed: () => []
  }
};

module.exports = {
  COLLECTIONS,
  PUBLIC_OUTPUTS,
  mediaUsage,
  RESULT_CATEGORIES,
  RESULT_KINDS,
  SEED_DIR,
  normalizeResult,
  normalizeTestimonial,
  seedRecord,
  text
};

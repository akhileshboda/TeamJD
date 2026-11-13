const path = require('path');
const services = require('./cmsServiceCollections');
const { publicSettings } = require('./cmsSettings');

// What each dashboard collection is: how a draft is cleaned on save, what must
// be true before it can go live, what the public site receives, how a list row
// is summarised, and how a brand-new store is seeded. cmsStore.js is generic
// over this registry; adding a collection means adding an entry here.
//
// normalizeDraft always builds keys in the same order, so a draft and its
// published copy can be compared with JSON.stringify.

const SEED_DIR = path.join(__dirname, '..', 'seed');

const RESULT_CATEGORIES = ['competition', 'posing', 'online', 'training', 'lifestyle'];
// Every result is a real client result. Stock "representative" images were
// dropped in November 2026; older versions saved with that kind become client.
const RESULT_KINDS = ['client'];
// Who a result speaks to. Category says which service it came from; audience says
// which visitor should see themselves in it. Results saved before audience
// existed take it from their category.
const RESULT_AUDIENCES = ['competitor', 'transformation', 'everyday'];
const AUDIENCE_BY_CATEGORY = {
  competition: 'competitor',
  posing: 'competitor',
  online: 'everyday',
  training: 'everyday',
  lifestyle: 'everyday'
};
const RESULT_FITS = ['contain', 'cover'];

// The service a result came from is one of the site's services, stored by id so
// the story always shows that service's current name. Results saved before the
// field existed kept a typed name in `location`; those names map to an id here.
const SERVICE_IDS = require(path.join(SEED_DIR, 'services.json')).map((service) => service.id);
const SERVICE_ID_BY_NAME = {
  'competition preparation': 'competition-prep',
  'competition prep': 'competition-prep',
  'contest prep': 'competition-prep',
  'online coaching': 'online-coaching',
  'personal training': 'personal-training',
  posing: 'posing-only',
  'posing coaching': 'posing-only'
};

function resultServiceId(input) {
  if (SERVICE_IDS.includes(input.serviceId)) return input.serviceId;
  if (input.serviceId === '') return '';
  return SERVICE_ID_BY_NAME[text(input.location, 120).toLowerCase()] || '';
}

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

// Where a photo sits in a frame it is cropped to fill: the point that always stays
// in view (percent across and down) and how far it is zoomed in. Frames change
// shape between phone and desktop, so a point plus zoom suits any photo better
// than a fixed crop box.
const MAX_ZOOM = 3;

function framing(input = {}) {
  const zoom = Number(input.zoom);
  return {
    focus: { x: percent(input.focus?.x), y: percent(input.focus?.y) },
    zoom: Number.isFinite(zoom) ? Math.min(MAX_ZOOM, Math.max(1, Math.round(zoom * 100) / 100)) : 1
  };
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
  const category = oneOf(input.category, RESULT_CATEGORIES, 'competition');
  return {
    caption: text(input.caption, 160),
    alt: text(input.alt, 300),
    category,
    audience: oneOf(input.audience, RESULT_AUDIENCES, AUDIENCE_BY_CATEGORY[category]),
    kind: 'client',
    featured: Boolean(input.featured),
    image: { assetId: text(image.assetId, 80) || null, src: text(image.src, 1000) },
    presentation: presentation
      ? { fit: oneOf(presentation.fit, RESULT_FITS, 'contain'), ...framing(presentation) }
      : null,
    name: text(input.name, 160),
    serviceId: resultServiceId(input),
    duration: text(input.duration, 60),
    summary: text(input.summary, 1200),
    testimonial: input.testimonial ? normalizeTestimonial(input.testimonial) : null,
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
  if (draft.testimonial) {
    if (!draft.testimonial.quote) errors['testimonial.quote'] = 'Add the quote, or turn the testimonial off.';
    if (!draft.testimonial.author) errors['testimonial.author'] = 'Say who it is from. A first name or "Competition client" is fine.';
  }
  return errors;
}

function resultImageSrc(version, data) {
  if (version.image.assetId) return findAsset(data, version.image.assetId)?.url || '';
  return version.image.src;
}

// The exact shape public/content/results-library.json had, so the site's results
// components need no changes. Optional fields appear only when set.
function serviceName(data, serviceId) {
  if (!serviceId) return '';
  const service = (data.collections.services || []).find((record) => record.id === serviceId);
  return (service?.published || service?.draft)?.name || '';
}

function toPublicResult(record, data) {
  const version = record.published;
  const out = {
    id: record.id,
    src: resultImageSrc(version, data),
    alt: version.alt,
    caption: version.caption,
    category: version.category,
    audience: version.audience,
    kind: version.kind,
    featured: version.featured
  };
  if (version.presentation) out.presentation = version.presentation;
  if (version.name) out.name = version.name;
  const location = serviceName(data, version.serviceId);
  if (location) out.location = location;
  for (const field of ['duration', 'summary']) {
    if (version[field]) out[field] = version[field];
  }
  if (version.testimonial) out.testimonial = { ...version.testimonial };
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
    audience: version.audience,
    kind: version.kind,
    featured: version.featured
  };
}

// ── Testimonials ─────────────────────────────────────────────────────────────
// A testimonial is part of the result it belongs to (result.testimonial).

function normalizeTestimonial(input = {}) {
  return {
    quote: text(input.quote, 1200),
    author: text(input.author, 120),
    service: text(input.service, 120),
    result: text(input.result, 120)
  };
}

// Schema 2 (2026-10-20): stores from before kept testimonials as their own
// collection, linked from results by testimonialId. Each version of a result
// takes the matching version of its testimonial (a testimonial that was never
// published stays off the live result); unlinked ones were never on the site
// and are dropped.
function foldTestimonialsIntoResults(data) {
  const testimonials = data.collections.testimonials;
  if (!testimonials) return false;
  const byId = new Map(testimonials.map((record) => [record.id, record]));
  for (const result of data.collections.results || []) {
    for (const key of ['draft', 'published']) {
      const version = result[key];
      if (!version) continue;
      const linked = version.testimonialId && byId.get(version.testimonialId);
      result[key] = normalizeResult({ ...version, testimonial: linked?.[key] || null });
    }
  }
  delete data.collections.testimonials;
  return true;
}

// Results saved before the audience, service or client-only changes get them
// once: audience from the category, serviceId from the typed service name, and
// kind "client". Re-normalising a version only changes those fields, and both
// versions change alike, so a live result stays live with nothing to publish.
const needsBackfill = (version) => !version.audience || !Object.hasOwn(version, 'serviceId') || version.kind !== 'client';

function backfillResultAudience(data) {
  let changed = false;
  for (const result of data.collections.results || []) {
    for (const key of ['draft', 'published']) {
      const version = result[key];
      if (!version || !needsBackfill(version)) continue;
      result[key] = normalizeResult(version);
      changed = true;
    }
  }
  return changed;
}

// ── Placements ───────────────────────────────────────────────────────────────
// One record per media slot (mediaSlots.js) Jake has touched, keyed by slot id.
// assetId null means "use the site's built-in photo or video".

// The part of a video that loops on the page, in seconds (to a tenth). Only the
// start and end are kept; the file itself is never re-encoded.
const MIN_TRIM_SECONDS = 2;
const tenth = (value) => Math.round(value * 10) / 10;

function trimRange(input) {
  if (!input || typeof input !== 'object') return null;
  const start = Number(input.start);
  const end = Number(input.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start: tenth(start), end: tenth(end) };
}

function normalizePlacement(input = {}) {
  return { assetId: text(input.assetId, 80) || null, alt: text(input.alt, 300), ...framing(input), trim: trimRange(input.trim) };
}

function seconds(value) {
  const whole = Math.round(value);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function validateTrim(trim, asset) {
  if (!trim) return null;
  if (trim.start < 0 || trim.end <= trim.start) return 'The end of the loop needs to come after the start.';
  if (Number.isFinite(asset.duration) && trim.end > asset.duration) {
    return `This video is only ${seconds(asset.duration)} long. Move the end of the loop back.`;
  }
  if (tenth(trim.end - trim.start) < MIN_TRIM_SECONDS) return `The loop needs to be at least ${MIN_TRIM_SECONDS} seconds long.`;
  return null;
}

function validatePlacement(draft, data) {
  if (!draft.assetId) return {};
  const asset = findAsset(data, draft.assetId);
  if (!asset) return { assetId: 'That file is no longer in the media library. Choose another.' };
  if (asset.kind === 'image' && !draft.alt) return { alt: 'Describe the photo before it goes live.' };
  const trimError = asset.kind === 'video' ? validateTrim(draft.trim, asset) : null;
  return trimError ? { trim: trimError } : {};
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
    const { alt, focus, zoom, trim } = normalizePlacement(record.published);
    slots[record.id] = {
      kind: asset.kind, url: asset.url, posterUrl: asset.posterUrl || null, alt, focus, zoom,
      // Only a video plays, so only a video has a part that loops.
      trim: asset.kind === 'video' ? trim : null
    };
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
// A brand-new store starts from the JSON files the site used to serve. Client
// results go live unless the seed marks them hidden. Testimonials stay inside
// their result.

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
    const draft = normalizeResult({ ...item, image: { src: item.src } });
    return seedRecord({ id, order: item.order, draft, live: !item.hidden, now });
  });
}

// November 2026: four of the six original stage results were Akhil (two were the
// same photo), so the seed now hides them and rewrites the copy on the two kept.
// Stores seeded before that get the same change once, wherever a version still
// shows the seed's own photo:
// - the live version of the four is unpublished even if someone has edited its
//   words (it is reversible from the dashboard, and nothing is deleted);
// - on the two kept, each caption, headline, summary, length, stats list and
//   testimonial author/label is replaced only while it is still exactly the old
//   seed value, so anything Jake changed stays.
const SEED_REVISION = 'seed-results-2026-11';
// The old seed values on the two kept results. Each is replaced by the new seed
// value only while it is still exactly this (stats compared as a whole list).
const OLD_SEED_COPY = {
  1: {
    caption: 'ANB Champion — Competition Prep Client',
    name: 'ANB champion with stage-ready control',
    summary: 'A full prep result built around tighter presentation, clearer conditioning, and confidence when it mattered.',
    duration: '16 Weeks',
    stats: [
      { label: 'Service', value: 'Prep' },
      { label: 'Outcome', value: 'Gold', trend: 'up' },
      { label: 'Focus', value: 'Stage' }
    ],
    testimonial: { author: 'ANB Champion', result: 'Gold Medal Stage Result' }
  },
  4: {
    caption: 'Stage Presence — Online Coaching Client',
    name: 'Presentation that translated under lights',
    summary: 'A posing-focused result built around angles, transitions, breathing, and making the physique read from the judging table.',
    duration: '8 Weeks',
    stats: [
      { label: 'Service', value: 'Posing' },
      { label: 'Focus', value: 'Angles' },
      { label: 'Confidence', value: 'Higher', trend: 'up' }
    ],
    testimonial: { author: 'Posing Client', result: 'Stage Presence Transformation' }
  }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function applySeedRevision(data, { now, seedDir = SEED_DIR }) {
  data.migrations ??= [];
  if (data.migrations.includes(SEED_REVISION)) return false;
  const seedById = new Map(readSeed(seedDir, 'results-library.json').map((item) => [String(item.id), item]));
  for (const record of data.collections.results || []) {
    const item = seedById.get(record.id);
    if (!item) continue;
    // Each version is judged on its own photo: one Jake has swapped is no longer
    // one of Akhil's shots, so it is left exactly as it is.
    const showsSeedPhoto = (version) => Boolean(version) && !version.image?.assetId && version.image?.src === item.src;
    if (item.hidden) {
      if (showsSeedPhoto(record.published)) {
        record.published = null;
        record.hiddenAt = now;
      }
      continue;
    }
    const old = OLD_SEED_COPY[record.id];
    if (!old) continue;
    for (const key of ['draft', 'published']) {
      if (!showsSeedPhoto(record[key])) continue;
      const version = record[key];
      const copy = {};
      for (const field of ['caption', 'name', 'summary', 'duration', 'stats']) {
        if (same(version[field], old[field])) copy[field] = item[field] ?? '';
      }
      if (version.testimonial) {
        const testimonial = { ...version.testimonial };
        for (const field of ['author', 'result']) {
          if (testimonial[field] === old.testimonial[field]) testimonial[field] = item.testimonial[field];
        }
        copy.testimonial = testimonial;
      }
      record[key] = normalizeResult({ ...version, ...copy });
    }
  }
  data.migrations.push(SEED_REVISION);
  return true;
}

// November 2026: the seed used to add 114 stock "representative" photos, hidden,
// as examples. Jake never used them and their images no longer load, so stores
// seeded with them drop them once. Only the seed's own ids go, and any one whose
// photo has been swapped for an upload is kept.
const PLACEHOLDER_REVISION = 'remove-placeholder-results-2026-11';
const PLACEHOLDER_ID = /^reference-(competition|posing|online|training|lifestyle)-\d+$/;

function removePlaceholderResults(data) {
  data.migrations ??= [];
  if (data.migrations.includes(PLACEHOLDER_REVISION)) return false;
  const hasUpload = (version) => Boolean(version?.image?.assetId);
  data.collections.results = (data.collections.results || []).filter((record) => (
    !PLACEHOLDER_ID.test(record.id) || hasUpload(record.draft) || hasUpload(record.published)
  ));
  data.migrations.push(PLACEHOLDER_REVISION);
  return true;
}

// November 2026: Akhil rewrote the results' captions, headlines, summaries and
// search words (seed/results-copy-2026-11.json) and took his kneeling-pose
// result off the site. Each version of a result takes a new field only while
// that field still reads exactly as before, so anything Jake has changed stays.
// Taking the pose offline is reversible from the dashboard; nothing is deleted.
const COPY_REVISION = 'results-copy-2026-11';

function applyResultsCopy(data, { now, seedDir = SEED_DIR }) {
  data.migrations ??= [];
  if (data.migrations.includes(COPY_REVISION)) return false;
  const copy = readSeed(seedDir, 'results-copy-2026-11.json');
  for (const record of data.collections.results || []) {
    if (copy.hide.includes(record.id) && record.published) {
      record.published = null;
      record.hiddenAt = now;
    }
    const change = copy.results[record.id];
    if (!change) continue;
    for (const key of ['draft', 'published']) {
      const version = record[key];
      if (!version) continue;
      const next = {};
      for (const [field, before] of Object.entries(change.from)) {
        if (same(version[field], before)) next[field] = change.to[field];
      }
      if (Object.keys(next).length) record[key] = normalizeResult({ ...version, ...next });
    }
  }
  data.migrations.push(COPY_REVISION);
  return true;
}

// Results list newest first, on the dashboard and the site. Results added in one
// import share a timestamp, so their saved order breaks the tie.
function newestFirst(records) {
  return [...(records || [])].sort((a, b) => (
    String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.order - b.order
  ));
}

// Public outputs the site reads, built from live records only.
const PUBLIC_OUTPUTS = {
  results: (data) => newestFirst(data.collections.results).filter((record) => record.published)
    .map((record) => toPublicResult(record, data)),
  slots: (data) => publicSlots(data),
  services: services.publicServices,
  faqs: services.publicFaqs,
  settings: (data) => publicSettings(data.settings)
};

const COLLECTIONS = {
  results: {
    label: 'result',
    publicCollection: 'results',
    normalizeDraft: normalizeResult,
    validateForPublish: validateResult,
    summarize: summarizeResult,
    sort: newestFirst,
    seed: seedResults
  },
  services: {
    label: 'service',
    publicCollection: 'services',
    // Service ids and links are hard-coded elsewhere on the site, so the four
    // services always exist and stay live.
    canCreate: false,
    canDelete: false,
    canHide: false,
    normalizeDraft: services.normalizeService,
    validateForPublish: services.validateService,
    summarize: services.summarizeService,
    seed: (options) => services.seedServices({ ...options, seedRecord })
  },
  faqs: {
    label: 'question',
    publicCollection: 'faqs',
    normalizeDraft: services.normalizeFaq,
    validateForPublish: services.validateFaq,
    summarize: services.summarizeFaq,
    seed: (options) => services.seedFaqs({ ...options, seedRecord })
  },
  placements: {
    label: 'page image',
    publicCollection: 'slots',
    // Records appear the first time Jake picks something for a slot. A page
    // always shows an image, so one is never taken offline, only replaced.
    createOnSave: true,
    canCreate: false,
    canDelete: false,
    canHide: false,
    normalizeDraft: normalizePlacement,
    validateForPublish: validatePlacement,
    summarize: summarizePlacement,
    seed: () => []
  }
};

module.exports = {
  COLLECTIONS,
  applySeedRevision,
  applyResultsCopy,
  removePlaceholderResults,
  PUBLIC_OUTPUTS,
  backfillResultAudience,
  foldTestimonialsIntoResults,
  mediaUsage,
  RESULT_AUDIENCES,
  RESULT_CATEGORIES,
  RESULT_KINDS,
  SEED_DIR,
  normalizeResult,
  seedRecord,
  text
};

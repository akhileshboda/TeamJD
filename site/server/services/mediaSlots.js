const fs = require('fs/promises');
const path = require('path');

// A "slot" is one place on the public site where Jake can swap the photo or video.
// The site keeps its built-in media as the default for every slot; the store below only
// records what Jake has replaced. Slot ids are referenced verbatim by client components
// (see mediaSlots.test.js, which checks the two stay in step).

const ROOT = path.join(__dirname, '..', '..');
const SERVICES_PATH = path.join(ROOT, 'public', 'content', 'services.json');
const STORE_PATH = path.join(ROOT, 'data', 'media-slots.json');
const HISTORY_LIMIT = 10;

const PORTRAIT = { hint: 'Portrait photo, at least 1200 × 1500 px', minWidth: 1200 };
const LANDSCAPE = { hint: 'Landscape photo, at least 1920 × 1080 px', minWidth: 1600 };
const SQUARE = { hint: 'Square or portrait photo, at least 1000 px wide', minWidth: 1000 };
const REEL = { hint: 'Video up to 3 minutes. It plays muted, so sound is removed.' };

const CONTACT_SOCIAL = [
  ['Stage work', 'gallery-social-facebook-stage-2022'],
  ['Editorial physique', 'gallery-social-facebook-editorial-2022'],
  ['Competition day', 'gallery-social-facebook-coaching-2020'],
  ['Training detail', 'gallery-social-facebook-training-detail-2019'],
  ['Studio portrait', 'gallery-social-facebook-studio-portrait-2019'],
  ['In the gym', 'gallery-social-facebook-gym-2019'],
  ['Training progress', 'gallery-jake-training-facebook-2019']
];

const STATIC_SLOTS = [
  {
    id: 'home.hero-video', page: 'Home', category: 'video', kind: 'video',
    label: 'Top-of-page background video',
    hint: 'Landscape video, 10–30 seconds, loops silently behind the headline.',
    // The built-in hero lives outside the manifest, straight on the R2 public domain.
    defaultPath: 'hero-output/hero-home-poster-v1.jpg'
  },
  { id: 'home.about-photo', page: 'Home', category: 'home', kind: 'image', label: '“Meet Jake” photo', defaultKey: 'jake-hero', ...PORTRAIT },
  { id: 'about.portrait', page: 'About', category: 'about', kind: 'image', label: 'Main portrait', defaultKey: 'jake-hero', ...PORTRAIT },
  { id: 'about.process-1', page: 'About', category: 'about', kind: 'image', label: 'Coaching process photo 1', defaultKey: 'jake-stage', ...LANDSCAPE },
  { id: 'about.process-2', page: 'About', category: 'about', kind: 'image', label: 'Coaching process photo 2', defaultKey: 'gallery-social-facebook-coaching-2020', ...LANDSCAPE },
  { id: 'about.process-3', page: 'About', category: 'about', kind: 'image', label: 'Coaching process photo 3', defaultKey: 'gallery-jake-training-facebook-2019', ...LANDSCAPE },
  {
    id: 'contact.reel', page: 'Contact', category: 'video', kind: 'video',
    label: '“In the work” video reel', defaultKey: 'video-contact-athlete-reel-poster', ...REEL
  },
  ...CONTACT_SOCIAL.map(([label, defaultKey], index) => ({
    id: `contact.social-${index + 1}`, page: 'Contact', category: 'gallery', kind: 'image',
    label: `Social strip: ${label}`, defaultKey, ...SQUARE
  }))
];

function serviceSlots(service) {
  const base = { page: service.name, category: 'services', kind: 'image' };
  const slot = (key, label, defaultKey, size) => ({
    ...base, id: `services.${service.slug}.${key}`, label, defaultKey: defaultKey || null, ...size
  });
  const gallery = service.gallery_images || [];
  const venue = service.venue?.images || [];

  return [
    slot('hero', 'Main photo (also used on the Home and Services cards)', service.hero_image, PORTRAIT),
    slot('body', 'Supporting photo', service.body_image, PORTRAIT),
    slot('banner', 'Wide banner photo', service.banner_image, { hint: 'Wide landscape photo, at least 2400 × 1000 px', minWidth: 2000 }),
    ...[1, 2, 3, 4, 5].map((n) => slot(`gallery-${n}`, `Gallery photo ${n}`, gallery[n - 1], LANDSCAPE)),
    ...venue.map((image, index) => slot(`venue-${index + 1}`, `Venue photo ${index + 1}`, image.asset, LANDSCAPE))
  ];
}

async function listSlotDefinitions() {
  const services = JSON.parse(await fs.readFile(SERVICES_PATH, 'utf8'));
  return [...STATIC_SLOTS, ...services.flatMap(serviceSlots)];
}

async function getSlotDefinition(slotId) {
  return (await listSlotDefinitions()).find((slot) => slot.id === slotId) || null;
}

// ── Store ────────────────────────────────────────────────────────────────────
// { slots: { [slotId]: { current: Version | null, history: Version[] } } }
// Version: { assetKey, url, posterUrl?, kind, alt, width?, height?, bytes, dropboxPath, uploadedAt, uploadedBy }

let storeCache = null;
let writeQueue = Promise.resolve();

async function readStore(storePath = STORE_PATH) {
  if (storeCache && storeCache.path === storePath) return storeCache.data;
  let data;
  try {
    data = JSON.parse(await fs.readFile(storePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    data = { slots: {} };
  }
  storeCache = { path: storePath, data };
  return data;
}

// Serialise every mutation so two quick edits cannot interleave read-modify-write.
function updateStore(mutate, { storePath = STORE_PATH, backup } = {}) {
  const run = writeQueue.then(async () => {
    const current = await readStore(storePath);
    const next = structuredClone(current);
    const result = mutate(next);
    const tmpPath = `${storePath}.tmp`;
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(tmpPath, `${JSON.stringify(next, null, 2)}\n`);
    await fs.rename(tmpPath, storePath);
    storeCache = { path: storePath, data: next };
    if (backup) backup(next).catch((error) => console.error('[cms] slot backup failed:', error.message));
    return result;
  });
  writeQueue = run.catch(() => {});
  return run;
}

function slotEntry(store, slotId) {
  store.slots[slotId] ??= { current: null, history: [] };
  return store.slots[slotId];
}

function pushHistory(entry) {
  if (entry.current) entry.history = [entry.current, ...entry.history].slice(0, HISTORY_LIMIT);
}

function assignVersion(slotId, version, options) {
  return updateStore((store) => {
    const entry = slotEntry(store, slotId);
    pushHistory(entry);
    entry.current = version;
    return entry;
  }, options);
}

function restoreVersion(slotId, assetKey, options) {
  return updateStore((store) => {
    const entry = slotEntry(store, slotId);
    const index = entry.history.findIndex((version) => version.assetKey === assetKey);
    if (index === -1) throw Object.assign(new Error('That version is no longer available.'), { statusCode: 404 });
    const [restored] = entry.history.splice(index, 1);
    pushHistory(entry);
    entry.current = restored;
    return entry;
  }, options);
}

function resetSlot(slotId, options) {
  return updateStore((store) => {
    const entry = slotEntry(store, slotId);
    pushHistory(entry);
    entry.current = null;
    return entry;
  }, options);
}

function setAltText(slotId, alt, options) {
  return updateStore((store) => {
    const entry = slotEntry(store, slotId);
    if (!entry.current) throw Object.assign(new Error('Upload a photo before adding a description.'), { statusCode: 409 });
    entry.current.alt = alt;
    return entry;
  }, options);
}

// What the public site needs: only replaced slots, only render fields.
async function getPublicSlots(storePath) {
  const store = await readStore(storePath);
  const out = {};
  for (const [slotId, { current }] of Object.entries(store.slots)) {
    if (!current) continue;
    out[slotId] = { kind: current.kind, url: current.url, posterUrl: current.posterUrl || null, alt: current.alt || '' };
  }
  return out;
}

function resetStoreCache() {
  storeCache = null;
}

module.exports = {
  HISTORY_LIMIT,
  assignVersion,
  getPublicSlots,
  getSlotDefinition,
  listSlotDefinitions,
  readStore,
  resetSlot,
  resetStoreCache,
  restoreVersion,
  setAltText
};

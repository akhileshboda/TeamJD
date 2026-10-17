const fs = require('fs/promises');
const path = require('path');

// A "slot" is one place on the public site where Jake can swap the photo or video.
// The site keeps its built-in media as the default for every slot; the dashboard's
// "placements" collection (cmsCollections.js) records what Jake has chosen instead.
// Slot ids are referenced verbatim by client components (see mediaSlots.test.js,
// which checks the two stay in step).

const SEED_SERVICES = path.join(__dirname, '..', 'seed', 'services.json');

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
    id: 'home.hero-video', page: 'Home', pagePath: '/', category: 'video', kind: 'video',
    label: 'Top-of-page background video',
    hint: 'Landscape video, 10–30 seconds, loops silently behind the headline.',
    // The built-in hero lives outside the manifest, straight on the R2 public domain.
    defaultPath: 'hero-output/hero-home-poster-v1.jpg'
  },
  { id: 'home.about-photo', page: 'Home', pagePath: '/', category: 'home', kind: 'image', label: '“Meet Jake” photo', defaultKey: 'jake-hero', ...PORTRAIT },
  { id: 'about.portrait', page: 'About', pagePath: '/about', category: 'about', kind: 'image', label: 'Main portrait', defaultKey: 'jake-hero', ...PORTRAIT },
  { id: 'about.process-1', page: 'About', pagePath: '/about', category: 'about', kind: 'image', label: 'Coaching process photo 1', defaultKey: 'jake-stage', ...LANDSCAPE },
  { id: 'about.process-2', page: 'About', pagePath: '/about', category: 'about', kind: 'image', label: 'Coaching process photo 2', defaultKey: 'gallery-social-facebook-coaching-2020', ...LANDSCAPE },
  { id: 'about.process-3', page: 'About', pagePath: '/about', category: 'about', kind: 'image', label: 'Coaching process photo 3', defaultKey: 'gallery-jake-training-facebook-2019', ...LANDSCAPE },
  {
    id: 'contact.reel', page: 'Contact', pagePath: '/contact', category: 'video', kind: 'video',
    label: '“In the work” video reel', defaultKey: 'video-contact-athlete-reel-poster', ...REEL
  },
  ...CONTACT_SOCIAL.map(([label, defaultKey], index) => ({
    id: `contact.social-${index + 1}`, page: 'Contact', pagePath: '/contact', category: 'gallery', kind: 'image',
    label: `Social strip: ${label}`, defaultKey, ...SQUARE
  }))
];

function serviceSlots(service) {
  const base = { page: service.name, pagePath: `/services/${service.slug}`, category: 'services', kind: 'image' };
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

// `services` is the live list from the content store; the seed file stands in
// where there is no store (tests, scripts). Slot ids and defaults come from fields
// the dashboard locks, so both give the same spots.
async function listSlotDefinitions(services) {
  const list = services || JSON.parse(await fs.readFile(SEED_SERVICES, 'utf8'));
  return [...STATIC_SLOTS, ...list.flatMap(serviceSlots)];
}

async function getSlotDefinition(slotId, services) {
  return (await listSlotDefinitions(services)).find((slot) => slot.id === slotId) || null;
}

module.exports = {
  getSlotDefinition,
  listSlotDefinitions
};

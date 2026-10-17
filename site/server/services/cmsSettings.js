// Site settings Jake changes from the dashboard. Unlike content they are not
// drafted: saving applies them at once (the dashboard confirms the risky ones).
//
//   contact   email and social links shown in the footer, Contact and 404 pages
//   seo       per-page search title and description; empty means the page's own
//   enquiries where contact-form enquiries go; empty means the .env address
//   site      whether visitors see the site or the under-construction page;
//             'default' follows MAINTENANCE_MODE in .env

const SEO_PAGES = ['home', 'about', 'services', 'results', 'contact', 'privacy'];
const VISIBILITY = ['default', 'live', 'maintenance'];

const DEFAULT_SETTINGS = Object.freeze({
  contact: {
    email: 'jake@team-jd.com.au',
    instagramUrl: 'https://www.instagram.com/jake_dedert_teamjd_coaching/',
    instagramHandle: 'jake_dedert_teamjd_coaching',
    facebookUrl: 'https://www.facebook.com/p/Jake-Dedert-Team-JD-Coaching-100063678694779/'
  },
  seo: Object.fromEntries(SEO_PAGES.map((page) => [page, { title: '', description: '' }])),
  enquiries: { sendTo: '' },
  site: { visibility: 'default' }
});

class SettingsError extends Error {
  constructor(message, fields) {
    super(message);
    this.statusCode = 422;
    this.fields = fields;
  }
}

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isHttps = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch (_error) {
    return false;
  }
};

const SECTIONS = {
  contact(input) {
    const value = {
      email: text(input.email, 254).toLowerCase(),
      instagramUrl: text(input.instagramUrl, 300),
      instagramHandle: text(input.instagramHandle, 60).replace(/^@/, ''),
      facebookUrl: text(input.facebookUrl, 300)
    };
    const errors = {};
    if (value.email && !isEmail(value.email)) errors.email = 'Enter a full email address.';
    if (value.instagramUrl && !isHttps(value.instagramUrl)) errors.instagramUrl = 'Paste the full link, starting with https://';
    if (value.facebookUrl && !isHttps(value.facebookUrl)) errors.facebookUrl = 'Paste the full link, starting with https://';
    return { value, errors };
  },
  seo(input) {
    const value = Object.fromEntries(SEO_PAGES.map((page) => [page, {
      title: text(input[page]?.title, 70),
      description: text(input[page]?.description, 200)
    }]));
    return { value, errors: {} };
  },
  enquiries(input) {
    const value = { sendTo: text(input.sendTo, 254).toLowerCase() };
    const errors = value.sendTo && !isEmail(value.sendTo) ? { sendTo: 'Enter a full email address.' } : {};
    return { value, errors };
  },
  site(input) {
    return { value: { visibility: VISIBILITY.includes(input.visibility) ? input.visibility : 'default' }, errors: {} };
  }
};

// Stored settings over the defaults, section by section, so a store from before
// a section existed still answers sensibly.
function withDefaults(stored = {}) {
  const out = structuredClone(DEFAULT_SETTINGS);
  for (const section of Object.keys(SECTIONS)) {
    if (stored[section]) out[section] = { ...out[section], ...structuredClone(stored[section]) };
  }
  return out;
}

function normalizeSection(section, input) {
  const normalize = Object.hasOwn(SECTIONS, section) ? SECTIONS[section] : null;
  if (!normalize) throw Object.assign(new Error('That settings section does not exist.'), { statusCode: 404 });
  const { value, errors } = normalize(input || {});
  if (Object.keys(errors).length) throw new SettingsError('Some settings need attention.', errors);
  return value;
}

// What the public site may see: never where enquiries go or site controls.
function publicSettings(settings) {
  const { contact, seo } = withDefaults(settings);
  return { contact, seo };
}

module.exports = { DEFAULT_SETTINGS, SEO_PAGES, normalizeSection, publicSettings, withDefaults };

const path = require('path');

const CATEGORIES = [
  'home',
  'about',
  'services',
  'results',
  'testimonials',
  'gallery',
  'branding',
  'video',
  'misc'
];

const SUPPORTED_ASSET_TYPES = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp'
};

const CATEGORY_KEYWORDS = {
  home: ['hero', 'home', 'homepage', 'landing', 'banner'],
  about: ['about', 'jake', 'coach', 'profile', 'bio'],
  services: ['service', 'coaching', 'program', 'nutrition', 'training'],
  results: ['result', 'results', 'transformation', 'before', 'after', 'progress', 'client-comp', 'client-posing'],
  testimonials: ['testimonial', 'testimonials', 'review', 'client-quote', 'quote'],
  gallery: ['gallery', 'lifestyle', 'gym', 'photo'],
  branding: ['logo', 'mark', 'icon', 'favicon', 'brand'],
  video: ['webm', 'mp4', 'loop', 'reel', 'motion', 'video']
};

function getExtension(fileName = '') {
  return path.extname(fileName).toLowerCase();
}

function isSupportedAsset(fileName = '') {
  return Boolean(SUPPORTED_ASSET_TYPES[getExtension(fileName)]);
}

function getContentType(fileNameOrExtension = '') {
  const extension = String(fileNameOrExtension).startsWith('.')
    ? String(fileNameOrExtension).toLowerCase()
    : getExtension(fileNameOrExtension);

  return SUPPORTED_ASSET_TYPES[extension] || 'application/octet-stream';
}

function normalizeBasename(rawName = '') {
  return String(rawName)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeAssetFileName(fileName = '') {
  const extension = getExtension(fileName);
  const basename = normalizeBasename(path.basename(fileName, path.extname(fileName))) || 'asset';
  return `${basename}${extension}`;
}

function getAssetKey(fileName = '') {
  return normalizeBasename(path.basename(fileName, path.extname(fileName))) || 'asset';
}

function classifyAsset({ fileName = '', dropboxPath = '' } = {}) {
  const extension = getExtension(fileName);
  const haystack = `${dropboxPath} ${fileName}`.toLowerCase().replace(/[_\s]+/g, '-');
  const normalizedFileName = normalizeAssetFileName(fileName);

  if (['.webm', '.mp4'].includes(extension)) {
    return 'video';
  }

  const explicitCategory = CATEGORIES.find((category) =>
    category !== 'misc' && (
      normalizedFileName.startsWith(`${category}-`) ||
      haystack.includes(`/assets/${category}/`)
    )
  );

  if (explicitCategory) {
    return explicitCategory;
  }

  for (const category of CATEGORIES) {
    if (category === 'misc') continue;
    const keywords = CATEGORY_KEYWORDS[category] || [];
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return category;
    }
  }

  return 'misc';
}

function createAssetVersion(file = {}) {
  return [
    file.rev,
    file.content_hash || file.contentHash,
    file.size,
    file.server_modified || file.serverModified,
    file.client_modified || file.clientModified
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map((value) => String(value))
    .join(':');
}

function createR2ObjectKey({ assetPrefix = 'site-assets', category, fileName }) {
  return [assetPrefix, category, fileName]
    .filter(Boolean)
    .map((segment) => String(segment).replace(/^\/+|\/+$/g, ''))
    .join('/');
}

function normalizeDropboxPath(rawPath = '') {
  if (!rawPath) return '';
  const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return withLeadingSlash.replace(/\/+/g, '/').replace(/\/$/, '') || '';
}

function joinDropboxPath(...segments) {
  return normalizeDropboxPath(
    segments
      .filter(Boolean)
      .map((segment) => String(segment).replace(/^\/+|\/+$/g, ''))
      .join('/')
  );
}

function isPathInside(parentPath, candidatePath) {
  const parent = normalizeDropboxPath(parentPath).toLowerCase();
  const candidate = normalizeDropboxPath(candidatePath).toLowerCase();

  if (!parent) return false;
  return candidate === parent || candidate.startsWith(`${parent}/`);
}

function withCollisionSuffix(fileName, suffix) {
  const extension = getExtension(fileName);
  const basename = path.basename(fileName, extension);
  return `${basename}-${suffix}${extension}`;
}

function getSafeFileName(preferredName, reservedNames = new Set()) {
  const normalizedReserved = new Set(
    Array.from(reservedNames).map((name) => String(name).toLowerCase())
  );
  let candidate = normalizeAssetFileName(preferredName);
  let suffix = 2;

  while (normalizedReserved.has(candidate.toLowerCase())) {
    candidate = withCollisionSuffix(normalizeAssetFileName(preferredName), suffix);
    suffix += 1;
  }

  return candidate;
}

module.exports = {
  CATEGORIES,
  SUPPORTED_ASSET_TYPES,
  classifyAsset,
  createAssetVersion,
  createR2ObjectKey,
  getAssetKey,
  getContentType,
  getExtension,
  getSafeFileName,
  isPathInside,
  isSupportedAsset,
  joinDropboxPath,
  normalizeAssetFileName,
  normalizeBasename,
  normalizeDropboxPath
};

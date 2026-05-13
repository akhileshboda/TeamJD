const path = require('path');
const { Dropbox, DropboxAuth } = require('dropbox');
const { normalizeDropboxUrl } = require('../utils/url');

const DEFAULT_ASSET_MAP = {
  'ab-posing':
    'https://www.dropbox.com/scl/fi/hma3vqxbhdtwqvgug8cq7/ab-posing.jpg?rlkey=b2cdcaibl5b6u83jc9ji8y344&st=snwbqvra&dl=0'
};

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedAssetMap = null;
let cachedAt = 0;
let pendingAssetMap = null;

function getCacheTtlMs() {
  const configuredTtl = Number(process.env.DROPBOX_ASSET_CACHE_TTL_MS);

  return Number.isFinite(configuredTtl) && configuredTtl >= 0
    ? configuredTtl
    : DEFAULT_CACHE_TTL_MS;
}

function getConfiguredAssetMap() {
  const rawAssetMap = process.env.DROPBOX_ASSET_MAP;

  if (!rawAssetMap) {
    return DEFAULT_ASSET_MAP;
  }

  try {
    const parsedAssetMap = JSON.parse(rawAssetMap);
    return {
      ...DEFAULT_ASSET_MAP,
      ...parsedAssetMap
    };
  } catch (error) {
    throw new Error('DROPBOX_ASSET_MAP must be valid JSON.');
  }
}

function hasConfiguredAssetMap() {
  return Boolean(process.env.DROPBOX_ASSET_MAP) || Object.keys(DEFAULT_ASSET_MAP).length > 0;
}

function getAssetServiceStatus() {
  return {
    dropboxApiConfigured: Boolean(process.env.DROPBOX_REFRESH_TOKEN),
    assetRootPath: process.env.DROPBOX_ASSET_ROOT_PATH || '',
    cacheTtlMs: getCacheTtlMs(),
    hasCachedAssetMap: Boolean(cachedAssetMap),
    cachedAt: cachedAt ? new Date(cachedAt).toISOString() : null,
    hasConfiguredFallbackAssets: hasConfiguredAssetMap()
  };
}

function createDropboxClient(authState = {}) {
  const refreshToken = authState.refreshToken || process.env.DROPBOX_REFRESH_TOKEN;
  const accessToken = authState.accessToken;

  if (!refreshToken && !accessToken) {
    return null;
  }

  const auth = new DropboxAuth({
    clientId: process.env.DROPBOX_APP_KEY,
    clientSecret: process.env.DROPBOX_APP_SECRET,
    accessToken,
    refreshToken
  });

  return new Dropbox({ auth });
}

function isFileEntry(entry) {
  return entry?.['.tag'] === 'file';
}

function isFolderEntry(entry) {
  return entry?.['.tag'] === 'folder';
}

function isImageFile(entry) {
  return isFileEntry(entry) && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase());
}

function createAssetKey(fileName) {
  const extension = path.extname(fileName);
  const basename = path.basename(fileName, extension);

  return basename
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getUniqueAssetKey(assetMap, preferredKey) {
  const baseKey = preferredKey || 'asset';
  let assetKey = baseKey;
  let suffix = 2;

  while (assetMap[assetKey]) {
    assetKey = `${baseKey}-${suffix}`;
    suffix += 1;
  }

  return assetKey;
}

function toStaticAssetMap(rawAssetMap) {
  return Object.entries(rawAssetMap).reduce((assetMap, [assetKey, assetConfig]) => {
    const sharedUrl = typeof assetConfig === 'string' ? assetConfig : assetConfig?.url;

    if (!sharedUrl) {
      return assetMap;
    }

    assetMap[assetKey] = {
      url: normalizeDropboxUrl(sharedUrl),
      name: assetConfig?.name || path.basename(new URL(sharedUrl).pathname),
      path: assetConfig?.path || null,
      source: 'configured'
    };

    return assetMap;
  }, {});
}

async function listDropboxEntries(dropboxClient, folderPath) {
  const entries = [];
  let response = await dropboxClient.filesListFolder({
    path: folderPath,
    recursive: true,
    include_deleted: false,
    include_non_downloadable_files: false
  });

  entries.push(...response.result.entries);

  while (response.result.has_more) {
    response = await dropboxClient.filesListFolderContinue({
      cursor: response.result.cursor
    });
    entries.push(...response.result.entries);
  }

  return entries;
}

async function listDropboxFiles(dropboxClient, folderPath) {
  const entries = await listDropboxEntries(dropboxClient, folderPath);

  return entries.filter(isImageFile);
}

function toDiscoveryFile(entry) {
  return {
    name: entry.name,
    path: entry.path_display,
    extension: path.extname(entry.name).toLowerCase(),
    size: entry.size,
    clientModified: entry.client_modified,
    serverModified: entry.server_modified,
    assetKey: createAssetKey(entry.name)
  };
}

async function discoverDropboxAssets(options = {}) {
  const dropboxClient = createDropboxClient(options.authState);

  if (!dropboxClient) {
    throw new Error('Dropbox refresh token is not configured.');
  }

  const folderPath =
    typeof options.folderPath === 'string' ? options.folderPath : process.env.DROPBOX_ASSET_ROOT_PATH || '';
  const entries = await listDropboxEntries(dropboxClient, folderPath);
  const imageFiles = entries.filter(isImageFile);
  const unsupportedFiles = entries.filter((entry) => isFileEntry(entry) && !isImageFile(entry));
  const folders = entries.filter(isFolderEntry);

  return {
    folderPath,
    recursive: true,
    supportedExtensions: Array.from(IMAGE_EXTENSIONS).sort(),
    counts: {
      totalEntries: entries.length,
      folders: folders.length,
      files: imageFiles.length + unsupportedFiles.length,
      images: imageFiles.length,
      unsupportedFiles: unsupportedFiles.length
    },
    images: imageFiles.map(toDiscoveryFile),
    folders: folders.map((entry) => ({
      name: entry.name,
      path: entry.path_display
    })),
    unsupportedFiles: unsupportedFiles.map(toDiscoveryFile)
  };
}

async function getOrCreateSharedLink(dropboxClient, filePath) {
  const sharedLinks = await dropboxClient.sharingListSharedLinks({
    path: filePath,
    direct_only: true
  });
  const existingLink = sharedLinks.result.links?.[0]?.url;

  if (existingLink) {
    return existingLink;
  }

  try {
    const createdLink = await dropboxClient.sharingCreateSharedLinkWithSettings({
      path: filePath
    });

    return createdLink.result.url;
  } catch (error) {
    const retryLinks = await dropboxClient.sharingListSharedLinks({
      path: filePath,
      direct_only: true
    });
    const retryLink = retryLinks.result.links?.[0]?.url;

    if (retryLink) {
      return retryLink;
    }

    throw error;
  }
}

async function buildDropboxAssetMap(authState = {}) {
  const dropboxClient = createDropboxClient(authState);

  if (!dropboxClient) {
    return toStaticAssetMap(getConfiguredAssetMap());
  }

  const folderPath = process.env.DROPBOX_ASSET_ROOT_PATH || '';
  const files = await listDropboxFiles(dropboxClient, folderPath);
  const assetMap = {};

  for (const file of files) {
    const preferredKey = createAssetKey(file.name);
    const assetKey = getUniqueAssetKey(assetMap, preferredKey);
    const sharedUrl = await getOrCreateSharedLink(dropboxClient, file.path_lower || file.path_display);

    assetMap[assetKey] = {
      url: normalizeDropboxUrl(sharedUrl),
      name: file.name,
      path: file.path_display,
      id: file.id,
      rev: file.rev,
      size: file.size,
      clientModified: file.client_modified,
      serverModified: file.server_modified,
      source: 'dropbox'
    };
  }

  return assetMap;
}

async function getAssetMap(options = {}) {
  const { forceRefresh = false, authState } = options;
  const now = Date.now();
  const cacheTtlMs = getCacheTtlMs();

  if (!forceRefresh && cachedAssetMap && now - cachedAt < cacheTtlMs) {
    return cachedAssetMap;
  }

  if (!forceRefresh && pendingAssetMap) {
    return pendingAssetMap;
  }

  pendingAssetMap = buildDropboxAssetMap(authState)
    .then((assetMap) => {
      cachedAssetMap = assetMap;
      cachedAt = Date.now();
      return assetMap;
    })
    .finally(() => {
      pendingAssetMap = null;
    });

  return pendingAssetMap;
}

async function refreshAssetMap(options = {}) {
  return getAssetMap({ ...options, forceRefresh: true });
}

async function getAssetUrl(assetKey, options = {}) {
  const assetMap = await getAssetMap(options);
  const asset = assetMap[assetKey];

  if (!asset) {
    return null;
  }

  return asset.url;
}

module.exports = {
  discoverDropboxAssets,
  getAssetServiceStatus,
  getAssetMap,
  getAssetUrl,
  refreshAssetMap
};

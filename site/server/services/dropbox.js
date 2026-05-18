const fs = require('fs/promises');
const path = require('path');
const { Dropbox, DropboxAuth } = require('dropbox');

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEV_ASSET_CACHE_SECONDS = 5 * 60;
const MANIFEST_PATH = path.join(__dirname, '..', '..', 'data', 'asset-manifest.json');
const GENERATED_ASSETS_DIR = path.join(__dirname, '..', '..', 'public', 'assets', 'generated');
const IMAGE_CONTENT_TYPES = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

let cachedAssetMap = null;
let cachedManifest = null;
let cachedAt = 0;
let pendingAssetMapRefresh = null;

const assetMapState = {
  preloadAttempted: false,
  state: 'idle',
  source: null,
  lastLoadStartedAt: null,
  lastLoadCompletedAt: null,
  lastSuccessfulLoadAt: null,
  diskManifestLoaded: false,
  diskManifestFile: path.basename(MANIFEST_PATH),
  lastError: null,
  refreshInProgress: false
};

class AssetMapNotReadyError extends Error {
  constructor(message = 'Asset map is not ready.') {
    super(message);
    this.name = 'AssetMapNotReadyError';
    this.statusCode = 503;
  }
}

class AssetNotFoundError extends Error {
  constructor(message = 'Asset not found.') {
    super(message);
    this.name = 'AssetNotFoundError';
    this.statusCode = 404;
  }
}

function isProductionAssetMode() {
  return process.env.NODE_ENV === 'production';
}

function getCacheTtlMs() {
  const configuredTtl = Number(process.env.DROPBOX_ASSET_CACHE_TTL_MS);

  return Number.isFinite(configuredTtl) && configuredTtl >= 0
    ? configuredTtl
    : DEFAULT_CACHE_TTL_MS;
}

function getAssetServiceStatus() {
  const assetCount = cachedAssetMap ? Object.keys(cachedAssetMap).length : 0;

  return {
    dropboxApiConfigured: Boolean(process.env.DROPBOX_REFRESH_TOKEN),
    assetMode: isProductionAssetMode() ? 'production-sync' : 'runtime-discovery',
    assetRootPath: process.env.DROPBOX_ASSET_ROOT_PATH || '',
    cacheTtlMs: getCacheTtlMs(),
    cacheReady: Boolean(cachedAssetMap),
    hasCachedAssetMap: Boolean(cachedAssetMap),
    assetCount,
    manifestGeneratedAt: cachedManifest?.generatedAt || null,
    diskManifestLoaded: assetMapState.diskManifestLoaded,
    diskManifestFile: assetMapState.diskManifestFile,
    cachedAt: cachedAt ? new Date(cachedAt).toISOString() : null,
    preloadAttempted: assetMapState.preloadAttempted,
    state: assetMapState.state,
    source: assetMapState.source,
    refreshInProgress: assetMapState.refreshInProgress,
    lastLoadStartedAt: assetMapState.lastLoadStartedAt,
    lastLoadCompletedAt: assetMapState.lastLoadCompletedAt,
    lastSuccessfulLoadAt: assetMapState.lastSuccessfulLoadAt,
    lastError: assetMapState.lastError
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

function createAssetManifest(assetMap, source, generatedAt = new Date().toISOString()) {
  return {
    generatedAt,
    source,
    assetCount: Object.keys(assetMap).length,
    assets: assetMap
  };
}

function normalizeManifest(rawManifest, fallbackSource = 'disk') {
  if (!rawManifest?.assets || typeof rawManifest.assets !== 'object') {
    throw new Error('Asset manifest must include an assets object.');
  }

  return {
    generatedAt: rawManifest.generatedAt || new Date().toISOString(),
    source: rawManifest.source || fallbackSource,
    assetCount: Object.keys(rawManifest.assets).length,
    assets: rawManifest.assets
  };
}

async function readDiskManifest() {
  const rawManifest = await fs.readFile(MANIFEST_PATH, 'utf8');
  return normalizeManifest(JSON.parse(rawManifest), 'disk');
}

async function writeDiskManifest(manifest) {
  const tmpPath = `${MANIFEST_PATH}.tmp`;
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await fs.writeFile(tmpPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.rename(tmpPath, MANIFEST_PATH);
}

function sanitizeErrorMessage(message) {
  return String(message || 'Unknown Dropbox asset error.')
    .replace(/https?:\/\/\S+/gi, (rawUrl) => {
      try {
        const parsedUrl = new URL(rawUrl);
        parsedUrl.search = parsedUrl.search ? '?[redacted]' : '';
        return parsedUrl.toString();
      } catch (error) {
        return '[redacted-url]';
      }
    })
    .replace(/\b(refresh_token|access_token|client_secret|client_id)=([^&\s]+)/gi, '$1=[redacted]');
}

function getErrorSummary(error) {
  return {
    name: error?.name || 'Error',
    message: sanitizeErrorMessage(error?.message),
    status: error?.status || error?.statusCode || null
  };
}

function setLoadStarted() {
  assetMapState.state = 'loading';
  assetMapState.lastLoadStartedAt = new Date().toISOString();
  assetMapState.lastLoadCompletedAt = null;
  assetMapState.refreshInProgress = true;
}

function setLoadSucceeded(manifest) {
  const completedAt = new Date().toISOString();

  cachedAssetMap = manifest.assets;
  cachedManifest = manifest;
  cachedAt = Date.now();
  assetMapState.state = 'ready';
  assetMapState.source = manifest.source;
  assetMapState.lastLoadCompletedAt = completedAt;
  assetMapState.lastSuccessfulLoadAt = completedAt;
  assetMapState.lastError = null;
  assetMapState.refreshInProgress = false;
}

function setLoadFailed(error) {
  assetMapState.state = cachedAssetMap ? 'ready' : 'failed';
  assetMapState.lastLoadCompletedAt = new Date().toISOString();
  assetMapState.lastError = getErrorSummary(error);
  assetMapState.refreshInProgress = false;
}

function logAssetMapSuccess(reason, source, assetMap) {
  console.log(
    `[assets] ${reason} completed from ${source}: ${Object.keys(assetMap).length} asset(s) ready.`
  );
}

function logAssetMapFailure(reason, error) {
  const summary = getErrorSummary(error);
  console.error(`[assets] ${reason} failed: ${summary.message}`);
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

async function downloadDropboxFile(dropboxClient, dropboxPath, localPath) {
  await dropboxClient.auth.checkAndRefreshAccessToken();
  const token = dropboxClient.auth.getAccessToken();

  const response = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath })
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Dropbox download failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(localPath, buffer);
}

async function fetchDropboxFile(dropboxClient, dropboxPath) {
  await dropboxClient.auth.checkAndRefreshAccessToken();
  const token = dropboxClient.auth.getAccessToken();

  const response = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath })
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Dropbox download failed (${response.status}): ${body.slice(0, 200)}`);
  }

  return response;
}

function createRuntimeAssetMap(files) {
  const assetMap = {};

  for (const file of files) {
    const assetKey = getUniqueAssetKey(assetMap, createAssetKey(file.name));
    const ext = path.extname(file.name).toLowerCase();

    assetMap[assetKey] = {
      url: `/api/assets/${assetKey}`,
      name: file.name,
      dropboxPath: file.path_display,
      rev: file.rev,
      size: file.size,
      extension: ext,
      clientModified: file.client_modified,
      serverModified: file.server_modified,
      source: 'dropbox-runtime'
    };
  }

  return assetMap;
}

async function discoverDropboxAssetMap(options = {}) {
  const dropboxClient = createDropboxClient(options.authState);

  if (!dropboxClient) {
    throw new Error(
      'Dropbox refresh token is not configured. Set DROPBOX_REFRESH_TOKEN in .env to enable asset discovery.'
    );
  }

  const folderPath = process.env.DROPBOX_ASSET_ROOT_PATH || '';

  console.log('[assets] Discovering asset metadata from Dropbox...');

  const files = await listDropboxFiles(dropboxClient, folderPath);
  const assetMap = createRuntimeAssetMap(files);

  console.log(`[assets] Discovered ${files.length} image file(s) in Dropbox.`);

  return { assetMap, source: 'dropbox-runtime' };
}

async function syncDropboxAssets(options = {}) {
  const dropboxClient = createDropboxClient(options.authState);

  if (!dropboxClient) {
    throw new Error(
      'Dropbox refresh token is not configured. Set DROPBOX_REFRESH_TOKEN in .env to enable asset sync.'
    );
  }

  const folderPath = process.env.DROPBOX_ASSET_ROOT_PATH || '';

  console.log('[sync] Starting asset sync from Dropbox...');

  const files = await listDropboxFiles(dropboxClient, folderPath);

  console.log(`[sync] Found ${files.length} image file(s) in Dropbox.`);

  let existingManifest = null;

  try {
    existingManifest = await readDiskManifest();
  } catch (_) {
    // First run — no existing manifest
  }

  await fs.mkdir(GENERATED_ASSETS_DIR, { recursive: true });

  const assetMap = {};
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const assetKey = getUniqueAssetKey(assetMap, createAssetKey(file.name));
    const ext = path.extname(file.name).toLowerCase();
    const localFilename = assetKey + ext;
    const localPath = path.join(GENERATED_ASSETS_DIR, localFilename);
    const localUrl = `/assets/generated/${localFilename}`;

    // Skip if rev matches and file exists locally
    const existingAsset = existingManifest?.assets?.[assetKey];
    if (existingAsset?.rev === file.rev) {
      try {
        await fs.access(localPath);
        console.log(`[sync] ${localFilename} — rev match, skipped`);
        assetMap[assetKey] = { ...existingAsset, url: localUrl };
        skipped += 1;
        continue;
      } catch (_) {
        // File missing locally despite manifest — fall through to download
      }
    }

    const sizeKb = (file.size / 1024).toFixed(0);

    console.log(`[sync] Downloading ${localFilename} (${sizeKb} KB)...`);

    const startMs = Date.now();

    try {
      await downloadDropboxFile(dropboxClient, file.path_lower || file.path_display, localPath);
      console.log(`[sync] Downloaded ${localFilename} in ${Date.now() - startMs}ms`);
      downloaded += 1;
    } catch (error) {
      console.error(`[sync] ERROR: failed to download ${localFilename}: ${error.message}`);
      failed += 1;
      continue;
    }

    assetMap[assetKey] = {
      url: localUrl,
      name: file.name,
      localPath: localFilename,
      dropboxPath: file.path_display,
      rev: file.rev,
      size: file.size,
      clientModified: file.client_modified,
      serverModified: file.server_modified,
      source: 'dropbox'
    };
  }

  console.log(
    `[sync] Sync complete: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed.`
  );

  return { assetMap, source: 'dropbox' };
}

async function syncDropboxAssetsToDisk(options = {}) {
  const { assetMap, source } = await syncDropboxAssets(options);
  const manifest = createAssetManifest(assetMap, source);

  await writeDiskManifest(manifest);

  return manifest;
}

async function rebuildAssetMap(options = {}) {
  const { reason = 'Asset refresh', allowFallback = false } = options;

  if (pendingAssetMapRefresh) {
    return pendingAssetMapRefresh;
  }

  console.log(`[assets] ${reason} started.`);
  setLoadStarted();

  pendingAssetMapRefresh = (async () => {
    try {
      const { assetMap, source } = isProductionAssetMode()
        ? await syncDropboxAssets()
        : await discoverDropboxAssetMap();
      const manifest = createAssetManifest(assetMap, source);

      setLoadSucceeded(manifest);
      assetMapState.diskManifestLoaded = false;
      logAssetMapSuccess(reason, source, assetMap);

      if (isProductionAssetMode()) {
        try {
          await writeDiskManifest(manifest);
        } catch (error) {
          console.error(`[assets] Failed to persist asset manifest: ${getErrorSummary(error).message}`);
        }
      }

      return assetMap;
    } catch (error) {
      logAssetMapFailure(reason, error);

      if (allowFallback) {
        try {
          const diskManifest = await readDiskManifest();

          diskManifest.source = 'disk';
          setLoadSucceeded(diskManifest);
          assetMapState.diskManifestLoaded = true;
          assetMapState.lastError = getErrorSummary(error);
          logAssetMapSuccess(`${reason} fallback`, 'disk', diskManifest.assets);

          return diskManifest.assets;
        } catch (diskError) {
          assetMapState.diskManifestLoaded = false;
          console.error(
            `[assets] Disk manifest fallback unavailable: ${getErrorSummary(diskError).message}`
          );
        }

        // No local assets available — fail with clear message
        const noAssetsError = new Error(
          isProductionAssetMode()
            ? 'No local assets available. Run asset sync with a valid DROPBOX_REFRESH_TOKEN to populate public/assets/generated/.'
            : 'No Dropbox asset metadata available. Set DROPBOX_REFRESH_TOKEN in .env to enable runtime asset discovery.'
        );

        setLoadFailed(noAssetsError);
        throw noAssetsError;
      }

      setLoadFailed(error);
      throw error;
    }
  })()
    .finally(() => {
      pendingAssetMapRefresh = null;
    });

  return pendingAssetMapRefresh;
}

async function preloadAssetMap() {
  assetMapState.preloadAttempted = true;

  try {
    return await rebuildAssetMap({
      reason: 'Startup asset preload',
      allowFallback: true
    });
  } catch (error) {
    setLoadFailed(error);
    return cachedAssetMap;
  }
}

async function getAssetMap() {
  if (!cachedAssetMap) {
    throw new AssetMapNotReadyError();
  }

  return cachedAssetMap;
}

async function getAssetManifest() {
  if (!cachedManifest) {
    throw new AssetMapNotReadyError('Asset manifest is not ready.');
  }

  return cachedManifest;
}

async function refreshAssetMap(options = {}) {
  return rebuildAssetMap({
    ...options,
    reason: options.reason || 'Manual asset refresh',
    allowFallback: false
  });
}

async function getAssetUrl(assetKey) {
  const assetMap = await getAssetMap();
  const asset = assetMap[assetKey];

  if (!asset) {
    return null;
  }

  return asset.url;
}

async function streamDropboxAsset(assetKey, res) {
  const assetMap = await getAssetMap();
  const asset = assetMap[assetKey];

  if (!asset) {
    throw new AssetNotFoundError();
  }

  if (!asset.dropboxPath) {
    throw new Error(`Asset ${assetKey} does not include a Dropbox path.`);
  }

  const dropboxClient = createDropboxClient();

  if (!dropboxClient) {
    throw new Error('Dropbox refresh token is not configured.');
  }

  const response = await fetchDropboxFile(dropboxClient, asset.dropboxPath);
  const responseContentType = response.headers.get('content-type');
  const inferredContentType = IMAGE_CONTENT_TYPES[asset.extension || path.extname(asset.name).toLowerCase()];
  const contentType =
    responseContentType && responseContentType !== 'application/octet-stream'
      ? responseContentType
      : inferredContentType || 'application/octet-stream';
  const contentLength = response.headers.get('content-length') || asset.size;

  res.set('Content-Type', contentType);
  res.set('Cache-Control', `public, max-age=${DEV_ASSET_CACHE_SECONDS}, stale-while-revalidate=60`);

  if (asset.rev) {
    res.set('ETag', `"dropbox-${asset.rev}"`);
  }

  if (contentLength) {
    res.set('Content-Length', String(contentLength));
  }

  if (!response.body) {
    return res.end();
  }

  const { Readable } = require('stream');
  return Readable.fromWeb(response.body).pipe(res);
}

module.exports = {
  AssetNotFoundError,
  AssetMapNotReadyError,
  discoverDropboxAssets,
  getAssetManifest,
  getAssetServiceStatus,
  getAssetMap,
  getAssetUrl,
  isProductionAssetMode,
  preloadAssetMap,
  refreshAssetMap,
  streamDropboxAsset,
  syncDropboxAssets,
  syncDropboxAssetsToDisk
};

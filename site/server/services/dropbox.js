const path = require('path');
const {
  buildAssetSyncPlan,
  createDropboxClient,
  downloadDropboxFile,
  executeAssetSync,
  getCachedManifest,
  getErrorSummary,
  getSetupStatus,
  getSyncConfig,
  isR2Configured,
  listFilesRecursive,
  recordDryRun,
  runTrustedAssetSync,
  setCachedManifest,
  startAssetScheduler,
  stopAssetScheduler
} = require('./assetSync');
const {
  getAssetKey,
  getContentType,
  isSupportedAsset
} = require('./assetClassifier');

const DEV_ASSET_CACHE_SECONDS = 5 * 60;

const assetMapState = {
  preloadAttempted: false,
  state: 'idle',
  source: null,
  lastLoadStartedAt: null,
  lastLoadCompletedAt: null,
  lastSuccessfulLoadAt: null,
  diskManifestLoaded: false,
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

function isR2AssetMode() {
  return isR2Configured();
}

function markLoadStarted() {
  assetMapState.state = 'loading';
  assetMapState.lastLoadStartedAt = new Date().toISOString();
  assetMapState.lastLoadCompletedAt = null;
  assetMapState.refreshInProgress = true;
}

function markLoadSucceeded(manifest, source = manifest.source) {
  const completedAt = new Date().toISOString();
  setCachedManifest(manifest);
  assetMapState.state = 'ready';
  assetMapState.source = source;
  assetMapState.diskManifestLoaded = source === 'disk';
  assetMapState.lastLoadCompletedAt = completedAt;
  assetMapState.lastSuccessfulLoadAt = completedAt;
  assetMapState.lastError = null;
  assetMapState.refreshInProgress = false;
}

function markLoadFailed(error) {
  assetMapState.state = assetMapState.lastSuccessfulLoadAt ? 'ready' : 'failed';
  assetMapState.lastLoadCompletedAt = new Date().toISOString();
  assetMapState.lastError = getErrorSummary(error);
  assetMapState.refreshInProgress = false;
}

async function getAssetManifest() {
  return getCachedManifest();
}

async function getAssetMap() {
  const manifest = await getAssetManifest();
  return manifest.assets || {};
}

async function getAssetUrl(assetKey) {
  const assetMap = await getAssetMap();
  return assetMap[assetKey]?.url || null;
}

function getAssetServiceStatus() {
  const manifest = require('./assetSync').getSetupStatus();
  return {
    ...manifest,
    cacheReady: Boolean(assetMapState.lastSuccessfulLoadAt || manifest.manifest.exists),
    preloadAttempted: assetMapState.preloadAttempted,
    state: assetMapState.state,
    source: assetMapState.source,
    refreshInProgress: assetMapState.refreshInProgress,
    lastLoadStartedAt: assetMapState.lastLoadStartedAt,
    lastLoadCompletedAt: assetMapState.lastLoadCompletedAt,
    lastSuccessfulLoadAt: assetMapState.lastSuccessfulLoadAt,
    lastError: assetMapState.lastError || manifest.lastError
  };
}

async function preloadAssetMap() {
  assetMapState.preloadAttempted = true;
  markLoadStarted();

  try {
    const diskManifest = await getCachedManifest({ forceDisk: true });
    markLoadSucceeded(diskManifest, 'disk');
  } catch (error) {
    markLoadFailed(error);
  }

  const manifest = await getCachedManifest();
  if (manifest) {
    markLoadSucceeded(manifest, manifest.source);
    return manifest.assets;
  }

  throw new AssetMapNotReadyError('Asset manifest is not ready.');
}

async function runStartupAssetSync() {
  const syncConfig = getSyncConfig();
  if (!syncConfig.enabled || !syncConfig.autoSyncEnabled || !syncConfig.onBoot || !isR2Configured()) {
    return null;
  }

  markLoadStarted();

  try {
    const report = await runTrustedAssetSync({
      source: 'startup',
      reason: 'startup-sync'
    });
    const manifest = await getCachedManifest({ forceDisk: true });
    markLoadSucceeded(manifest, report.plan?.source || manifest.source);
    return { manifest, report };
  } catch (error) {
    markLoadFailed(error);
    console.error(`[assets] Startup asset sync failed: ${getErrorSummary(error).message}`);
    return null;
  }
}

async function refreshAssetMap(options = {}) {
  markLoadStarted();
  try {
    const report = await executeAssetSync({
      ...options,
      reason: options.reason || 'manual-refresh',
      requireFreshPlan: options.requireFreshPlan
    });
    const manifest = await getCachedManifest({ forceDisk: true });
    markLoadSucceeded(manifest, manifest.source);
    return { manifest, report };
  } catch (error) {
    markLoadFailed(error);
    throw error;
  }
}

async function planAssetSync(options = {}) {
  const plan = await buildAssetSyncPlan(options);
  if (options.record !== false) {
    await recordDryRun(plan, { source: options.source || 'internal' });
  }
  return plan;
}

async function runManualAssetSync(options = {}) {
  return refreshAssetMap({
    ...options,
    reason: 'manual-sync-endpoint',
    requireFreshPlan: true
  });
}

async function syncDropboxAssetsAndPersist(options = {}) {
  if (options.dryRun) {
    return planAssetSync({ ...options, record: true, source: options.source || 'cli' });
  }
  const report = await runTrustedAssetSync({
    ...options,
    source: options.source || 'cli',
    reason: options.reason || 'cli-sync'
  });
  const manifest = await getCachedManifest({ forceDisk: true });
  markLoadSucceeded(manifest, report.plan?.source || manifest.source);
  return { ...manifest, report };
}

async function syncDropboxAssets(options = {}) {
  return syncDropboxAssetsAndPersist(options);
}

async function syncDropboxAssetsToDisk(options = {}) {
  return syncDropboxAssetsAndPersist(options);
}

async function syncDropboxAssetsToR2(options = {}) {
  return syncDropboxAssetsAndPersist(options);
}

async function discoverDropboxAssets(options = {}) {
  const folderPath =
    typeof options.folderPath === 'string' ? options.folderPath : process.env.DROPBOX_LATEST_PATH || '/latest';
  const entries = await listFilesRecursive(folderPath, options);
  const files = entries.filter((entry) => entry?.['.tag'] === 'file');

  return {
    folderPath,
    recursive: true,
    supportedExtensions: Object.keys(require('./assetClassifier').SUPPORTED_ASSET_TYPES).sort(),
    counts: {
      totalEntries: entries.length,
      files: files.length,
      supportedFiles: files.filter((entry) => isSupportedAsset(entry.name)).length,
      unsupportedFiles: files.filter((entry) => !isSupportedAsset(entry.name)).length
    },
    files: files.map((entry) => ({
      name: entry.name,
      path: entry.path_display,
      extension: path.extname(entry.name).toLowerCase(),
      supported: isSupportedAsset(entry.name),
      assetKey: getAssetKey(entry.name),
      size: entry.size,
      rev: entry.rev,
      contentHash: entry.content_hash
    }))
  };
}

async function streamDropboxAsset(assetKey, res) {
  const assetMap = await getAssetMap();
  const asset = assetMap[assetKey];
  if (!asset) throw new AssetNotFoundError();
  if (!asset.dropboxPath) throw new Error(`Asset ${assetKey} does not include a Dropbox path.`);

  const dropboxClient = createDropboxClient();
  if (!dropboxClient) throw new Error('Dropbox refresh token is not configured.');

  const buffer = await downloadDropboxFile(asset.dropboxPath, { dropboxClient });
  const contentType = asset.contentType || getContentType(asset.name || asset.extension);

  res.set('Content-Type', contentType);
  res.set('Cache-Control', `public, max-age=${DEV_ASSET_CACHE_SECONDS}, stale-while-revalidate=60`);
  if (asset.rev) res.set('ETag', `"dropbox-${asset.rev}"`);
  res.set('Content-Length', String(buffer.length));
  return res.end(buffer);
}

function startAssetPoller() {
  return startAssetScheduler();
}

function stopAssetPoller() {
  return stopAssetScheduler();
}

module.exports = {
  AssetNotFoundError,
  AssetMapNotReadyError,
  createAssetKey: getAssetKey,
  discoverDropboxAssets,
  getAssetManifest,
  getAssetServiceStatus,
  getAssetMap,
  getAssetUrl,
  getSetupStatus,
  isR2AssetMode,
  isProductionAssetMode,
  planAssetSync,
  preloadAssetMap,
  refreshAssetMap,
  runManualAssetSync,
  runStartupAssetSync,
  startAssetPoller,
  stopAssetPoller,
  streamDropboxAsset,
  syncDropboxAssets,
  syncDropboxAssetsAndPersist,
  syncDropboxAssetsToDisk,
  syncDropboxAssetsToR2
};
